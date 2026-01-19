import { z } from 'zod';

// WebSocket message types from client to server
export type ClientMessage =
  | { type: 'audio_chunk'; data: string } // base64 encoded audio
  | { type: 'stop_recording' }
  | { type: 'cancel' };

// WebSocket message types from server to client
export type ServerMessage =
  | { type: 'partial_transcript'; text: string; isFinal: boolean }
  | { type: 'final_transcript'; text: string }
  | { type: 'llm_response'; data: LLMResponse }
  | { type: 'tts_audio'; audioBase64: string; mimeType: string }
  | { type: 'error'; message: string; code: string }
  | { type: 'status'; status: AppStatus };

// Application status states
export type AppStatus =
  | 'idle'
  | 'listening'
  | 'processing_stt'
  | 'processing_llm'
  | 'processing_tts'
  | 'ready_to_play';

// LLM structured response schema
export const LLMResponseSchema = z.object({
  summary: z.string().describe('Brief 1-2 sentence summary of the user input'),
  bullets: z.array(z.string()).max(3).describe('Up to 3 key points'),
  next_action: z.string().describe('Suggested next action or follow-up'),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// Configuration types
export interface AppConfig {
  port: number;
  maxRecordingSeconds: number;
  vadSilenceThresholdMs: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

// STT Provider interface for abstraction
export interface STTProvider {
  name: string;
  createStream(onPartial: (text: string, isFinal: boolean) => void): STTStream;
}

export interface STTStream {
  send(audioChunk: Buffer): void;
  finish(): Promise<string>;
  close(): void;
}

// Error codes
export const ErrorCodes = {
  STT_ERROR: 'STT_ERROR',
  LLM_ERROR: 'LLM_ERROR',
  TTS_ERROR: 'TTS_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  MAX_DURATION: 'MAX_DURATION',
  INVALID_INPUT: 'INVALID_INPUT',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
