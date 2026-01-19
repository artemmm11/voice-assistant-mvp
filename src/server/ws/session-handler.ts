import type WebSocket from 'ws';
import type { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import type { ClientMessage, ServerMessage, STTStream, ErrorCode } from '../../shared/types';
import { ErrorCodes } from '../../shared/types';
import { createSTTProvider } from '../stt/deepgram-provider';
import { generateLLMResponse } from '../services/llm-service';
import { generateTTS } from '../services/tts-service';
import { config } from '../config';

interface Session {
  id: string;
  ws: WebSocket;
  sttStream: STTStream | null;
  startTime: number;
  lastActivityTime: number;
  isCancelled: boolean;
  vadTimeout: NodeJS.Timeout | null;
  maxDurationTimeout: NodeJS.Timeout | null;
}

const sessions = new Map<string, Session>();

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, message: string, code: string): void {
  send(ws, { type: 'error', message, code });
}

function sendStatus(ws: WebSocket, status: import('../../shared/types').AppStatus): void {
  send(ws, { type: 'status', status });
}

export function handleConnection(ws: WebSocket, clientIp: string): void {
  const sessionId = uuidv4();
  const sttProvider = createSTTProvider();

  const session: Session = {
    id: sessionId,
    ws,
    sttStream: null,
    startTime: Date.now(),
    lastActivityTime: Date.now(),
    isCancelled: false,
    vadTimeout: null,
    maxDurationTimeout: null,
  };

  sessions.set(sessionId, session);

  sendStatus(ws, 'idle');

  ws.on('message', async (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      await handleMessage(session, message, sttProvider);
    } catch (error) {
      console.error('Message handling error:', error instanceof Error ? error.message : 'Unknown');
      sendError(ws, 'Failed to process message', ErrorCodes.INVALID_INPUT);
    }
  });

  ws.on('close', () => {
    cleanupSession(session);
    sessions.delete(sessionId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    cleanupSession(session);
    sessions.delete(sessionId);
  });
}

async function handleMessage(
  session: Session,
  message: ClientMessage,
  sttProvider: ReturnType<typeof createSTTProvider>
): Promise<void> {
  const { ws } = session;

  switch (message.type) {
    case 'audio_chunk': {
      if (session.isCancelled) return;

      session.lastActivityTime = Date.now();

      if (!session.sttStream) {
        session.startTime = Date.now();
        sendStatus(ws, 'listening');

        session.sttStream = sttProvider.createStream((text, isFinal) => {
          if (session.isCancelled) return;
          
          send(ws, { type: 'partial_transcript', text, isFinal });

          resetVadTimeout(session);
        });

        session.maxDurationTimeout = setTimeout(() => {
          if (!session.isCancelled) {
            sendError(ws, 'Maximum recording duration reached', ErrorCodes.MAX_DURATION);
            finishRecording(session);
          }
        }, config.audio.maxRecordingSeconds * 1000);
      }

      const audioBuffer = Buffer.from(message.data, 'base64');
      session.sttStream.send(audioBuffer);
      resetVadTimeout(session);
      break;
    }

    case 'stop_recording': {
      await finishRecording(session);
      break;
    }

    case 'cancel': {
      session.isCancelled = true;
      cleanupSession(session);
      sendStatus(ws, 'idle');
      break;
    }
  }
}

function resetVadTimeout(session: Session): void {
  if (session.vadTimeout) {
    clearTimeout(session.vadTimeout);
  }

  session.vadTimeout = setTimeout(() => {
    console.log('VAD timeout triggered, finishing recording...');
    if (!session.isCancelled && session.sttStream) {
      finishRecording(session);
    }
  }, config.audio.vadSilenceThresholdMs);
}

async function finishRecording(session: Session): Promise<void> {
  const { ws, sttStream } = session;

  if (session.vadTimeout) {
    clearTimeout(session.vadTimeout);
    session.vadTimeout = null;
  }

  if (session.maxDurationTimeout) {
    clearTimeout(session.maxDurationTimeout);
    session.maxDurationTimeout = null;
  }

  if (!sttStream) {
    sendStatus(ws, 'idle');
    return;
  }

  try {
    sendStatus(ws, 'processing_stt');
    const finalText = await sttStream.finish();
    sttStream.close();
    session.sttStream = null;

    if (!finalText.trim()) {
      sendError(ws, 'No speech detected', ErrorCodes.INVALID_INPUT);
      sendStatus(ws, 'idle');
      return;
    }

    send(ws, { type: 'final_transcript', text: finalText });

    sendStatus(ws, 'processing_llm');
    const llmResponse = await generateLLMResponse(finalText);
    send(ws, { type: 'llm_response', data: llmResponse });

    sendStatus(ws, 'processing_tts');
    const ttsText = formatForTTS(llmResponse);
    const { audioBase64, mimeType } = await generateTTS(ttsText);
    send(ws, { type: 'tts_audio', audioBase64, mimeType });

    sendStatus(ws, 'ready_to_play');
  } catch (error) {
    console.error('Processing error:', error instanceof Error ? error.message : 'Unknown');
    
    let errorCode: string = ErrorCodes.CONNECTION_ERROR;
    let errorMessage = 'An error occurred while processing';

    if (error instanceof Error) {
      if (error.message.includes('STT') || error.message.includes('Deepgram')) {
        errorCode = ErrorCodes.STT_ERROR;
        errorMessage = 'Speech recognition failed';
      } else if (error.message.includes('LLM') || error.message.includes('OpenAI')) {
        errorCode = ErrorCodes.LLM_ERROR;
        errorMessage = 'AI response generation failed';
      } else if (error.message.includes('TTS')) {
        errorCode = ErrorCodes.TTS_ERROR;
        errorMessage = 'Text-to-speech failed';
      }
    }

    sendError(ws, errorMessage, errorCode);
    sendStatus(ws, 'idle');
  }
}

function formatForTTS(response: { summary: string; bullets: string[]; next_action: string }): string {
  return response.summary;
}

function cleanupSession(session: Session): void {
  if (session.vadTimeout) {
    clearTimeout(session.vadTimeout);
    session.vadTimeout = null;
  }

  if (session.maxDurationTimeout) {
    clearTimeout(session.maxDurationTimeout);
    session.maxDurationTimeout = null;
  }

  if (session.sttStream) {
    session.sttStream.close();
    session.sttStream = null;
  }

  session.isCancelled = true;
}
