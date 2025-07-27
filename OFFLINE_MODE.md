# Offline Mode Documentation

This application includes comprehensive offline functionality that allows you to continue recording audio even when your internet connection is down.

## Features

### 🎯 Core Functionality
- **Local Audio Storage**: Audio segments are automatically stored in IndexedDB when offline
- **Automatic Sync**: When connection is restored, stored audio is automatically transcribed
- **Visual Indicators**: Clear UI shows offline status and sync progress
- **Retry Logic**: Failed transcriptions are retried with exponential backoff
- **Data Cleanup**: Old audio segments are automatically cleaned up after 7 days

### 🔧 Technical Implementation

#### Services
- **IndexedDBService**: Handles local storage of audio segments and transcripts
- **NetworkService**: Monitors network connectivity and manages online/offline state
- **OfflineTranscriptionService**: Processes stored audio segments when back online

#### Key Components
- **OfflineStatus**: Shows current offline status and sync progress
- **OfflineTest**: Test controls for manually toggling offline mode
- **Enhanced App**: Main component with offline recording logic
- **Enhanced MicrophoneControl**: Shows offline mode status

## How It Works

### 1. Online Mode (Normal Operation)
- Audio is streamed directly to Deepgram for real-time transcription
- Transcripts appear immediately in the UI

### 2. Offline Mode (When Connection Lost)
- Audio continues to be recorded locally using IndexedDB
- Visual indicators show "Offline Mode" status
- Audio segments are queued for later processing

### 3. Sync Process (When Connection Restored)
- Stored audio segments are automatically processed
- Transcripts are generated using Deepgram's API
- Results are added to the transcription history
- Visual indicators show sync progress

## Testing Offline Mode

### Manual Testing
1. Use the "Offline Test Controls" panel in the bottom-left corner
2. Click "Toggle Offline Mode" to simulate going offline
3. Record audio while offline - it will be stored locally
4. Toggle back to online mode to see the sync process

### Browser Testing
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Check "Offline" to simulate network disconnection
4. Record audio and observe offline behavior
5. Uncheck "Offline" to restore connection and see sync

## Configuration

### Auto-sync Interval
The sync process runs automatically every 30 seconds when online. You can modify this in `OfflineTranscriptionService.ts`:

```typescript
await offlineTranscriptionService.startAutoSync(30000); // 30 seconds
```

### Data Retention
Audio segments are automatically cleaned up after 7 days. You can modify this in `IndexedDBService.ts`:

```typescript
await indexedDBService.clearOldData(7); // 7 days
```

### Retry Logic
Failed transcriptions are retried up to 3 times. You can modify this in `OfflineTranscriptionService.ts`:

```typescript
private maxRetries = 3;
```

## Browser Support

This implementation uses:
- **IndexedDB**: For local storage (supported in all modern browsers)
- **MediaRecorder API**: For audio recording
- **Fetch API**: For network requests

### Minimum Requirements
- Chrome 51+
- Firefox 44+
- Safari 11+
- Edge 79+

## Troubleshooting

### Audio Not Recording Offline
- Check browser permissions for microphone access
- Ensure IndexedDB is enabled in your browser
- Check browser console for any errors

### Sync Not Working
- Verify network connectivity
- Check browser console for API errors
- Ensure Deepgram API key is valid

### Storage Issues
- Check available disk space
- Clear browser data if IndexedDB is corrupted
- Monitor IndexedDB usage in DevTools

## Performance Considerations

- Audio segments are stored as Blobs in IndexedDB
- Each segment is approximately 250ms of audio
- Storage usage depends on recording duration
- Automatic cleanup prevents unlimited storage growth

## Security Notes

- Audio data is stored locally in the browser
- No audio data is sent to external servers when offline
- Transcripts are only generated when explicitly syncing
- All data is cleared when browser data is cleared 