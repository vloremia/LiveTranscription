"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
  useRef,
  useEffect,
} from "react";

interface MicrophoneContextType {
  microphone: MediaRecorder | null;
  startMicrophone: () => void;
  stopMicrophone: () => void;
  setupMicrophone: () => void;
  microphoneState: MicrophoneState | null;
}

export enum MicrophoneEvents {
  DataAvailable = "dataavailable",
  Error = "error",
  Pause = "pause",
  Resume = "resume",
  Start = "start",
  Stop = "stop",
}

export enum MicrophoneState {
  NotSetup = -1,
  SettingUp = 0,
  Ready = 1,
  Opening = 2,
  Open = 3,
  Error = 4,
  Pausing = 5,
  Paused = 6,
}

const MicrophoneContext = createContext<MicrophoneContextType | undefined>(
  undefined
);

interface MicrophoneContextProviderProps {
  children: ReactNode;
}

const MicrophoneContextProvider: React.FC<MicrophoneContextProviderProps> = ({
  children,
}) => {
  const [microphoneState, setMicrophoneState] = useState<MicrophoneState>(
    MicrophoneState.NotSetup
  );
  const [microphone, setMicrophone] = useState<MediaRecorder | null>(null);

  const setupMicrophone = useCallback(async () => {
    console.log('🎤 Starting microphone setup...');
    
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('🎤 getUserMedia is not supported in this browser');
      setMicrophoneState(MicrophoneState.Error);
      throw new Error('getUserMedia is not supported in this browser');
    }

    // Cleanup existing microphone if any
    if (microphone) {
      try {
        if (microphone.state === "recording") {
          microphone.stop();
        }
        // Stop all tracks from the previous stream
        microphone.stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn('Error cleaning up existing microphone:', error);
      }
    }

    setMicrophoneState(MicrophoneState.SettingUp);

    try {
      console.log('🎤 Requesting user media...');
      
      const userMedia = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
        },
      });

      console.log('🎤 User media obtained successfully');

      const newMicrophone = new MediaRecorder(userMedia);

      // Set up event listeners for the MediaRecorder
      newMicrophone.addEventListener('dataavailable', (event) => {
        console.log('Audio data available:', event.data.size, 'bytes');
      });

      newMicrophone.addEventListener('start', () => {
        console.log('MediaRecorder started');
        setMicrophoneState(MicrophoneState.Open);
      });

      newMicrophone.addEventListener('stop', () => {
        console.log('MediaRecorder stopped');
        setMicrophoneState(MicrophoneState.Ready);
      });

      newMicrophone.addEventListener('pause', () => {
        console.log('MediaRecorder paused');
        setMicrophoneState(MicrophoneState.Paused);
      });

      newMicrophone.addEventListener('resume', () => {
        console.log('MediaRecorder resumed');
        setMicrophoneState(MicrophoneState.Open);
      });

      newMicrophone.addEventListener('error', (event) => {
        console.error('MediaRecorder error:', event);
        setMicrophoneState(MicrophoneState.Error);
      });

      console.log('🎤 Microphone setup completed successfully');
      setMicrophoneState(MicrophoneState.Ready);
      setMicrophone(newMicrophone);
    } catch (err: any) {
      console.error('🎤 Microphone setup failed:', err);
      setMicrophoneState(MicrophoneState.Error);
      throw err;
    }
  }, [microphone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup microphone
      if (microphone) {
        try {
          if (microphone.state === "recording") {
            microphone.stop();
          }
          microphone.stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          console.warn('Error cleaning up microphone on unmount:', error);
        }
      }
    };
  }, [microphone]);

  const stopMicrophone = useCallback(() => {
    setMicrophoneState(MicrophoneState.Pausing);

    if (microphone?.state === "recording") {
      microphone.pause();
      // State will be set to Paused by the event listener
    }
  }, [microphone]);

  const startMicrophone = useCallback(() => {
    setMicrophoneState(MicrophoneState.Opening);

    if (microphone?.state === "paused") {
      microphone.resume();
      // State will be set to Open by the event listener
    } else {
      microphone?.start(250);
      // State will be set to Open by the event listener
    }
  }, [microphone]);

  return (
    <MicrophoneContext.Provider
      value={{
        microphone,
        startMicrophone,
        stopMicrophone,
        setupMicrophone,
        microphoneState,
      }}
    >
      {children}
    </MicrophoneContext.Provider>
  );
};

function useMicrophone(): MicrophoneContextType {
  const context = useContext(MicrophoneContext);

  if (context === undefined) {
    throw new Error(
      "useMicrophone must be used within a MicrophoneContextProvider"
    );
  }

  return context;
}

export { MicrophoneContextProvider, useMicrophone };
