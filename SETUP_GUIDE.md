# Live Transcription Setup Guide

## Issues Fixed

This document outlines the problems that were causing the Deepgram WebSocket connection error and how they were resolved.

### Original Error
```
Deepgram connection error: WebSocket connection error 
(Ready State: CLOSED, URL: wss://api.deepgram.com/v1/listen?model=nova-3&interim_results=true&smart_format=true&filler_words=true&utterance_end_ms=3000)
```

### Root Causes & Solutions

#### 1. Missing API Key Configuration
**Problem**: No `.env` or `.env.local` file with the Deepgram API key.

**Solution**: 
- Created `.env.local` file with proper environment variables
- Added validation in the authentication route to check for missing/invalid API keys
- Improved error messages to guide users to the correct setup

#### 2. Poor Error Handling in Authentication
**Problem**: The authentication route didn't properly handle missing API keys or provide helpful error messages.

**Solution**: Enhanced `app/api/authenticate/route.ts`:
- Added validation for missing/empty API keys
- Improved error responses with detailed messages
- Added proper status codes (500 for server errors)
- Added logging for debugging

#### 3. Insufficient WebSocket Error Handling
**Problem**: The Deepgram context provider didn't provide enough information when connections failed.

**Solution**: Enhanced `app/context/DeepgramContextProvider.tsx`:
- Added detailed logging throughout the connection process
- Improved error classification (authentication, quota, network)
- Added metadata listener for debugging
- Enhanced connection timeout handling
- Better error propagation with specific error types

#### 4. Suboptimal Configuration
**Problem**: Configuration wasn't optimized for stability and compatibility.

**Solution**: Updated `app/components/App.tsx`:
- Changed model from "nova-3" to "nova-2" for better compatibility
- Added language specification ("en-US")
- Removed incompatible configuration options that caused TypeScript errors
- Optimized connection parameters for stability

## Setup Instructions

### 1. Get Deepgram API Key
1. Visit [Deepgram Console](https://console.deepgram.com/)
2. Sign up for a free account
3. Navigate to API Keys section
4. Create a new API key with "Member" scope or higher
5. Copy the API key

### 2. Configure Environment Variables
Create a `.env.local` file in the project root:

```bash
DEEPGRAM_API_KEY=your_actual_deepgram_api_key_here
DEEPGRAM_ENV=development
```

⚠️ **Critical**: Replace `your_actual_deepgram_api_key_here` with your actual Deepgram API key.

### 3. Install Dependencies
```bash
npm install
# or
yarn install
```

### 4. Start Development Server
```bash
npm run dev
# or
yarn dev
```

### 5. Test the Application
1. Open http://localhost:3000 in your browser
2. Allow microphone permissions when prompted
3. Look for connection status indicators:
   - 🟢 "Connected" = Success
   - 🔴 "Disconnected" = Check API key
   - 🟡 "Connecting..." = In progress

## Debugging Connection Issues

### Check Browser Console
Look for these log messages:
- "Requesting Deepgram authentication token..." = Starting auth
- "Token received, creating Deepgram client..." = Auth successful
- "Deepgram connection established successfully" = WebSocket connected

### Common Error Messages & Solutions

| Error Message | Cause | Solution |
|---------------|--------|----------|
| "Deepgram API key is not configured" | Missing/invalid API key | Check `.env.local` file |
| "Authentication failed - check your Deepgram API key" | Invalid API key | Verify API key in Deepgram console |
| "API quota exceeded" | Used up free credits | Check usage in Deepgram console |
| "Connection timeout after 15 seconds" | Network issues | Check internet connection |
| "Failed to generate temporary token" | API key permissions | Ensure API key has "Member" scope |

### Network Debugging
1. Check network tab in browser dev tools
2. Look for failed requests to `/api/authenticate`
3. Verify WebSocket connection attempts
4. Check for CORS issues

### Connection Status Component
The app includes a `ReconnectionStatus` component that shows:
- Current connection state
- Network status
- Reconnection attempts
- Error messages
- Manual reconnect button

## Technical Details

### Authentication Flow
1. Frontend requests token from `/api/authenticate`
2. Backend validates `DEEPGRAM_API_KEY` environment variable
3. In development: Returns API key directly
4. In production: Requests temporary token from Deepgram
5. Frontend uses token/key to create WebSocket connection

### Connection Management
- Automatic reconnection with exponential backoff
- Network status monitoring
- Offline mode with local audio storage
- Keep-alive messages when microphone is inactive
- Graceful error handling and recovery

### Error Recovery
- Failed connections trigger automatic retry
- Network disconnections pause attempts
- Manual reconnection option available
- Detailed error logging for debugging

## Verification Checklist

- [ ] `.env.local` file exists with valid API key
- [ ] Development server starts without errors
- [ ] Browser console shows successful authentication
- [ ] Connection status shows "Connected" (🟢)
- [ ] Microphone permissions granted
- [ ] Speech transcription appears in real-time
- [ ] No WebSocket errors in console

## Support

If you're still experiencing issues after following this guide:

1. Check the browser console for detailed error messages
2. Verify your Deepgram API key has sufficient permissions
3. Test your internet connection
4. Try refreshing the page and re-granting microphone permissions
5. Check Deepgram console for API usage and any restrictions 