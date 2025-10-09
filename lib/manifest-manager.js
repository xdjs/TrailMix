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
      this.isInitialized = true;
    } catch (error) {
      console.warn('[ManifestManager] Failed to initialize:', error);
      // Continue with empty entries
      this.entries = [];
      this.isInitialized = true;
    }
  }

  /**
   * Read existing manifest file from Downloads folder
   */
  async readExistingManifest() {
    try {
      // Search for existing TrailMix.json in downloads
      const downloads = await chrome.downloads.search({
        query: ['TrailMix.json'],
        orderBy: ['-startTime'],
        limit: 1
      });

      if (downloads.length === 0) {
        console.log('[ManifestManager] No existing manifest found, starting fresh');
        this.entries = [];
        return;
      }

      const manifestDownload = downloads[0];
      if (!manifestDownload.filename) {
        console.warn('[ManifestManager] Manifest download has no filename');
        this.entries = [];
        return;
      }

      // Read the file content
      const response = await fetch(`file://${manifestDownload.filename}`);
      const text = await response.text();

      // Parse JSONL (one JSON object per line)
      this.entries = text
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.warn('[ManifestManager] Failed to parse line:', line, e);
            return null;
          }
        })
        .filter(entry => entry !== null);

      console.log(`[ManifestManager] Loaded ${this.entries.length} existing entries`);
    } catch (error) {
      // File read errors are expected if manifest doesn't exist yet
      console.log('[ManifestManager] Could not read existing manifest:', error.message);
      this.entries = [];
    }
  }

  /**
   * Append a new entry to the manifest
   * @param {string} artist - Artist name
   * @param {string} itemName - Album/track/EP name
   * @param {string} timestamp - ISO timestamp
   * @param {string} filePath - Relative file path within Downloads
   */
  async appendEntry(artist, itemName, timestamp, filePath) {
    try {
      // Ensure we're initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      const entry = {
        artist,
        item_name: itemName,
        timestamp,
        filePath
      };

      this.entries.push(entry);
      console.log('[ManifestManager] Added entry:', entry);

      // Write the updated manifest
      await this.writeManifest();
    } catch (error) {
      console.error('[ManifestManager] Failed to append entry:', error);
      // Don't throw - manifest writing shouldn't break downloads
    }
  }

  /**
   * Write the manifest to disk as a JSONL file
   */
  async writeManifest() {
    if (this.isPending) {
      console.log('[ManifestManager] Write already pending, skipping');
      return;
    }

    try {
      this.isPending = true;

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

      console.log(`[ManifestManager] Manifest download initiated: ${downloadId}`);

      this.isPending = false;
    } catch (error) {
      console.error('[ManifestManager] Failed to write manifest:', error);
      this.isPending = false;
      // Don't throw - manifest writing shouldn't break downloads
    }
  }

  /**
   * Finalize the manifest (called at batch completion)
   * Deduplicates entries and writes final version
   */
  async finalize() {
    try {
      if (this.entries.length === 0) {
        console.log('[ManifestManager] No entries to finalize');
        return;
      }

      // Deduplicate entries based on filePath
      const seen = new Set();
      this.entries = this.entries.filter(entry => {
        if (seen.has(entry.filePath)) {
          return false;
        }
        seen.add(entry.filePath);
        return true;
      });

      console.log(`[ManifestManager] Finalized with ${this.entries.length} unique entries`);

      // Write the deduplicated manifest
      await this.writeManifest();
    } catch (error) {
      console.error('[ManifestManager] Failed to finalize manifest:', error);
    }
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
}

