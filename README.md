# Voice Assistant MVP

Real-time voice-to-LLM web application with streaming speech-to-text, AI responses, and text-to-speech playback.

## Features

- **Live Transcript**: See your speech transcribed in real-time as you speak
- **AI-Powered Responses**: Get structured responses with summary, key points, and suggested actions
- **Voice Playback**: Hear AI responses through text-to-speech
- **Mobile-Friendly**: Responsive UI that works on all devices
- **VAD (Voice Activity Detection)**: Automatic end-of-utterance detection based on silence

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│                 │◄──────────────────►│                 │
│    Frontend     │   Audio Chunks     │    Backend      │
│   (Next.js)     │   Transcripts      │   (Express+WS)  │
│                 │   Responses        │                 │
└─────────────────┘                    └────────┬────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
            ┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
            │   Deepgram    │         │     OpenAI      │         │     OpenAI      │
            │  (STT API)    │         │   (LLM API)     │         │   (TTS API)     │
            └───────────────┘         └─────────────────┘         └─────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS
- **Backend**: Express.js, WebSocket (ws)
- **STT**: Deepgram (streaming WebSocket)
- **LLM**: OpenAI GPT-4o-mini with structured outputs
- **TTS**: OpenAI TTS-1

## Quick Start

### Prerequisites

- Node.js 18+
- Deepgram API key ([get one here](https://console.deepgram.com/))
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### Installation

```bash
cd voice-app
npm install
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Local Production Build

```bash
npm run build
npm start
```

### Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables (DEEPGRAM_API_KEY, OPENAI_API_KEY)

### Fly.io

```bash
# Install flyctl
fly launch
fly secrets set DEEPGRAM_API_KEY=your_key OPENAI_API_KEY=your_key
fly deploy
```

### Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your repository
3. Add environment variables
4. Deploy automatically

> **Note**: Vercel is NOT recommended for this project as it has limited WebSocket support. Use Render, Fly.io, or Railway for proper WebSocket functionality.

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `DEEPGRAM_API_KEY` | Deepgram API key | Required |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_BASE_URL` | Custom OpenAI endpoint | - |
| `MAX_RECORDING_SECONDS` | Max recording duration | 30 |
| `VAD_SILENCE_THRESHOLD_MS` | Silence before finalization | 1000 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 60000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 10 |

## Switching STT Providers

The STT system is abstracted via the `STTProvider` interface. To add a new provider:

1. Create a new file in `src/server/stt/` (e.g., `azure-provider.ts`)
2. Implement the `STTProvider` interface
3. Update `createSTTProvider()` in your provider file
4. Import and use in `session-handler.ts`

Example for switching to a different provider:

```typescript
// In src/server/stt/deepgram-provider.ts
export function createSTTProvider(): BaseSTTProvider {
  // Switch based on env or config
  if (process.env.STT_PROVIDER === 'azure') {
    return new AzureProvider();
  }
  return new DeepgramProvider();
}
```

## Key Design Decisions

### Why WebSocket?

- **Real-time streaming**: Audio chunks are sent continuously for live transcription
- **Bidirectional**: Server can push partial transcripts, responses, and audio back
- **Efficient**: Single connection for entire session vs multiple HTTP requests

### Why Deepgram?

- **Native WebSocket support**: Built for streaming use cases
- **Low latency**: Optimized for real-time transcription
- **Good accuracy**: Nova-2 model provides high-quality results
- **Built-in VAD**: Supports utterance end detection

### Why Server-side VAD?

- **Reliability**: Deepgram's `utterance_end_ms` handles pause detection
- **Simplicity**: No need for client-side audio analysis
- **Consistency**: Same behavior across all devices

## Security Features

- **Rate limiting**: Per-IP request limits to prevent abuse
- **Connection limits**: Max 3 concurrent WebSocket connections per IP
- **No persistence**: Audio and transcripts are never saved to disk
- **Input validation**: Max recording length and text limits
- **Graceful cancellation**: Users can cancel at any time

## Smoke Test Checklist

After deployment, verify:

- [ ] WebSocket connects successfully (green indicator)
- [ ] Microphone permission prompt appears on Start
- [ ] Live transcript updates while speaking
- [ ] Response appears after pause
- [ ] Audio plays automatically
- [ ] Play/Pause button works
- [ ] Clear button resets state
- [ ] Cancel button stops processing
- [ ] Errors display in UI (disconnect and test)
- [ ] Mobile: touch controls work

## Troubleshooting

### "Connection error" on start
- Check if server is running
- Verify WebSocket URL matches server

### No transcription
- Check browser console for WebSocket errors
- Verify DEEPGRAM_API_KEY is set correctly
- Check Deepgram dashboard for usage/errors

### No AI response
- Verify OPENAI_API_KEY is set correctly
- Check server logs for API errors

### Audio doesn't play
- Click Start first (user gesture required)
- Check browser audio permissions
- Try on different browser

## License

MIT
