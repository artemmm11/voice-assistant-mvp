import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { STTStream } from '@/shared/types';
import { BaseSTTProvider } from './stt-provider';
import { config } from '../config';

export class DeepgramProvider extends BaseSTTProvider {
  name = 'deepgram';
  private client;

  constructor() {
    super();
    this.client = createClient(config.deepgram.apiKey);
  }

  createStream(onPartial: (text: string, isFinal: boolean) => void): STTStream {
    return new DeepgramStream(this.client, onPartial);
  }
}

class DeepgramStream implements STTStream {
  private connection: ReturnType<ReturnType<typeof createClient>['listen']['live']> | null = null;
  private fullTranscript = '';
  private resolveFinish: ((text: string) => void) | null = null;
  private isOpen = false;

  constructor(
    private client: ReturnType<typeof createClient>,
    private onPartial: (text: string, isFinal: boolean) => void
  ) {
    this.initConnection();
  }

  private async initConnection() {
    try {
      this.connection = this.client.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
      });

      this.connection.on(LiveTranscriptionEvents.Open, () => {
        this.isOpen = true;
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        if (transcript) {
          const isFinal = data.is_final || false;
          if (isFinal) {
            this.fullTranscript += (this.fullTranscript ? ' ' : '') + transcript;
          }
          this.onPartial(
            isFinal ? this.fullTranscript : this.fullTranscript + ' ' + transcript,
            isFinal
          );
        }
      });

      this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        if (this.resolveFinish) {
          this.resolveFinish(this.fullTranscript);
          this.resolveFinish = null;
        }
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('Deepgram error:', error.message || 'Unknown error');
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        this.isOpen = false;
        if (this.resolveFinish) {
          this.resolveFinish(this.fullTranscript);
          this.resolveFinish = null;
        }
      });
    } catch (error) {
      console.error('Failed to initialize Deepgram connection:', error);
      throw error;
    }
  }

  send(audioChunk: Buffer): void {
    if (this.connection && this.isOpen) {
      this.connection.send(audioChunk);
    }
  }

  async finish(): Promise<string> {
    return new Promise((resolve) => {
      if (this.fullTranscript) {
        resolve(this.fullTranscript);
        return;
      }
      
      this.resolveFinish = resolve;
      
      setTimeout(() => {
        if (this.resolveFinish) {
          this.resolveFinish(this.fullTranscript);
          this.resolveFinish = null;
        }
      }, 2000);
    });
  }

  close(): void {
    if (this.connection) {
      this.connection.requestClose();
      this.connection = null;
    }
    this.isOpen = false;
  }
}

export function createSTTProvider(): BaseSTTProvider {
  return new DeepgramProvider();
}
