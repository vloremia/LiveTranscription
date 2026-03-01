# Live Transcription (Next.js + Deepgram)

Real-time speech-to-text web app built with Next.js and Deepgram, including an offline-first recording and sync flow.

## Features

- Real-time transcription using Deepgram live streaming (`nova-3`)
- Microphone controls and live transcript feed
- Offline recording fallback with local queueing in IndexedDB
- Automatic transcript sync when network connectivity returns
- Retry logic for failed offline transcript jobs
- Configurable CORS behavior for `/api/authenticate`

## Requirements

- Node.js 18+
- npm
- Deepgram API key

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from the sample file and set your key:

```bash
cp sample.env.local .env.local
```

```bash
DEEPGRAM_API_KEY=YOUR_DEEPGRAM_API_KEY
```

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

### Required

- `DEEPGRAM_API_KEY`: Server-side API key used to mint temporary auth tokens.

### Optional

- `DEEPGRAM_ENV`: Set to `development` only for local debugging. In this mode, `/api/authenticate` returns the raw API key instead of a temporary token.
- `ALLOWED_ORIGIN`: CSV list for CORS `Access-Control-Allow-Origin` (default: `*`).
- `ALLOWED_METHODS`: CSV list for CORS methods (default: `GET,HEAD,OPTIONS`).
- `ALLOWED_HEADERS`: CSV list for CORS headers (default: `Content-Type,Authorization`).
- `EXPOSED_HEADERS`: CSV list for CORS exposed headers.
- `PREFLIGHT_MAX_AGE`: Integer max age for CORS preflight caching.
- `CREDENTIALS`: `true` or `false` for CORS credentials header.

## Scripts

- `npm run dev`: Start development server.
- `npm run build`: Build for production.
- `npm run start`: Run production build.
- `npm run lint`: Run Next.js linting.

## Offline Mode

When the connection drops, audio chunks are stored locally and later transcribed when online again.

See detailed behavior and testing steps in [OFFLINE_MODE.md](./OFFLINE_MODE.md).

## Security Note

Do not use `DEEPGRAM_ENV=development` in production.

## License

MIT. See [LICENSE](./LICENSE).
