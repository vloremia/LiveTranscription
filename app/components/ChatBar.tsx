"use client";

import { useEffect, useRef } from "react";

interface TranscriptionEntry {
  id: string;
  text: string;
  timestamp: Date;
  isFinal: boolean;
  isFromOffline?: boolean;
}

interface ChatBarProps {
  transcriptions: TranscriptionEntry[];
}

const ChatBar: React.FC<ChatBarProps> = ({ transcriptions }) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Debug: Log transcriptions when they change
  useEffect(() => {
    console.log('ChatBar: Received transcriptions:', transcriptions.length, transcriptions);
    const offlineCount = transcriptions.filter(t => t.isFromOffline).length;
    console.log('ChatBar: Offline transcriptions:', offlineCount);
  }, [transcriptions]);

  // Auto-scroll to bottom when new transcriptions are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [transcriptions]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 max-w-4xl mx-auto px-4 z-10">
      <div className="bg-black/80 backdrop-blur-sm rounded-lg border border-gray-700 max-h-64 overflow-hidden">
        <div className="p-3 border-b border-gray-700">
          <h3 className="text-white text-sm font-medium">Live Transcription</h3>
        </div>
        <div 
          ref={chatContainerRef}
          className="p-3 max-h-48 overflow-y-auto space-y-2"
        >
          {transcriptions.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">
              Start speaking to see transcriptions...
            </div>
          ) : (
            transcriptions.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2">
                <span className="text-xs text-gray-500 min-w-[80px] mt-1">
                  {formatTime(entry.timestamp)}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {entry.isFromOffline && (
                      <span className="text-xs bg-yellow-600/80 text-white px-2 py-1 rounded">
                        📱 Offline
                      </span>
                    )}
                    <p className={`text-sm ${
                      entry.isFinal ? 'text-white' : 'text-gray-300 italic'
                    }`}>
                      {entry.text}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBar; 