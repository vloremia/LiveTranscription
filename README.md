# Live Transcription

## Setup

### 1. Install Dependencies
```bash
npm install
# or
yarn install
```

### 2. Configure Deepgram API Key
1. Sign up for a free account at [Deepgram Console](https://console.deepgram.com/)
2. Create a new API key with "Member" scope or higher
3. Copy the API key
4. Create a `.env.local` file in the root directory:
```bash
DEEPGRAM_API_KEY=your_actual_deepgram_api_key_here
DEEPGRAM_ENV=development
```

⚠️ **Important**: Replace `your_actual_deepgram_api_key_here` with your actual Deepgram API key. The application will not work without a valid API key.

### 3. Run the Development Server
```bash
npm run dev
# or
yarn dev
```

## Troubleshooting

### WebSocket Connection Errors
If you see "WebSocket connection error" in the console:

1. **Check API Key**: Ensure your `DEEPGRAM_API_KEY` is correctly set in `.env.local`
2. **Verify API Key Scope**: Make sure your API key has "Member" scope or higher
3. **Check Network**: Ensure you have a stable internet connection
4. **Browser Permissions**: Allow microphone access when prompted

### Common Error Messages
- `Authentication failed`: Check your API key configuration
- `API quota exceeded`: You've reached your Deepgram usage limit
- `Connection timeout`: Network connectivity issues

## Features

- Real-time speech-to-text transcription
- Offline mode with local audio storage
- Automatic reconnection on network issues
- Visual feedback for connection status

## Issue Reporting

If you have found a bug or if you have a feature request, please report them at this repository issues section. Please do not report security vulnerabilities on the public GitHub issue tracker. The [Security Policy](./SECURITY.md) details the procedure for contacting Deepgram.


## Getting Help

We love to hear from you so if you have questions, comments or find a bug in the project, let us know! You can either:

- [Open an issue in this repository](https://github.com/deepgram-starters/nextjs-live-transcription/issues)
- [Join the Deepgram Github Discussions Community](https://github.com/orgs/deepgram/discussions)
- [Join the Deepgram Discord Community](https://discord.gg/xWRaCDBtW4)

## Author

[Deepgram](https://deepgram.com)

## License

This project is licensed under the MIT license. See the [LICENSE](./LICENSE) file for more info.
