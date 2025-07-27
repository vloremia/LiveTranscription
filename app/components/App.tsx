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
import Visualizer from "./Visualizer";
import ChatBar from "./ChatBar";
import MicrophoneControl from "./MicrophoneControl";
import OfflineStatus from "./OfflineStatus";
import OfflineTest from "./OfflineTest";

interface TranscriptionEntry {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
  isFromOffline?: boolean;
}

const App: () => JSX.Element = () => {
  const [caption, setCaption] = useState<string | undefined>(
    "Powered by Deepgram"
  );
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [offlineSegments, setOfflineSegments] = useState<number>(0);
  const [isLoadingOfflineData, setIsLoadingOfflineData] = useState<boolean>(true);
  const { connection, connectToDeepgram, connectionState, isOfflineMode, networkStatus, disconnectFromDeepgram } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, microphoneState } =
    useMicrophone();
  const captionTimeout = useRef<any>();
  const keepAliveInterval = useRef<any>();

  // Load offline transcriptions on mount
  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        await indexedDBService.init();
        offlineTranscriptionService.startAutoSync();
        
        // Load existing offline transcriptions
        const offlineTranscripts = await offlineTranscriptionService.getProcessedTranscripts();
        console.log('Loaded offline transcripts:', offlineTranscripts.length, offlineTranscripts);
        
        const offlineEntries = offlineTranscripts.map(offline => ({
          id: offline.id,
          text: offline.text,
          timestamp: offline.timestamp,
          isFinal: true,
          isFromOffline: true
        }));
        
        setTranscriptions(prev => {
          const newTranscriptions = [...prev, ...offlineEntries];
          console.log('Updated transcriptions with offline data:', newTranscriptions.length, 'total entries');
          return newTranscriptions;
        });
        
        // Get count of pending segments
        const pendingCount = await offlineTranscriptionService.getPendingCount();
        setOfflineSegments(pendingCount);
        console.log('Pending segments count:', pendingCount);
      } catch (error) {
        console.error('Error loading offline data:', error);
      } finally {
        setIsLoadingOfflineData(false);
      }
    };

    loadOfflineData();
  }, []);

  useEffect(() => {
    setupMicrophone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (microphoneState === MicrophoneState.Ready && !isOfflineMode) {
      connectToDeepgram({
        model: "nova-3",
        interim_results: true,
        smart_format: true,
        filler_words: true,
        utterance_end_ms: 3000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState, isOfflineMode]);

  // Handle reconnection when coming back online
  useEffect(() => {
    if (microphoneState === MicrophoneState.Ready && !isOfflineMode && connectionState === LiveConnectionState.CLOSED) {
      console.log('Reconnecting to Deepgram after coming back online...');
      connectToDeepgram({
        model: "nova-3",
        interim_results: true,
        smart_format: true,
        filler_words: true,
        utterance_end_ms: 3000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOfflineMode, connectionState]);

  // Handle disconnection when going offline
  useEffect(() => {
    if (isOfflineMode && connectionState === LiveConnectionState.OPEN) {
      console.log('Going offline, disconnecting from Deepgram...');
      disconnectFromDeepgram();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOfflineMode, connectionState]);

  useEffect(() => {
    if (!microphone) return;
    if (!connection) return;

    const onData = (e: BlobEvent) => {
      // iOS SAFARI FIX:
      // Prevent packetZero from being sent. If sent at size 0, the connection will close. 
      if (e.data.size > 0) {
        if (isOfflineMode) {
          // Store audio segment locally when offline
          indexedDBService.storeAudioSegment(e.data).then((segmentId) => {
            indexedDBService.addPendingTranscript(segmentId);
            setOfflineSegments(prev => prev + 1);
          });
        } else {
          connection?.send(e.data);
        }
      }
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const { is_final: isFinal, speech_final: speechFinal } = data;
      let thisCaption = data.channel.alternatives[0].transcript;

      console.log("thisCaption", thisCaption);
      if (thisCaption !== "") {
        console.log('thisCaption !== ""', thisCaption);
        setCaption(thisCaption);
        
        // Add to transcription history
        const newEntry: TranscriptionEntry = {
          id: `${Date.now()}-${Math.random()}`,
          text: thisCaption,
          timestamp: new Date(),
          isFinal: isFinal || false
        };
        
        setTranscriptions(prev => {
          // If this is a final result, replace the last interim entry
          if (isFinal) {
            const filtered = prev.filter(entry => !entry.isFinal || entry.text !== thisCaption);
            return [...filtered, newEntry];
          } else {
            // For interim results, replace any existing interim entries with the same text
            const filtered = prev.filter(entry => entry.isFinal || entry.text !== thisCaption);
            return [...filtered, newEntry];
          }
        });
      }

      if (isFinal && speechFinal) {
        clearTimeout(captionTimeout.current);
        captionTimeout.current = setTimeout(() => {
          setCaption(undefined);
          clearTimeout(captionTimeout.current);
        }, 3000);
      }
    };

    if (connectionState === LiveConnectionState.OPEN) {
      connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.addEventListener(MicrophoneEvents.DataAvailable, onData);
    }

    return () => {
      // prettier-ignore
      connection.removeListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData);
      clearTimeout(captionTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);

  useEffect(() => {
    if (!connection) return;

    if (
      microphoneState !== MicrophoneState.Open &&
      connectionState === LiveConnectionState.OPEN
    ) {
      connection.keepAlive();

      keepAliveInterval.current = setInterval(() => {
        connection.keepAlive();
      }, 10000);
    } else {
      clearInterval(keepAliveInterval.current);
    }

    return () => {
      clearInterval(keepAliveInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState, connectionState]);

  // Handle coming back online - sync offline segments
  useEffect(() => {
    if (!isOfflineMode && offlineSegments > 0) {
      console.log(`Coming back online, processing ${offlineSegments} offline segments...`);
      offlineTranscriptionService.processPendingTranscripts().then((result) => {
        if (result.processedCount > 0) {
          setOfflineSegments(prev => Math.max(0, prev - result.processedCount));
          // Get only the newly processed transcripts by comparing with existing ones
          offlineTranscriptionService.getProcessedTranscripts().then((offlineTranscripts) => {
            console.log('Syncing: Got processed transcripts:', offlineTranscripts.length);
            setTranscriptions(prev => {
              // Get existing offline transcript IDs to avoid duplicates
              const existingOfflineIds = new Set(
                prev.filter(t => t.isFromOffline).map(t => t.id)
              );
              
              // Filter out transcripts that are already in the state
              const newTranscripts = offlineTranscripts
                .filter(offline => !existingOfflineIds.has(offline.id))
                .map(offline => ({
                  id: offline.id,
                  text: offline.text,
                  timestamp: offline.timestamp,
                  isFinal: true,
                  isFromOffline: true
                }));
              
              console.log('Syncing: Adding new transcripts:', newTranscripts.length, newTranscripts);
              const updatedTranscriptions = [...prev, ...newTranscripts];
              console.log('Syncing: Total transcriptions after sync:', updatedTranscriptions.length);
              return updatedTranscriptions;
            });
          });
        }
      });
    }
  }, [isOfflineMode, offlineSegments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      offlineTranscriptionService.cleanup();
    };
  }, []);

  // Periodic check to sync offline segments count
  useEffect(() => {
    const updateOfflineCount = async () => {
      try {
        const pendingCount = await offlineTranscriptionService.getPendingCount();
        setOfflineSegments(pendingCount);
      } catch (error) {
        console.error('Error updating offline count:', error);
      }
    };

    // Update count every 10 seconds
    const interval = setInterval(updateOfflineCount, 10000);
    
    return () => clearInterval(interval);
  }, []);

  if (isLoadingOfflineData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading offline transcriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <OfflineStatus offlineSegments={offlineSegments} />
      <OfflineTest />
      <div className="flex h-full antialiased">
        <div className="flex flex-row h-full w-full overflow-x-hidden">
          <div className="flex flex-col flex-auto h-full">
            {/* height 100% minus 8rem */}
            <div className="relative w-full h-full">
              {microphone && <Visualizer microphone={microphone} />}
              <div className="absolute bottom-[8rem]  inset-x-0 max-w-4xl mx-auto text-center">
                {caption && <span className="bg-black/70 p-8">{caption}</span>}
                {isOfflineMode && (
                  <div className="mt-4">
                    <span className="bg-yellow-600/80 text-white px-4 py-2 rounded-lg">
                      🔴 Offline Mode - Recording locally ({offlineSegments} segments)
                    </span>
                  </div>
                )}
                {!isOfflineMode && offlineSegments > 0 && (
                  <div className="mt-4">
                    <span className="bg-green-600/80 text-white px-4 py-2 rounded-lg">
                      🟢 Syncing {offlineSegments} offline segments...
                    </span>
                  </div>
                )}
                {!isOfflineMode && offlineSegments === 0 && networkStatus.isOnline && (
                  <div className="mt-4">
                    <span className="bg-blue-600/80 text-white px-4 py-2 rounded-lg">
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
