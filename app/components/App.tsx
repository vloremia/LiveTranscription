"use client";

import { useEffect, useRef, useState } from "react";
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
import { indexedDBService } from "../services/IndexedDBService";
import { offlineTranscriptionService } from "../services/OfflineTranscriptionService";
import ChatBar from "./ChatBar";
import MicrophoneControl from "./MicrophoneControl";
import OfflineStatus from "./OfflineStatus";
import OfflineTest from "./OfflineTest";
import Visualizer from "./Visualizer";

interface TranscriptionEntry {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
  isFromOffline?: boolean;
}

const MAX_TRANSCRIPTIONS = 300;
const OFFLINE_COUNT_REFRESH_MS = 10000;
const CAPTION_CLEAR_DELAY_MS = 3000;
const KEEP_ALIVE_INTERVAL_MS = 10000;

const LIVE_CONNECTION_OPTIONS = {
  model: "nova-3",
  interim_results: true,
  smart_format: true,
  filler_words: true,
  utterance_end_ms: 3000,
};

const createEntryId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
};

const normalizeTimestamp = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

const sortAndLimitTranscriptions = (
  entries: TranscriptionEntry[]
): TranscriptionEntry[] =>
  [...entries]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .slice(-MAX_TRANSCRIPTIONS);

const mapOfflineEntries = (
  offlineTranscripts: Array<{ id: string; text: string; timestamp: Date | string }>
): TranscriptionEntry[] =>
  offlineTranscripts.map((offline) => ({
    id: offline.id,
    text: offline.text,
    timestamp: normalizeTimestamp(offline.timestamp),
    isFinal: true,
    isFromOffline: true,
  }));

const mergeOfflineTranscriptions = (
  previous: TranscriptionEntry[],
  incomingOfflineEntries: TranscriptionEntry[]
): TranscriptionEntry[] => {
  const existingOfflineIds = new Set(
    previous.filter((entry) => entry.isFromOffline).map((entry) => entry.id)
  );

  const newEntries = incomingOfflineEntries.filter(
    (entry) => !existingOfflineIds.has(entry.id)
  );

  if (newEntries.length === 0) {
    return previous;
  }

  return sortAndLimitTranscriptions([...previous, ...newEntries]);
};

