/**
 * Trail Mix - Manifest Manager
 * Manages the JSONL manifest file that logs all downloads
 */

class ManifestManager {
  constructor() {
    this.entries = [];
    this.isPending = false;
    this.isInitialized = false;
  }

  /**
   * Initialize the manifest manager by reading existing entries
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.readExistingManifest();
      
      // Validate entries to ensure files still exist
      const removedCount = await this.validateEntries();
      if (removedCount > 0) {
        console.log(`[ManifestManager] Cleaned up ${removedCount} stale entries on startup`);
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.warn('[ManifestManager] Failed to initialize:', error);
      // Continue with empty entries
      this.entries = [];
      this.isInitialized = true;
    }
  }

  /**
   * Read existing manifest entries from chrome.storage.local
   */
  async readExistingManifest() {
    try {
      // Read entries from chrome.storage.local (persists across restarts)
      const result = await chrome.storage.local.get(['manifestEntries']);
      
      if (result.manifestEntries && Array.isArray(result.manifestEntries)) {
        this.entries = result.manifestEntries;
        console.log(`[ManifestManager] Loaded ${this.entries.length} existing entries from storage`);
      } else {
        console.log('[ManifestManager] No existing manifest found in storage, starting fresh');
        this.entries = [];
      }
    } catch (error) {
      // Storage read errors - start fresh
      console.log('[ManifestManager] Could not read existing manifest from storage:', error.message);
      this.entries = [];
    }
  }

