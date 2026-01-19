import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseUrl,
});

const MAX_TTS_LENGTH = 4000;

export async function generateTTS(text: string): Promise<{ audioBase64: string; mimeType: string }> {
  if (!text.trim()) {
    throw new Error('Empty text provided for TTS');
  }

  const truncatedText = text.slice(0, MAX_TTS_LENGTH);

  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: truncatedText,
      response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    return {
      audioBase64: base64Audio,
      mimeType: 'audio/mpeg',
    };
  } catch (error) {
    console.error('TTS service error:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}
