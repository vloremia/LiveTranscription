"use client";

import {
  createClient,
  LiveClient,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveSchema,
  type LiveTranscriptionEvent,
} from "@deepgram/sdk";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
  FunctionComponent,
} from "react";

interface DeepgramContextType {
  connection: LiveClient | null;
  connectToDeepgram: (options: LiveSchema) => Promise<void>;
  disconnectFromDeepgram: () => void;
  connectionState: LiveConnectionState;
  isReconnecting: boolean;
}

const DeepgramContext = createContext<DeepgramContextType | undefined>(
  undefined
);

interface DeepgramContextProviderProps {
  children: ReactNode;
}

const getToken = async (): Promise<string> => {
  try {
    console.log("Requesting Deepgram authentication token...");
    const response = await fetch("/api/authenticate", { cache: "no-store" });
    
    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("Authentication response received");
    
    if (result.access_token) return result.access_token;
    if (result.key) return result.key;
    if (result.error) {
      throw new Error(`Authentication error: ${result.error}`);
    }
    
    throw new Error("Unexpected authentication response format");
  } catch (error) {
    console.error("Authentication failed:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
};

const DeepgramContextProvider: FunctionComponent<
  DeepgramContextProviderProps
> = ({ children }) => {
  const [connection, setConnection] = useState<LiveClient | null>(null);
  const [connectionState, setConnectionState] = useState<LiveConnectionState>(
    LiveConnectionState.CLOSED
  );
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  // Store connection options for reconnection
  const connectionOptionsRef = useRef<LiveSchema | null>(null);
  const reconnectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const attemptReconnection = useCallback(async (): Promise<void> => {
    if (isReconnecting || !connectionOptionsRef.current) {
      return;
    }

    setIsReconnecting(true);
    console.log("Attempting to reconnect to Deepgram...");

    // Wait 2 seconds before attempting reconnection
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      await performConnection(connectionOptionsRef.current);
      console.log("Reconnection successful");
    } catch (error) {
      console.error("Reconnection failed:", error);
      // Try again after 5 seconds
      reconnectionTimeoutRef.current = setTimeout(() => {
        attemptReconnection();
      }, 5000);
    } finally {
      setIsReconnecting(false);
    }
  }, [isReconnecting]);

  const performConnection = useCallback(async (options: LiveSchema): Promise<void> => {
    console.log("Connecting to Deepgram...");
    setConnectionState(LiveConnectionState.CONNECTING);
    
    try {
      const token = await getToken();
      const deepgram = createClient({ accessToken: token });
      const conn = deepgram.listen.live(options);
      
      return new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          console.error("Connection timeout after 10 seconds");
          reject(new Error("Connection timeout"));
        }, 10000);

        const cleanup = () => {
          clearTimeout(connectionTimeout);
        };

        setConnection(conn);

        conn.addListener(LiveTranscriptionEvents.Open, () => {
          cleanup();
          setConnectionState(LiveConnectionState.OPEN);
          console.log("Deepgram connection established successfully");
          resolve();
        });

        conn.addListener(LiveTranscriptionEvents.Close, (event) => {
          cleanup();
          console.log("Deepgram connection closed:", event?.code, event?.reason);
          setConnectionState(LiveConnectionState.CLOSED);
          
          // Attempt reconnection if this wasn't an expected closure
          if (connectionOptionsRef.current) {
            attemptReconnection();
          }
          
          reject(new Error(`Connection closed: ${event?.code} ${event?.reason || 'No reason provided'}`));
        });

        conn.addListener(LiveTranscriptionEvents.Error, (error) => {
          cleanup();
          console.error("Deepgram connection error:", error);
          setConnectionState(LiveConnectionState.CLOSED);
          
          // Attempt reconnection on error
          if (connectionOptionsRef.current) {
            attemptReconnection();
          }
          
          reject(error instanceof Error ? error : new Error(String(error)));
        });

        conn.addListener(LiveTranscriptionEvents.Metadata, (metadata) => {
          console.log("Deepgram metadata received:", metadata);
        });
      });
    } catch (error) {
      console.error("Error during connection setup:", error);
      setConnectionState(LiveConnectionState.CLOSED);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }, [attemptReconnection]);

  const connectToDeepgram = useCallback(async (options: LiveSchema) => {
    // Store options for reconnection
    connectionOptionsRef.current = options;

    // Clear any existing reconnection timeout
    if (reconnectionTimeoutRef.current) {
      clearTimeout(reconnectionTimeoutRef.current);
      reconnectionTimeoutRef.current = null;
    }

    try {
      await performConnection(options);
    } catch (error) {
      console.error("Initial connection failed:", error);
      // Attempt reconnection
      attemptReconnection();
    }
  }, [performConnection, attemptReconnection]);

  const disconnectFromDeepgram = useCallback(() => {
    console.log("Disconnecting from Deepgram...");
    
    // Clear reconnection timeout and options to prevent automatic reconnection
    if (reconnectionTimeoutRef.current) {
      clearTimeout(reconnectionTimeoutRef.current);
      reconnectionTimeoutRef.current = null;
    }
    connectionOptionsRef.current = null;

    // Close connection
    if (connection) {
      try {
        connection.finish();
      } catch (error) {
        console.error("Error finishing connection:", error);
      }
      setConnection(null);
    }
    
    setConnectionState(LiveConnectionState.CLOSED);
    setIsReconnecting(false);
  }, [connection]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (reconnectionTimeoutRef.current) {
        clearTimeout(reconnectionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <DeepgramContext.Provider
      value={{
        connection,
        connectToDeepgram,
        disconnectFromDeepgram,
        connectionState,
        isReconnecting,
      }}
    >
      {children}
    </DeepgramContext.Provider>
  );
};

function useDeepgram(): DeepgramContextType {
  const context = useContext(DeepgramContext);
  if (context === undefined) {
    throw new Error(
      "useDeepgram must be used within a DeepgramContextProvider"
    );
  }
  return context;
}

export {
  DeepgramContextProvider,
  useDeepgram,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveTranscriptionEvent,
};
