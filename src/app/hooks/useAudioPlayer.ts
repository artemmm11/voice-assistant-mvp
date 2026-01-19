'use client';

import { useCallback, useRef, useState } from 'react';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  play: (base64Audio: string, mimeType: string) => void;
  pause: () => void;
  stop: () => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback((base64Audio: string, mimeType: string) => {
    cleanup();

    if (!base64Audio || base64Audio.length === 0) {
      console.error('No audio data provided');
      return;
    }

    try {
      const cleanBase64 = base64Audio.replace(/[\s\n\r]/g, '');
      const dataUrl = `data:${mimeType || 'audio/mpeg'};base64,${cleanBase64}`;

      const audio = new Audio();
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = (e) => {
        const mediaError = audio.error;
        console.error('Audio playback error:', mediaError?.message || 'Unknown error', mediaError?.code);
        cleanup();
      };

      audio.oncanplaythrough = () => {
        audio.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.error('Failed to play audio:', err.message);
          cleanup();
        });
      };

      audio.src = dataUrl;
      audio.load();
    } catch (err) {
      console.error('Failed to decode audio:', err);
      cleanup();
    }
  }, [cleanup]);

  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (audioRef.current && !isPlaying) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(console.error);
    }
  }, [isPlaying]);

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    isPlaying,
    play,
    pause,
    stop,
  };
}
