"use client";

import {
  createClient,
  LiveClient,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveSchema,
  type LiveTranscriptionEvent,
} from "@deepgram/sdk";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { networkService, NetworkStatus } from "../services/NetworkService";

interface DeepgramContextType {
  connection: LiveClient | null;
  connectToDeepgram: (options: LiveSchema, endpoint?: string) => Promise<void>;
  disconnectFromDeepgram: () => Promise<void>;
  connectionState: LiveConnectionState;
  isOfflineMode: boolean;
  networkStatus: NetworkStatus;
}

const DeepgramContext = createContext<DeepgramContextType | undefined>(
  undefined
);

interface DeepgramContextProviderProps {
  children: ReactNode;
}

const getToken = async (): Promise<string> => {
  const response = await fetch("/api/authenticate", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to authenticate with Deepgram: ${response.status}`);
  }
  const result = await response.json();
  if (!result.access_token) {
    throw new Error("Missing Deepgram access token");
  }
  return result.access_token;
};

const DeepgramContextProvider = ({ children }: DeepgramContextProviderProps) => {
  const [connection, setConnection] = useState<LiveClient | null>(null);
  const [connectionState, setConnectionState] = useState<LiveConnectionState>(
    LiveConnectionState.CLOSED
  );
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(
    networkService.getStatus()
  );
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(!networkStatus.isOnline);
  const connectionRef = useRef<LiveClient | null>(null);

  // Listen for network status changes
  useEffect(() => {
    const handleNetworkChange = (status: NetworkStatus) => {
      setNetworkStatus(status);
      setIsOfflineMode(!status.isOnline);
    };

    networkService.addListener(handleNetworkChange);
    return () => networkService.removeListener(handleNetworkChange);
  }, []);

  /**
   * Connects to the Deepgram speech recognition service and sets up a live transcription session.
   *
   * @param options - The configuration options for the live transcription session.
   * @param endpoint - The optional endpoint URL for the Deepgram service.
   * @returns A Promise that resolves when the connection is established.
   */
  const connectToDeepgram = useCallback(
    async (options: LiveSchema, endpoint?: string) => {
      if (isOfflineMode) {
        return;
      }

      if (connectionRef.current) {
        connectionRef.current.finish();
      }

      setConnectionState(LiveConnectionState.CONNECTING);

      try {
        const token = await getToken();
        const deepgram = createClient({ accessToken: token });
        const conn = deepgram.listen.live(options, endpoint);

        conn.addListener(LiveTranscriptionEvents.Open, () => {
          if (connectionRef.current === conn) {
            setConnectionState(LiveConnectionState.OPEN);
          }
        });

        conn.addListener(LiveTranscriptionEvents.Close, () => {
          if (connectionRef.current === conn) {
            connectionRef.current = null;
            setConnection(null);
            setConnectionState(LiveConnectionState.CLOSED);
          }
        });

        connectionRef.current = conn;
        setConnection(conn);
      } catch (error) {
        console.error("Failed to connect to Deepgram:", error);
        connectionRef.current = null;
        setConnection(null);
        setConnectionState(LiveConnectionState.CLOSED);
      }
    },
    [isOfflineMode]
  );

  const disconnectFromDeepgram = useCallback(async () => {
    if (connectionRef.current) {
      connectionRef.current.finish();
      connectionRef.current = null;
    }
    setConnection(null);
    setConnectionState(LiveConnectionState.CLOSED);
  }, []);

  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.finish();
        connectionRef.current = null;
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
        isOfflineMode,
        networkStatus,
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
