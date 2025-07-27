"use client";

import { useDeepgram } from "../context/DeepgramContextProvider";

interface OfflineStatusProps {
  offlineSegments: number;
}

const OfflineStatus: React.FC<OfflineStatusProps> = ({ offlineSegments }) => {
  const { isOfflineMode, networkStatus } = useDeepgram();

  if (!isOfflineMode && offlineSegments === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-30">
      {isOfflineMode && (
        <div className="bg-yellow-600/90 text-white px-4 py-2 rounded-lg shadow-lg mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Offline Mode</span>
          </div>
          <div className="text-xs mt-1">
            Recording locally ({offlineSegments} segments)
          </div>
        </div>
      )}
      
      {!isOfflineMode && offlineSegments > 0 && (
        <div className="bg-green-600/90 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Syncing...</span>
          </div>
          <div className="text-xs mt-1">
            Processing {offlineSegments} offline segments
          </div>
        </div>
      )}
      
      <div className="text-xs text-gray-500 mt-1">
        Last checked: {networkStatus.lastChecked.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default OfflineStatus; 