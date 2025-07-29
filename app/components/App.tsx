"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LiveConnectionState,
  LiveTranscriptionEvent,
  LiveTranscriptionEvents,
  useDeepgram,
} from "../context/DeepgramContextProvider";
import {
  MicrophoneEvents,
  MicrophoneState,
  useMicrophone,
} from "../context/MicrophoneContextProvider";

interface TranscriptionEntry {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

// Simple Deepgram configuration
const DEEPGRAM_CONFIG = {
  model: "nova-2",
  interim_results: true,
  smart_format: true,
  language: "en-US",
} as const;

const App: () => JSX.Element = () => {
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  
  const { 
    connection, 
    connectToDeepgram, 
    disconnectFromDeepgram, 
    connectionState, 
    isReconnecting 
  } = useDeepgram();
  
  const { 
    setupMicrophone, 
    microphone, 
    microphoneState, 
    startMicrophone, 
    stopMicrophone 
  } = useMicrophone();

  // Setup microphone on mount
  useEffect(() => {
    setupMicrophone();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Connect to Deepgram when microphone is ready
  useEffect(() => {
    if (microphoneState === MicrophoneState.Ready && connectionState === LiveConnectionState.CLOSED && !isReconnecting) {
      console.log('Connecting to Deepgram...');
      connectToDeepgram(DEEPGRAM_CONFIG);
    }
  }, [microphoneState, connectionState, isReconnecting, connectToDeepgram]);

  // Handle audio data and transcription events
  useEffect(() => {
    if (!microphone || !connection || connectionState !== LiveConnectionState.OPEN) {
      return;
    }

    const handleAudioData = (e: BlobEvent) => {
      if (!e.data || e.data.size === 0) {
        return;
      }

      console.log("Sending audio data to Deepgram", e.data.size + ' bytes');
      
      try {
        connection.send(e.data);
      } catch (error) {
        console.error('Error sending audio data to Deepgram:', error);
      }
    };

    const handleTranscript = (data: LiveTranscriptionEvent) => {
      const { is_final: isFinal } = data;
      const transcript = data.channel.alternatives[0].transcript;

      if (transcript !== "") {
        if (isFinal) {
          // Add final transcript to the list
          const newEntry: TranscriptionEntry = {
            id: `${Date.now()}-${Math.random()}`,
            text: transcript,
            timestamp: new Date(),
            isFinal: true
          };
          
          setTranscriptions(prev => [...prev, newEntry]);
          setCurrentTranscript(""); // Clear current transcript
        } else {
          // Update current interim transcript
          setCurrentTranscript(transcript);
        }
      }
    };

    connection.addListener(LiveTranscriptionEvents.Transcript, handleTranscript);
    microphone.addEventListener(MicrophoneEvents.DataAvailable, handleAudioData);

    return () => {
      connection.removeListener(LiveTranscriptionEvents.Transcript, handleTranscript);
      microphone.removeEventListener(MicrophoneEvents.DataAvailable, handleAudioData);
    };
  }, [connection, microphone, connectionState]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (microphoneState === MicrophoneState.NotSetup || microphoneState === MicrophoneState.Error) {
      setupMicrophone();
      return;
    }

    if (microphoneState === MicrophoneState.Open) {
      stopMicrophone();
    } else if (microphoneState === MicrophoneState.Ready || microphoneState === MicrophoneState.Paused) {
      startMicrophone();
    }
  }, [microphoneState, setupMicrophone, startMicrophone, stopMicrophone]);

  // Get status text
  const getStatusText = () => {
    if (isReconnecting) return 'Reconnecting...';
    
    if (connectionState === LiveConnectionState.CONNECTING) return 'Connecting...';
    
    if (microphoneState === MicrophoneState.NotSetup) return 'Click to setup microphone';
    
    if (microphoneState === MicrophoneState.SettingUp) return 'Setting up microphone...';
    
    if (microphoneState === MicrophoneState.Error) return 'Microphone error - Click to retry';
    
    if (microphoneState === MicrophoneState.Open) return 'Recording... Click to stop';
    
    if (connectionState === LiveConnectionState.OPEN && microphoneState === MicrophoneState.Ready) {
      return 'Ready - Click to start recording';
    }
    
    return 'Preparing...';
  };

  // Get button style
  const getButtonStyle = () => {
    if (microphoneState === MicrophoneState.Open) {
      return 'bg-red-500 hover:bg-red-600 animate-pulse';
    }
    
    if (microphoneState === MicrophoneState.Error) {
      return 'bg-yellow-500 hover:bg-yellow-600';
    }
    
    return 'bg-blue-500 hover:bg-blue-600';
  };

  const isRecording = microphoneState === MicrophoneState.Open;
  const canRecord = connectionState === LiveConnectionState.OPEN && 
                   (microphoneState === MicrophoneState.Ready || microphoneState === MicrophoneState.Open);

  return (
    <div className="h-full flex flex-col">
      {/* Header with status */}
      <div className="p-4 text-center">
        <div className="mb-4">
          <div className={`inline-flex items-center px-4 py-2 rounded-lg ${
            connectionState === LiveConnectionState.OPEN ? 'bg-green-600' : 
            isReconnecting ? 'bg-yellow-600' : 'bg-red-600'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connectionState === LiveConnectionState.OPEN ? 'bg-green-300' : 
              isReconnecting ? 'bg-yellow-300' : 'bg-red-300'
            }`} />
            <span className="text-white text-sm">
              {connectionState === LiveConnectionState.OPEN ? 'Connected' : 
               isReconnecting ? 'Reconnecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Transcription display */}
      <div className="flex-1 px-4 pb-32 overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/20 rounded-lg p-6 max-h-96 overflow-y-auto">
            <h3 className="text-white text-lg font-medium mb-4">Live Transcription</h3>
            
            {transcriptions.length === 0 && !currentTranscript ? (
              <div className="text-gray-400 text-center py-8">
                Start speaking to see transcriptions...
              </div>
            ) : (
              <div className="space-y-3">
                {transcriptions.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <span className="text-xs text-gray-500 min-w-[80px] mt-1">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                    <p className="text-white text-sm">
                      {entry.text}
                    </p>
                  </div>
                ))}
                
                {/* Current interim transcript */}
                {currentTranscript && (
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-500 min-w-[80px] mt-1">
                      {new Date().toLocaleTimeString()}
                    </span>
                    <p className="text-gray-300 text-sm italic">
                      {currentTranscript}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Microphone control */}
      <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2">
        <div className="text-center">
          <button
            onClick={toggleRecording}
            className={`
              relative p-6 rounded-full transition-all duration-300 transform
              hover:scale-105 active:scale-95 ${getButtonStyle()}
            `}
          >
            {/* Recording pulse effect */}
            {isRecording && (
              <div className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-75" />
            )}
            
            {/* Microphone icon */}
            <div className="relative z-10">
              <svg 
                className="w-8 h-8 text-white" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" 
                  clipRule="evenodd" 
                />
              </svg>
            </div>
          </button>

          {/* Status text */}
          <div className="mt-4">
            <p className={`text-sm font-medium ${
              isRecording ? 'text-red-400' : 
              microphoneState === MicrophoneState.Error ? 'text-yellow-400' :
              canRecord ? 'text-blue-400' : 'text-gray-400'
            }`}>
              {getStatusText()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
