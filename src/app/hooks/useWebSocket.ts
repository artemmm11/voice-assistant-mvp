'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage, AppStatus, LLMResponse } from '@/shared/types';

interface UseWebSocketReturn {
  isConnected: boolean;
  status: AppStatus;
  transcript: string;
  llmResponse: LLMResponse | null;
  audioData: { base64: string; mimeType: string } | null;
  error: string | null;
  sendAudioChunk: (base64Data: string) => void;
  stopRecording: () => void;
  cancel: () => void;
  clearState: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [llmResponse, setLlmResponse] = useState<LLMResponse | null>(null);
  const [audioData, setAudioData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = () => {
        setError('Connection error. Please check your internet connection.');
      };

      ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch {
          console.error('Failed to parse WebSocket message');
        }
      };

      wsRef.current = ws;
    } catch {
      setError('Failed to connect to server');
    }
  }, []);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'status':
        setStatus(message.status);
        break;
      case 'partial_transcript':
        setTranscript(message.text);
        break;
      case 'final_transcript':
        setTranscript(message.text);
        break;
      case 'llm_response':
        setLlmResponse(message.data);
        break;
      case 'tts_audio':
        setAudioData({
          base64: message.audioBase64,
          mimeType: message.mimeType,
        });
        break;
      case 'error':
        setError(message.message);
        break;
    }
  }, []);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendAudioChunk = useCallback((base64Data: string) => {
    sendMessage({ type: 'audio_chunk', data: base64Data });
  }, [sendMessage]);

  const stopRecording = useCallback(() => {
    sendMessage({ type: 'stop_recording' });
  }, [sendMessage]);

  const cancel = useCallback(() => {
    sendMessage({ type: 'cancel' });
    setStatus('idle');
    setTranscript('');
    setLlmResponse(null);
    setAudioData(null);
    setError(null);
  }, [sendMessage]);

  const clearState = useCallback(() => {
    setTranscript('');
    setLlmResponse(null);
    setAudioData(null);
    setError(null);
    setStatus('idle');
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    status,
    transcript,
    llmResponse,
    audioData,
    error,
    sendAudioChunk,
    stopRecording,
    cancel,
    clearState,
  };
}
