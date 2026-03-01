export interface AudioSegment {
  id: string;
  audioBlob: Blob;
  timestamp: Date;
  isProcessed: boolean;
  transcript?: string;
}

export interface PendingTranscript {
  id: string;
  audioSegmentId: string;
  timestamp: Date;
  retryCount: number;
}

class IndexedDBService {
  private dbName = 'LiveTranscriptionDB';
  private version = 2; // Increment version to trigger migration
  private db: IDBDatabase | null = null;

  private createId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random()}`;
  }

  private waitForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        // Handle data migration after database is initialized
        this.migrateDataIfNeeded().then(() => resolve()).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // Create audio segments store
        if (!db.objectStoreNames.contains('audioSegments')) {
          const audioStore = db.createObjectStore('audioSegments', { keyPath: 'id' });
          audioStore.createIndex('timestamp', 'timestamp', { unique: false });
          audioStore.createIndex('isProcessed', 'isProcessed', { unique: false });
        }

        // Create pending transcripts store
        if (!db.objectStoreNames.contains('pendingTranscripts')) {
          const pendingStore = db.createObjectStore('pendingTranscripts', { keyPath: 'id' });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
          pendingStore.createIndex('retryCount', 'retryCount', { unique: false });
        }

        // Migrate existing data from version 1 to 2
        if (oldVersion < 2) {
          // Note: Data migration should be handled outside of onupgradeneeded
          // to avoid transaction conflicts. The conversion from boolean to numeric
          // will be handled in the getter methods for backward compatibility.
        }
      };
    });
  }

  private async migrateDataIfNeeded(): Promise<void> {
    if (!this.db) return;

    // Check if we need to migrate data from boolean to numeric isProcessed
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audioSegments'], 'readwrite');
      const store = transaction.objectStore('audioSegments');
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const segment = cursor.value;
          // Convert boolean isProcessed to numeric if needed
          if (typeof segment.isProcessed === 'boolean') {
            segment.isProcessed = segment.isProcessed ? 1 : 0;
            cursor.update(segment);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async storeAudioSegment(audioBlob: Blob): Promise<string> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audioSegments'], 'readwrite');
      const store = transaction.objectStore('audioSegments');
      
      const segment: AudioSegment = {
        id: this.createId(),
        audioBlob,
        timestamp: new Date(),
        isProcessed: false
      };

      // Store isProcessed as number for better IndexedDB compatibility
      const segmentToStore = {
        ...segment,
        isProcessed: 0
      };

      const request = store.add(segmentToStore);
      request.onsuccess = () => resolve(segment.id);
      request.onerror = () => reject(request.error);
    });
  }

  async getAudioSegmentById(id: string): Promise<AudioSegment | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audioSegments'], 'readonly');
      const store = transaction.objectStore('audioSegments');
      const request = store.get(id);

      request.onsuccess = () => {
        const segment = request.result;
        if (segment) {
          // Convert numeric isProcessed back to boolean for interface compatibility
          // Handle both boolean and numeric values for backward compatibility
          const isProcessed = typeof segment.isProcessed === 'boolean' 
            ? segment.isProcessed 
            : segment.isProcessed === 1;
          
          const audioSegment: AudioSegment = {
            ...segment,
            isProcessed
          };
          resolve(audioSegment);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getUnprocessedAudioSegments(): Promise<AudioSegment[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audioSegments'], 'readonly');
      const store = transaction.objectStore('audioSegments');
      const index = store.index('isProcessed');
      // Use a more reliable approach for boolean values
      const request = index.openCursor(IDBKeyRange.only(0));

      const results: AudioSegment[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const segment = cursor.value;
          // Convert numeric isProcessed back to boolean for interface compatibility
          // Handle both boolean and numeric values for backward compatibility
          const isProcessed = typeof segment.isProcessed === 'boolean' 
            ? segment.isProcessed 
            : segment.isProcessed === 1;
          
          const audioSegment: AudioSegment = {
            ...segment,
            isProcessed
          };
          results.push(audioSegment);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getProcessedAudioSegments(): Promise<AudioSegment[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audioSegments'], 'readonly');
      const store = transaction.objectStore('audioSegments');
      const index = store.index('isProcessed');
      // Use a more reliable approach for boolean values
      const request = index.openCursor(IDBKeyRange.only(1));

      const results: AudioSegment[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const segment = cursor.value;
          // Convert numeric isProcessed back to boolean for interface compatibility
          // Handle both boolean and numeric values for backward compatibility
          const isProcessed = typeof segment.isProcessed === 'boolean' 
            ? segment.isProcessed 
            : segment.isProcessed === 1;
          
          const audioSegment: AudioSegment = {
            ...segment,
            isProcessed
          };
          if (audioSegment.transcript) {
            results.push(audioSegment);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markAudioSegmentAsProcessed(id: string, transcript: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audioSegments'], 'readwrite');
      const store = transaction.objectStore('audioSegments');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const segment = getRequest.result;
        if (segment) {
          segment.isProcessed = 1; // Store as number for IndexedDB compatibility
          segment.transcript = transcript;
          const putRequest = store.put(segment);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Audio segment not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async addPendingTranscript(audioSegmentId: string): Promise<string> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingTranscripts'], 'readwrite');
      const store = transaction.objectStore('pendingTranscripts');
      
      const pending: PendingTranscript = {
        id: this.createId(),
        audioSegmentId,
        timestamp: new Date(),
        retryCount: 0
      };

      const request = store.add(pending);
      request.onsuccess = () => resolve(pending.id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingTranscripts(): Promise<PendingTranscript[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingTranscripts'], 'readonly');
      const store = transaction.objectStore('pendingTranscripts');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingTranscript(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingTranscripts'], 'readwrite');
      const store = transaction.objectStore('pendingTranscripts');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async incrementRetryCount(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pendingTranscripts'], 'readwrite');
      const store = transaction.objectStore('pendingTranscripts');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const pending = getRequest.result;
        if (pending) {
          pending.retryCount += 1;
          const putRequest = store.put(pending);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Pending transcript not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async clearOldData(daysToKeep: number = 7): Promise<void> {
    if (!this.db) await this.init();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const clearStore = (storeName: 'audioSegments' | 'pendingTranscripts') => {
      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const index = store.index('timestamp');
        const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
        request.onerror = () => reject(request.error);

        this.waitForTransaction(transaction).then(resolve).catch(reject);
      });
    };

    await Promise.all([
      clearStore('audioSegments'),
      clearStore('pendingTranscripts')
    ]);
  }
}

export const indexedDBService = new IndexedDBService();
