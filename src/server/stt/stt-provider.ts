import type { STTProvider, STTStream } from '../../shared/types';

export abstract class BaseSTTProvider implements STTProvider {
  abstract name: string;
  abstract createStream(onPartial: (text: string, isFinal: boolean) => void): STTStream;
}

export { STTProvider, STTStream };
