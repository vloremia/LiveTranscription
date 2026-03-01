export interface NetworkStatus {
  isOnline: boolean;
  lastChecked: Date;
}

interface INetworkService {
  getStatus(): NetworkStatus;
  addListener(listener: (status: NetworkStatus) => void): void;
  removeListener(listener: (status: NetworkStatus) => void): void;
  checkConnectivity(): Promise<boolean>;
  setOfflineMode(offline: boolean): void;
}

class NetworkService implements INetworkService {
  private isOnline: boolean = false;
  private listeners: ((status: NetworkStatus) => void)[] = [];
  private isInitialized: boolean = false;

  constructor() {
    // Don't initialize during SSR
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    if (this.isInitialized) return;
    
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
    this.isInitialized = true;
  }

  private setupEventListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });
  }

  private notifyListeners() {
    const status: NetworkStatus = {
      isOnline: this.isOnline,
      lastChecked: new Date()
    };
    
    this.listeners.forEach(listener => listener(status));
  }

  getStatus(): NetworkStatus {
    // Initialize if not already done (for client-side calls)
    if (typeof window !== 'undefined' && !this.isInitialized) {
      this.initialize();
    }

    return {
      isOnline: this.isOnline,
      lastChecked: new Date()
    };
  }

  addListener(listener: (status: NetworkStatus) => void) {
    this.listeners.push(listener);
    // Initialize if not already done
    if (typeof window !== 'undefined' && !this.isInitialized) {
      this.initialize();
    }
    // Immediately notify with current status
    listener(this.getStatus());
  }

  removeListener(listener: (status: NetworkStatus) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  async checkConnectivity(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      // Try to fetch a small resource to test connectivity
      const response = await fetch('/api/authenticate', { 
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      this.isOnline = response.ok;
    } catch (error) {
      this.isOnline = false;
    } finally {
      clearTimeout(timeout);
    }
    
    this.notifyListeners();
    return this.isOnline;
  }

  // For testing purposes - manually set offline mode
  setOfflineMode(offline: boolean) {
    this.isOnline = !offline;
    this.notifyListeners();
  }
}

// Create a singleton instance
let networkServiceInstance: NetworkService | null = null;

export const networkService: INetworkService = (() => {
  if (typeof window !== 'undefined') {
    // Only create instance on client side
    if (!networkServiceInstance) {
      networkServiceInstance = new NetworkService();
    }
    return networkServiceInstance;
  } else {
    // Return a mock service for SSR
    return {
      getStatus: () => ({ isOnline: false, lastChecked: new Date() }),
      addListener: () => {},
      removeListener: () => {},
      checkConnectivity: async () => false,
      setOfflineMode: () => {}
    };
  }
})();
