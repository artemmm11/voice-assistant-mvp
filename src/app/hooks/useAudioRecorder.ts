'use client';

import { useCallback, useRef, useState } from 'react';

const CHUNK_INTERVAL_MS = 250;
const SAMPLE_RATE = 16000;
const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 2500;

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: (onChunk: (base64Data: string) => void, onSilenceDetected: () => void) => Promise<void>;
  stopRecording: () => void;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const startRecording = useCallback(async (onChunk: (base64Data: string) => void, onSilenceDetected: () => void) => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: SAMPLE_RATE,
        },
      });

      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let audioBuffer: Float32Array[] = [];
      let lastSendTime = Date.now();
      let silenceStartTime: number | null = null;
      let hasSpoken = false;
      let silenceTriggered = false;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(new Float32Array(inputData));

        const rms = Math.sqrt(inputData.reduce((sum, val) => sum + val * val, 0) / inputData.length);
        const isSilent = rms < SILENCE_THRESHOLD;

        if (!isSilent) {
          hasSpoken = true;
          silenceStartTime = null;
        } else if (hasSpoken && !silenceTriggered) {
          if (silenceStartTime === null) {
            silenceStartTime = Date.now();
          } else if (Date.now() - silenceStartTime >= SILENCE_DURATION_MS) {
            silenceTriggered = true;
            onSilenceDetected();
          }
        }

        const now = Date.now();
        if (now - lastSendTime >= CHUNK_INTERVAL_MS) {
          const totalLength = audioBuffer.reduce((acc, arr) => acc + arr.length, 0);
          const combined = new Float32Array(totalLength);
          let offset = 0;
          for (const arr of audioBuffer) {
            combined.set(arr, offset);
            offset += arr.length;
          }

          const int16Data = float32ToInt16(combined);
          const base64 = arrayBufferToBase64(int16Data.buffer as ArrayBuffer);
          onChunk(base64);

          audioBuffer = [];
          lastSendTime = now;
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(message);
      console.error('Microphone access error:', message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
  };
}

function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
