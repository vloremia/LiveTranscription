"use client";

import { networkService } from "../services/NetworkService";
import { useDeepgram } from "../context/DeepgramContextProvider";

const OfflineTest: React.FC = () => {
  const { isOfflineMode, networkStatus } = useDeepgram();

  const toggleOfflineMode = () => {
    networkService.setOfflineMode(!isOfflineMode);
  };

  return (
    <div className="fixed bottom-4 left-4 z-30">
      <div className="bg-gray-800/90 text-white p-4 rounded-lg shadow-lg">
        <h3 className="text-sm font-medium mb-2">Offline Test Controls</h3>
        <div className="space-y-2">
          <div className="text-xs">
            Status: {isOfflineMode ? '🔴 Offline' : '🟢 Online'}
          </div>
          <button
            onClick={toggleOfflineMode}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
          >
            Toggle {isOfflineMode ? 'Online' : 'Offline'} Mode
          </button>
          <div className="text-xs text-gray-400">
            Last checked: {networkStatus.lastChecked.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineTest; 