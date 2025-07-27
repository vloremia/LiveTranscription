import { indexedDBService, AudioSegment, PendingTranscript } from './IndexedDBService';
import { networkService } from './NetworkService';

export interface SyncResult {
  success: boolean;
  processedCount: number;
  errorCount: number;
  errors: string[];
}

export interface ProcessedTranscript {
  id: string;
  text: string;
  timestamp: Date;
  isFromOffline: boolean;
}

class OfflineTranscriptionService {
  private isProcessing = false;
  private maxRetries = 3;
  private syncInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    networkService.addListener((status) => {
      if (status.isOnline && !this.isProcessing) {
        // When back online, start processing pending transcripts
        this.reconnectAttempts = 0;
        this.processPendingTranscripts();
      }
    });
  }

  async getProcessedTranscripts(): Promise<ProcessedTranscript[]> {
    try {
      const audioSegments = await indexedDBService.getProcessedAudioSegments();
      
      return audioSegments.map(segment => ({
        id: segment.id,
        text: segment.transcript!,
        timestamp: segment.timestamp,
        isFromOffline: true
      }));
    } catch (error) {
      console.error('Error getting processed transcripts:', error);
      return [];
    }
  }

  async processPendingTranscripts(): Promise<SyncResult> {
    if (this.isProcessing) {
      return { success: false, processedCount: 0, errorCount: 0, errors: ['Already processing'] };
    }

    this.isProcessing = true;
    const result: SyncResult = {
      success: true,
      processedCount: 0,
      errorCount: 0,
      errors: []
    };

    try {
      const pendingTranscripts = await indexedDBService.getPendingTranscripts();
      
      if (pendingTranscripts.length === 0) {
        return result;
      }

      console.log(`Processing ${pendingTranscripts.length} pending transcripts...`);
      
      for (const pending of pendingTranscripts) {
        try {
          // Skip if too many retries
          if (pending.retryCount >= this.maxRetries) {
            result.errorCount++;
            result.errors.push(`Max retries exceeded for segment ${pending.audioSegmentId}`);
            await indexedDBService.removePendingTranscript(pending.id);
            continue;
          }

          // Get the audio segment
          const audioSegment = await indexedDBService.getAudioSegmentById(pending.audioSegmentId);
          
          if (!audioSegment) {
            result.errorCount++;
            result.errors.push(`Audio segment not found: ${pending.audioSegmentId}`);
            await indexedDBService.removePendingTranscript(pending.id);
            continue;
          }

          // Process the audio segment
          const transcript = await this.transcribeAudioSegment(audioSegment.audioBlob);
          
          if (transcript) {
            // Mark as processed and remove from pending
            await indexedDBService.markAudioSegmentAsProcessed(audioSegment.id, transcript);
            await indexedDBService.removePendingTranscript(pending.id);
            result.processedCount++;
            console.log(`Successfully processed segment ${pending.audioSegmentId}: "${transcript}"`);
          } else {
            // Increment retry count
            await indexedDBService.incrementRetryCount(pending.id);
            result.errorCount++;
            result.errors.push(`Failed to transcribe segment ${pending.audioSegmentId}`);
          }
        } catch (error) {
          result.errorCount++;
          result.errors.push(`Error processing ${pending.audioSegmentId}: ${error}`);
          await indexedDBService.incrementRetryCount(pending.id);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`General error: ${error}`);
    } finally {
      this.isProcessing = false;
    }

    if (result.processedCount > 0) {
      console.log(`Successfully processed ${result.processedCount} transcripts`);
    }

    return result;
  }

  private async transcribeAudioSegment(audioBlob: Blob): Promise<string | null> {
    try {
      // Check network status before attempting transcription
      const networkStatus = networkService.getStatus();
      if (!networkStatus.isOnline) {
        console.log('Network is offline, skipping transcription');
        return null;
      }

      // Get authentication token
      const response = await fetch('/api/authenticate', { cache: 'no-store' });
      const result = await response.json();
      const token = result.access_token;

      // Create form data for the audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'nova-3');
      formData.append('smart_format', 'true');
      formData.append('filler_words', 'true');

      // Send to Deepgram's transcription API
      const transcriptionResponse = await fetch('https://api.deepgram.com/v1/listen', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
        },
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        throw new Error(`Transcription failed: ${transcriptionResponse.statusText}`);
      }

      const transcriptionResult = await transcriptionResponse.json();
      
      // Extract transcript from response
      if (transcriptionResult.results && transcriptionResult.results.channels) {
        const transcript = transcriptionResult.results.channels[0]?.alternatives[0]?.transcript;
        return transcript || null;
      }

      return null;
    } catch (error) {
      console.error('Error transcribing audio segment:', error);
      
      // If it's a network error, we might want to retry later
      if (error instanceof TypeError && error.message.includes('fetch')) {
        this.reconnectAttempts++;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`Network error, will retry. Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        }
      }
      
      return null;
    }
  }

  async startAutoSync(intervalMs: number = 30000): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      const status = networkService.getStatus();
      if (status.isOnline && !this.isProcessing) {
        await this.processPendingTranscripts();
      }
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async cleanup(): Promise<void> {
    this.stopAutoSync();
    await indexedDBService.clearOldData();
  }

  // Get count of pending segments
  async getPendingCount(): Promise<number> {
    try {
      const pendingTranscripts = await indexedDBService.getPendingTranscripts();
      return pendingTranscripts.length;
    } catch (error) {
      console.error('Error getting pending count:', error);
      return 0;
    }
  }

  // Force sync all pending transcripts
  async forceSync(): Promise<SyncResult> {
    console.log('Force syncing all pending transcripts...');
    return await this.processPendingTranscripts();
  }
}

export const offlineTranscriptionService = new OfflineTranscriptionService(); 