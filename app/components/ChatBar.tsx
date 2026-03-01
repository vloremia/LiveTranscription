"use client";

import { useEffect, useRef } from "react";
import { DownloadIcon } from "./icons/DownloadIcon";

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

const ChatBar = ({ transcriptions }: ChatBarProps) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [transcriptions]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const handleDownload = () => {
    if (transcriptions.length === 0) {
      return;
    }

    const lines = transcriptions.map((entry) => {
      const statusLabel = entry.isFromOffline ? "OFFLINE" : entry.isFinal ? "FINAL" : "INTERIM";
      return `[${formatTime(entry.timestamp)}] (${statusLabel}) ${entry.text}`;
    });

    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `transcript-${timestamp}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 z-10 mx-auto max-w-4xl px-4">
      <div className="max-h-64 overflow-hidden rounded-lg border border-gray-700 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-gray-700 p-3">
          <h3 className="text-sm font-medium text-white">Live Transcription</h3>
          <button
            type="button"
            onClick={handleDownload}
            disabled={transcriptions.length === 0}
            className="inline-flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Download transcript"
          >
            <DownloadIcon className="h-3 w-3" />
            Export
          </button>
        </div>
        <div ref={chatContainerRef} className="max-h-48 space-y-2 overflow-y-auto p-3">
          {transcriptions.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-400">
              Start speaking to see transcriptions...
            </div>
          ) : (
            transcriptions.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2">
                <span className="mt-1 min-w-[80px] text-xs text-gray-500">
                  {formatTime(entry.timestamp)}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {entry.isFromOffline && (
                      <span className="rounded bg-yellow-600/80 px-2 py-1 text-xs text-white">
                        📱 Offline
                      </span>
                    )}
                    <p className={`text-sm ${entry.isFinal ? "text-white" : "italic text-gray-300"}`}>
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
