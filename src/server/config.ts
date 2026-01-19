import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || '',
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL,
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
  },
  
  audio: {
    maxRecordingSeconds: parseInt(process.env.MAX_RECORDING_SECONDS || '30', 10),
    vadSilenceThresholdMs: parseInt(process.env.VAD_SILENCE_THRESHOLD_MS || '1000', 10),
  },
};

export function validateConfig(): void {
  const errors: string[] = [];
  
  if (!config.deepgram.apiKey) {
    errors.push('DEEPGRAM_API_KEY is required');
  }
  
  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required');
  }
  
  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}