  /**
   * Append a new entry to the manifest
   * @param {string} artist - Artist name
   * @param {string} itemName - Album/track/EP name
   * @param {string} timestamp - ISO timestamp
   * @param {string} filePath - Relative file path within Downloads
   * @param {number} downloadId - Chrome download ID (optional)
   */
  async appendEntry(artist, itemName, timestamp, filePath, downloadId = null) {
    try {
      // Ensure we're initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      const entry = {
        artist,
        item_name: itemName,
        timestamp,
        filePath,
        ...(downloadId && { downloadId })
      };

      this.entries.push(entry);
      console.log('[ManifestManager] Added entry:', entry);

      // Monitor storage size (chrome.storage.local has 10 MB limit by default)
      const estimatedSize = JSON.stringify(this.entries).length;
      const sizeMB = (estimatedSize / (1024 * 1024)).toFixed(2);
      
      if (estimatedSize > 9 * 1024 * 1024) { // 9 MB (~90% of quota)
        console.warn(`[ManifestManager] Storage usage is ${sizeMB} MB, approaching 10 MB limit. Consider adding 'unlimitedStorage' permission or implementing entry rotation.`);
      }

      // Write the updated manifest
      await this.writeManifest();
    } catch (error) {
      console.error('[ManifestManager] Failed to append entry:', error);
      // Don't throw - manifest writing shouldn't break downloads
    }
  }

  /**
   * Write the manifest to chrome.storage.local and export as JSONL file
   */
  async writeManifest() {
    if (this.isPending) {
      console.log('[ManifestManager] Write already pending, skipping');
      return;
    }

    try {
      this.isPending = true;

      // First, save to chrome.storage.local (source of truth)
      await chrome.storage.local.set({ manifestEntries: this.entries });
      console.log(`[ManifestManager] Saved ${this.entries.length} entries to storage`);

      // Then export as JSONL file for user visibility
      // Generate JSONL content (one JSON object per line)
      const jsonlContent = this.entries
        .map(entry => JSON.stringify(entry))
        .join('\n');

      // Use data URL instead of Blob URL (Blob URLs don't work in service workers)
      // Encode as base64 for proper handling of special characters
      const base64Content = btoa(unescape(encodeURIComponent(jsonlContent)));
      const dataUrl = `data:application/jsonl;base64,${base64Content}`;

      // Mark this as a manifest download using a special metadata entry
      if (typeof downloadMetadata !== 'undefined') {
        downloadMetadata.set(dataUrl, {
          isManifest: true,
          artist: null,
          title: null
        });
      }

      // Download the manifest file
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: 'TrailMix.json', // Will be routed to TrailMix/TrailMix.json by filename listener
        saveAs: false,
        conflictAction: 'overwrite'
      });

      console.log(`[ManifestManager] Manifest JSONL export initiated: ${downloadId}`);

      this.isPending = false;
    } catch (error) {
      console.error('[ManifestManager] Failed to write manifest:', error);
      this.isPending = false;
      // Don't throw - manifest writing shouldn't break downloads
    }
  }

  /**
   * Finalize the manifest (called at batch completion)
   * Validates entries against filesystem, deduplicates, and writes final version
   */
  async finalize() {
    try {
      if (this.entries.length === 0) {
        console.log('[ManifestManager] No entries to finalize');
        return;
      }

      // First, validate entries against filesystem
      const removedCount = await this.validateEntries();
      
      if (this.entries.length === 0) {
        console.log('[ManifestManager] No valid entries after validation');
        return;
      }

      // Then deduplicate entries based on filePath
      const seen = new Set();
      this.entries = this.entries.filter(entry => {
        if (seen.has(entry.filePath)) {
          return false;
        }
        seen.add(entry.filePath);
        return true;
      });

      console.log(`[ManifestManager] Finalized with ${this.entries.length} unique, validated entries`);

      // Write the deduplicated, validated manifest
      await this.writeManifest();
    } catch (error) {
      console.error('[ManifestManager] Failed to finalize manifest:', error);
    }
  }

  /**
   * Check if a purchase has already been downloaded
   * @param {Object} purchase - Purchase object with artist and title
   * @returns {boolean} True if already downloaded
   */
  isAlreadyDownloaded(purchase) {
    if (!purchase || !purchase.artist || !purchase.title) {
      return false;
    }
    
    // Match by artist + title (case-insensitive)
    const purchaseArtist = purchase.artist.toLowerCase();
    const purchaseTitle = purchase.title.toLowerCase();
    
    const match = this.entries.find(entry =>
      entry.artist.toLowerCase() === purchaseArtist &&
      entry.item_name.toLowerCase() === purchaseTitle
    );
    
    return !!match;
  }

  /**
   * Validate manifest entries against Chrome downloads to ensure files exist
   * Removes entries for files that no longer exist on disk
   * @returns {Promise<number>} Number of entries removed
   */
  async validateEntries() {
    if (this.entries.length === 0) {
      return 0;
    }
    
    const validatedEntries = [];
    let removedCount = 0;
    
    console.log(`[ManifestManager] Validating ${this.entries.length} entries...`);
    
    for (const entry of this.entries) {
      // If no downloadId, cannot validate - remove it (pre-validation entries)
      if (!entry.downloadId) {
        console.log(`[ManifestManager] Removing entry without downloadId: ${entry.artist} - ${entry.item_name}`);
        removedCount++;
        continue;
      }
      
      try {
        // Check if download still exists in Chrome's records
        const downloads = await chrome.downloads.search({ id: entry.downloadId });
        
        if (downloads.length > 0 && downloads[0].exists) {
          // File exists on disk
          validatedEntries.push(entry);
        } else {
          // File deleted or download record cleared
          console.log(`[ManifestManager] Removing stale entry: ${entry.artist} - ${entry.item_name}`);
          removedCount++;
        }
      } catch (error) {
        // Error checking - assume invalid
        console.warn(`[ManifestManager] Failed to validate entry ${entry.filePath}:`, error);
        removedCount++;
      }
    }
    
    this.entries = validatedEntries;
    
    if (removedCount > 0) {
      console.log(`[ManifestManager] Removed ${removedCount} stale entries`);
      // Save cleaned entries back to storage
      await chrome.storage.local.set({ manifestEntries: this.entries });
    }
    
    return removedCount;
  }

  /**
   * Get the manifest file path (for testing)
   */
  async getManifestPath() {
    try {
      const downloads = await chrome.downloads.search({
        query: ['TrailMix.json'],
        orderBy: ['-startTime'],
        limit: 1
      });

      if (downloads.length > 0 && downloads[0].filename) {
        return downloads[0].filename;
      }
      return null;
    } catch (error) {
      console.error('[ManifestManager] Failed to get manifest path:', error);
      return null;
    }
  }

  /**
   * Reset the manifest manager (for testing)
   */
  reset() {
    this.entries = [];
    this.isPending = false;
    this.isInitialized = false;
  }
}

// Export singleton instance
const manifestManager = new ManifestManager();

// Export for both browser and Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ManifestManager, manifestManager };
} else if (typeof window !== 'undefined') {
  window.ManifestManager = ManifestManager;
  window.manifestManager = manifestManager;
} else if (typeof self !== 'undefined') {
  // Service worker context
  self.ManifestManager = ManifestManager;
  self.manifestManager = manifestManager;
}

