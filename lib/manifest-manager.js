/**
 * Trail Mix - Manifest Manager
 * Manages download manifest tracking using chrome.storage.local as working memory
 * and exports to TrailMix.json
 */

/**
 * ManifestManager Class
 * Tracks downloads during a batch, exports to file, and clears storage after batch completion
 */
class ManifestManager {
  constructor() {
    this.entries = [];
  }

  /**
   * Initialize manifest by loading existing entries from chrome.storage.local
   * Call this at the start of each download batch
   */
  async initialize() {
    try {
      const result = await chrome.storage.local.get(['manifestEntries']);
      if (result.manifestEntries && Array.isArray(result.manifestEntries)) {
        this.entries = result.manifestEntries;
        console.log(`[ManifestManager] Initialized with ${this.entries.length} existing entries`);
      } else {
        this.entries = [];
        console.log('[ManifestManager] Initialized with empty manifest');
      }
    } catch (error) {
      console.error('[ManifestManager] Failed to initialize:', error);
      this.entries = [];
    }
  }

  /**
   * Append a new entry to the manifest
   * Saves to chrome.storage.local (file export happens at batch finalization)
   * @param {string} artist - Artist name
   * @param {string} title - Album/track title
   * @param {string} timestamp - ISO timestamp
   * @param {string} filePath - Relative file path
   */
  async appendEntry(artist, title, timestamp, filePath) {
    try {
      const entry = {
        artist,
        title,
        timestamp,
        filePath
      };

      this.entries.push(entry);

      // Save to chrome.storage.local only
      // File export happens once at batch finalization to avoid multiple files
      await chrome.storage.local.set({ manifestEntries: this.entries });

      console.log(`[ManifestManager] Recorded: ${artist} - ${title}`);
    } catch (error) {
      console.error('[ManifestManager] Failed to append entry:', error);
      throw error;
    }
  }

  /**
   * Export all entries to TrailMix.json as JSONL format
   * Each entry is one line of JSON
   */
  async exportToFile() {
    try {
      if (this.entries.length === 0) {
        console.log('[ManifestManager] No entries to export');
        return;
      }

      // Create JSONL content (one JSON object per line)
      const jsonlContent = this.entries.map(entry => JSON.stringify(entry)).join('\n');

      // Convert to data URL (service workers don't support URL.createObjectURL)
      // Use proper UTF-8 encoding
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonlContent);
      
      // Convert to base64
      let binary = '';
      const len = uint8Array.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Content = btoa(binary);
      
      // Create data URL with special fragment to identify manifest downloads
      // This allows us to intercept in onDeterminingFilename
      const dataUrl = `data:application/json;charset=utf-8;base64,${base64Content}#trailmix-manifest`;

      // Download - we'll handle the filename in onDeterminingFilename listener
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        conflictAction: 'overwrite',
        saveAs: false
      });

      console.log(`[ManifestManager] Exported ${this.entries.length} entries to TrailMix.json (download ID: ${downloadId})`);
    } catch (error) {
      console.error('[ManifestManager] Failed to export to file:', error);
      throw error;
    }
  }

  /**
   * Finalize the manifest at batch end
   * Deduplicates entries, exports final version, and clears chrome.storage.local
   */
  async finalize() {
    try {
      console.log(`[ManifestManager] Finalizing manifest with ${this.entries.length} entries`);

      if (this.entries.length === 0) {
        console.log('[ManifestManager] No entries to finalize');
        await chrome.storage.local.remove(['manifestEntries']);
        return;
      }

      // Deduplicate by artist + title (case-insensitive)
      // Keep the earliest timestamp for each unique artist+title pair
      const seen = new Map();
      const deduped = [];

      for (const entry of this.entries) {
        const key = `${entry.artist}|||${entry.title}`.toLowerCase();
        
        if (!seen.has(key)) {
          seen.set(key, entry.timestamp);
          deduped.push(entry);
        } else {
          // Keep the earlier timestamp
          const existingTimestamp = seen.get(key);
          if (entry.timestamp < existingTimestamp) {
            // Replace with earlier entry
            const index = deduped.findIndex(e => 
              `${e.artist}|||${e.title}`.toLowerCase() === key
            );
            if (index !== -1) {
              deduped[index] = entry;
              seen.set(key, entry.timestamp);
            }
          }
        }
      }

      const removedCount = this.entries.length - deduped.length;
      if (removedCount > 0) {
        console.log(`[ManifestManager] Removed ${removedCount} duplicate entries`);
      }

      this.entries = deduped;

      // Update storage with deduped entries
      await chrome.storage.local.set({ manifestEntries: this.entries });

      // Export final version
      await this.exportToFile();

      // Clear chrome.storage.local
      await chrome.storage.local.remove(['manifestEntries']);
      this.entries = [];

      console.log('[ManifestManager] Manifest finalized and storage cleared');
    } catch (error) {
      console.error('[ManifestManager] Failed to finalize:', error);
      throw error;
    }
  }

  /**
   * Reset the manifest (clear all entries and storage)
   * Useful for testing or manual cleanup
   */
  async reset() {
    try {
      this.entries = [];
      await chrome.storage.local.remove(['manifestEntries']);
      console.log('[ManifestManager] Manifest reset');
    } catch (error) {
      console.error('[ManifestManager] Failed to reset:', error);
      throw error;
    }
  }

  /**
   * Get current entry count
   */
  getEntryCount() {
    return this.entries.length;
  }

  /**
   * Get all entries (for testing)
   */
  getEntries() {
    return [...this.entries];
  }
}

// Export for both Node.js (tests) and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ManifestManager };
} else if (typeof self !== 'undefined') {
  // Service worker environment
  self.ManifestManager = ManifestManager;
  self.manifestManager = new ManifestManager();
} else if (typeof window !== 'undefined') {
  // Browser window environment
  window.ManifestManager = ManifestManager;
  window.manifestManager = new ManifestManager();
}