const App: () => JSX.Element = () => {
  const [caption, setCaption] = useState<string | undefined>(
    "Powered by Deepgram"
  );
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [offlineSegments, setOfflineSegments] = useState<number>(0);
  const [isLoadingOfflineData, setIsLoadingOfflineData] = useState<boolean>(true);
  const {
    connection,
    connectToDeepgram,
    connectionState,
    isOfflineMode,
    networkStatus,
    disconnectFromDeepgram,
  } = useDeepgram();
  const { setupMicrophone, microphone, microphoneState } = useMicrophone();
  const captionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        await indexedDBService.init();
        await offlineTranscriptionService.startAutoSync();

        const offlineTranscripts =
          await offlineTranscriptionService.getProcessedTranscripts();
        setTranscriptions((prev) =>
          mergeOfflineTranscriptions(prev, mapOfflineEntries(offlineTranscripts))
        );

        const pendingCount = await offlineTranscriptionService.getPendingCount();
        setOfflineSegments(pendingCount);
      } catch (error) {
        console.error("Error loading offline data:", error);
      } finally {
        setIsLoadingOfflineData(false);
      }
    };

    void loadOfflineData();
  }, []);

  useEffect(() => {
    void setupMicrophone();
  }, [setupMicrophone]);

  useEffect(() => {
    if (microphoneState !== MicrophoneState.Ready || isOfflineMode) {
      return;
    }

    if (
      connectionState === LiveConnectionState.OPEN ||
      connectionState === LiveConnectionState.CONNECTING
    ) {
      return;
    }

    void connectToDeepgram(LIVE_CONNECTION_OPTIONS);
  }, [microphoneState, isOfflineMode, connectionState, connectToDeepgram]);

  useEffect(() => {
    if (
      isOfflineMode &&
      (connectionState === LiveConnectionState.OPEN ||
        connectionState === LiveConnectionState.CONNECTING)
    ) {
      void disconnectFromDeepgram();
    }
  }, [isOfflineMode, connectionState, disconnectFromDeepgram]);

  useEffect(() => {
    if (!microphone) {
      return;
    }

    const onData = async (e: BlobEvent) => {
      // iOS Safari fix: avoid sending packetZero because it can close the stream.
      if (e.data.size <= 0) {
        return;
      }

      const shouldStoreOffline =
        isOfflineMode ||
        connectionState !== LiveConnectionState.OPEN ||
        !connection;

      if (shouldStoreOffline) {
        try {
          const segmentId = await indexedDBService.storeAudioSegment(e.data);
          await indexedDBService.addPendingTranscript(segmentId);
          setOfflineSegments((prev) => prev + 1);
        } catch (error) {
          console.error("Failed to store offline audio segment:", error);
        }
        return;
      }

      connection.send(e.data);
    };

    microphone.addEventListener(MicrophoneEvents.DataAvailable, onData);
    return () => {
      microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData);
    };
  }, [microphone, connection, connectionState, isOfflineMode]);

  useEffect(() => {
    if (!connection || connectionState !== LiveConnectionState.OPEN) {
      return;
    }

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const { is_final: isFinal, speech_final: speechFinal } = data;
      const thisCaption = data.channel.alternatives?.[0]?.transcript?.trim() ?? "";

      if (!thisCaption) {
        return;
      }

      setCaption(thisCaption);

      const now = new Date();
      setTranscriptions((prev) => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        const lastEntry = next[lastIndex];

        if (isFinal) {
          const newEntry: TranscriptionEntry = {
            id: createEntryId(),
            text: thisCaption,
            timestamp: now,
            isFinal: true,
          };

          if (lastEntry && !lastEntry.isFinal && !lastEntry.isFromOffline) {
            next[lastIndex] = newEntry;
          } else if (
            !(
              lastEntry &&
              lastEntry.isFinal &&
              !lastEntry.isFromOffline &&
              lastEntry.text === thisCaption
            )
          ) {
            next.push(newEntry);
          }
        } else if (lastEntry && !lastEntry.isFinal && !lastEntry.isFromOffline) {
          next[lastIndex] = {
            ...lastEntry,
            text: thisCaption,
            timestamp: now,
          };
        } else {
          next.push({
            id: createEntryId(),
            text: thisCaption,
            timestamp: now,
            isFinal: false,
          });
        }

        return sortAndLimitTranscriptions(next);
      });

      if (isFinal && speechFinal) {
        if (captionTimeout.current) {
          clearTimeout(captionTimeout.current);
        }

        captionTimeout.current = setTimeout(() => {
          setCaption(undefined);
          if (captionTimeout.current) {
            clearTimeout(captionTimeout.current);
            captionTimeout.current = null;
          }
        }, CAPTION_CLEAR_DELAY_MS);
      }
    };

    connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);

    return () => {
      connection.removeListener(LiveTranscriptionEvents.Transcript, onTranscript);
      if (captionTimeout.current) {
        clearTimeout(captionTimeout.current);
      }
    };
  }, [connection, connectionState]);

  useEffect(() => {
    if (!connection) {
      return;
    }

    if (
      microphoneState !== MicrophoneState.Open &&
      connectionState === LiveConnectionState.OPEN
    ) {
      connection.keepAlive();

      keepAliveInterval.current = setInterval(() => {
        connection.keepAlive();
      }, KEEP_ALIVE_INTERVAL_MS);
    } else if (keepAliveInterval.current) {
      clearInterval(keepAliveInterval.current);
      keepAliveInterval.current = null;
    }

    return () => {
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
        keepAliveInterval.current = null;
      }
    };
  }, [microphoneState, connectionState, connection]);

  useEffect(() => {
    if (isOfflineMode || offlineSegments <= 0) {
      return;
    }

    let isCancelled = false;

    const syncOfflineSegments = async () => {
      try {
        const result = await offlineTranscriptionService.processPendingTranscripts();
        if (isCancelled) {
          return;
        }

        const [pendingCount, offlineTranscripts] = await Promise.all([
          offlineTranscriptionService.getPendingCount(),
          offlineTranscriptionService.getProcessedTranscripts(),
        ]);

        if (isCancelled) {
          return;
        }

        setOfflineSegments(pendingCount);
        setTranscriptions((prev) =>
          mergeOfflineTranscriptions(prev, mapOfflineEntries(offlineTranscripts))
        );

        if (!result.success && result.errors.length > 0) {
          console.error("Offline sync completed with errors:", result.errors);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to sync offline transcripts:", error);
        }
      }
    };

    void syncOfflineSegments();

    return () => {
      isCancelled = true;
    };
  }, [isOfflineMode, offlineSegments]);

  useEffect(() => {
    return () => {
      offlineTranscriptionService.stopAutoSync();
      if (captionTimeout.current) {
        clearTimeout(captionTimeout.current);
      }
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    const updateOfflineCount = async () => {
      try {
        const pendingCount = await offlineTranscriptionService.getPendingCount();
        setOfflineSegments(pendingCount);
      } catch (error) {
        console.error("Error updating offline count:", error);
      }
    };

    const interval = setInterval(updateOfflineCount, OFFLINE_COUNT_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  if (isLoadingOfflineData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
          <p className="text-white">Loading offline transcriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <OfflineStatus offlineSegments={offlineSegments} />
      {process.env.NODE_ENV === "development" && <OfflineTest />}
      <div className="flex h-full antialiased">
        <div className="flex h-full w-full flex-row overflow-x-hidden">
          <div className="flex h-full flex-auto flex-col">
            <div className="relative h-full w-full">
              {microphone && <Visualizer microphone={microphone} />}
              <div className="absolute inset-x-0 bottom-[8rem] mx-auto max-w-4xl text-center">
                {caption && <span className="bg-black/70 p-8">{caption}</span>}
                {isOfflineMode && (
                  <div className="mt-4">
                    <span className="rounded-lg bg-yellow-600/80 px-4 py-2 text-white">
                      🔴 Offline Mode - Recording locally ({offlineSegments} segments)
                    </span>
                  </div>
                )}
                {!isOfflineMode && offlineSegments > 0 && (
                  <div className="mt-4">
                    <span className="rounded-lg bg-green-600/80 px-4 py-2 text-white">
                      🟢 Syncing {offlineSegments} offline segments...
                    </span>
                  </div>
                )}
                {!isOfflineMode && offlineSegments === 0 && networkStatus.isOnline && (
                  <div className="mt-4">
                    <span className="rounded-lg bg-blue-600/80 px-4 py-2 text-white">
                      🟢 Online - Connected to Deepgram
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ChatBar transcriptions={transcriptions} />
      <MicrophoneControl />
    </>
  );
};

export default App;
