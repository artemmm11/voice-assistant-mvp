'use client';

import { useEffect, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useAudioPlayer } from './hooks/useAudioPlayer';

const statusLabels: Record<string, string> = {
  idle: 'Ready',
  listening: 'Listening...',
  processing_stt: 'Transcribing...',
  processing_llm: 'Thinking...',
  processing_tts: 'Generating audio...',
  ready_to_play: 'Ready to play',
};

export default function Home() {
  const {
    isConnected,
    status,
    transcript,
    llmResponse,
    audioData,
    error: wsError,
    sendAudioChunk,
    stopRecording: wsStopRecording,
    cancel,
    clearState,
  } = useWebSocket();

  const {
    isRecording,
    startRecording,
    stopRecording: recorderStop,
    error: recorderError,
  } = useAudioRecorder();

  const { isPlaying, play, pause, stop: stopAudio } = useAudioPlayer();

  const error = wsError || recorderError;
  const isProcessing = ['processing_stt', 'processing_llm', 'processing_tts'].includes(status);

  const handleStartRecording = useCallback(async () => {
    clearState();
    await startRecording(sendAudioChunk, () => {
      recorderStop();
      wsStopRecording();
    });
  }, [clearState, startRecording, sendAudioChunk, recorderStop, wsStopRecording]);

  const handleStopRecording = useCallback(() => {
    recorderStop();
    wsStopRecording();
  }, [recorderStop, wsStopRecording]);

  const handleCancel = useCallback(() => {
    recorderStop();
    stopAudio();
    cancel();
  }, [recorderStop, stopAudio, cancel]);

  const handleClear = useCallback(() => {
    recorderStop();
    stopAudio();
    clearState();
  }, [recorderStop, stopAudio, clearState]);

  useEffect(() => {
    if (audioData && status === 'ready_to_play') {
      play(audioData.base64, audioData.mimeType);
    }
  }, [audioData, status, play]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-8">
          Voice Assistant
        </h1>

        {/* Connection Status */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Main Control Button */}
        <div className="flex justify-center mb-8">
          {!isRecording && !isProcessing ? (
            <button
              onClick={handleStartRecording}
              disabled={!isConnected}
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold text-lg transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              Start
            </button>
          ) : isRecording ? (
            <button
              onClick={handleStopRecording}
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-lg transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl recording-pulse"
            >
              Stop
            </button>
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center mb-6">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {statusLabels[status] || status}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </p>
          </div>
        )}

        {/* Live Transcript */}
        {transcript && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Transcript
            </h2>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-gray-800 dark:text-gray-200">{transcript}</p>
            </div>
          </div>
        )}

        {/* LLM Response */}
        {llmResponse && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Response
            </h2>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
                  Summary
                </h3>
                <p className="text-gray-800 dark:text-gray-200">
                  {llmResponse.summary}
                </p>
              </div>

              {llmResponse.bullets.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
                    Key Points
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {llmResponse.bullets.map((bullet, i) => (
                      <li key={i} className="text-gray-800 dark:text-gray-200">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
                  Next Action
                </h3>
                <p className="text-blue-600 dark:text-blue-400 font-medium">
                  {llmResponse.next_action}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Audio Controls */}
        {audioData && (
          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={pause}
              className="px-6 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          {(isRecording || isProcessing) && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          {(transcript || llmResponse || error) && !isRecording && !isProcessing && (
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
