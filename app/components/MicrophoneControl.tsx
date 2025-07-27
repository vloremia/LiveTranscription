"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { MicrophoneState, useMicrophone } from "../context/MicrophoneContextProvider";
import { LiveConnectionState, useDeepgram } from "../context/DeepgramContextProvider";
import { MicrophoneIcon } from "./icons/MicrophoneIcon";

const MicrophoneControl = () => {
  const { microphoneState, startMicrophone, stopMicrophone } = useMicrophone();
  const { connectionState, isOfflineMode } = useDeepgram();
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    setIsRecording(microphoneState === MicrophoneState.Open);
  }, [microphoneState]);

  const isReady = useMemo(() => 
    microphoneState === MicrophoneState.Ready || 
    microphoneState === MicrophoneState.Open || 
    microphoneState === MicrophoneState.Paused,
    [microphoneState]
  );

  const isConnected = useMemo(() => 
    connectionState === LiveConnectionState.OPEN || 
    connectionState === LiveConnectionState.CONNECTING || 
    isOfflineMode,
    [connectionState, isOfflineMode]
  );

  const isConnecting = useMemo(() => 
    connectionState === LiveConnectionState.CONNECTING && !isOfflineMode,
    [connectionState, isOfflineMode]
  );

  // Keyboard shortcut for spacebar
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space' && isReady && isConnected) {
      event.preventDefault();
      if (isRecording) {
        stopMicrophone();
      } else {
        startMicrophone();
      }
    }
  }, [isReady, isConnected, isRecording, startMicrophone, stopMicrophone]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  const handleToggleRecording = () => {
    if (isRecording) {
      stopMicrophone();
    } else {
      startMicrophone();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-20">
      <div className="text-center">
        <button
          onClick={handleToggleRecording}
          disabled={!isReady || !isConnected}
          className={`
            relative p-8 rounded-full transition-all duration-300 ease-in-out
            ${isRecording 
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50' 
              : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/50'
            }
            ${!isReady || !isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            transform hover:scale-105 active:scale-95
          `}
        >
          {/* Recording pulse effect */}
          {isRecording && (
            <div className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-75"></div>
          )}
          
          {/* Main button content */}
          <div className="relative z-10">
            <MicrophoneIcon 
              micOpen={!isRecording}
              className={`w-12 h-12 transition-colors duration-300`} 
            />
          </div>

          {/* Status indicator */}
          <div className={`
            absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-3 border-white
            ${isRecording ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}
          `}></div>
        </button>

        {/* Status text */}
        <div className="mt-4 text-center">
          <p className={`text-lg font-medium ${
            isRecording ? 'text-red-400' : 'text-gray-400'
          }`}>
            {isConnecting ? 'Connecting...' : !isConnected ? 'Disconnected' : isRecording ? 'Recording...' : 'Click or press Space'}
          </p>
          {isOfflineMode && (
            <p className="text-sm text-yellow-400 mt-2">
              🔴 Offline Mode - Recording locally
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MicrophoneControl; 