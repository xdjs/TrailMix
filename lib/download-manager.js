/**
 * Trail Mix - Download Manager
 * Handles download processing and queue management
 * Phase 4: Core Download Engine Implementation
 */

/**
 * DownloadManager Class
 * Manages individual album downloads from Bandcamp
 */
class DownloadManager {
  constructor() {
    // Track the currently active download
    this.activeDownload = null;

    // Track download progress
    this.downloadProgress = {};

    // Progress callback
    this.onProgress = null;

    // Set up Chrome Downloads API listener
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      chrome.downloads.onChanged.addListener(this.handleDownloadChange.bind(this));
    }

    // Check interval for download link readiness (ms)
    this.checkInterval = 2000;

    // Timeout for waiting for download link (ms)
    this.downloadTimeout = 30000;
  }

  /**
   * Download a single purchase item
   * @param {Object} purchaseItem - The item to download
   * @param {string} purchaseItem.title - Album/track title
   * @param {string} purchaseItem.artist - Artist name
   * @param {string} purchaseItem.downloadUrl - Bandcamp download page URL
   * @returns {Promise} Resolves when download completes or rejects on error
   */
  async download(purchaseItem) {
    // Clear any existing download
    if (this.activeDownload) {
      throw new Error('Download already in progress');
    }

    return new Promise(async (resolve, reject) => {
      try {
        // Store download info
        this.activeDownload = {
          purchaseItem,
          status: 'preparing',
          tabId: null,
          downloadId: null,
          promise: { resolve, reject }
        };

        // Step 1: Open download page in inactive tab
        const tab = await chrome.tabs.create({
          url: purchaseItem.downloadUrl,
          active: false
        });

        this.activeDownload.tabId = tab.id;
        console.log(`Opened tab ${tab.id} for ${purchaseItem.title}`);

        // Step 2: Monitor tab for download link readiness
        this.startMonitoring();

      } catch (error) {
        console.error('Failed to start download:', error);
        this.cleanup();
        reject(error);
      }
    });
  }

  /**
   * Start monitoring the tab for download link readiness
   */
  startMonitoring() {
    if (!this.activeDownload) return;

    let checkCount = 0;
    const maxChecks = Math.floor(this.downloadTimeout / this.checkInterval);

    const checkForDownload = async () => {
      if (!this.activeDownload) return;

      checkCount++;

      try {
        // Send message to content script to check if download is ready
        const response = await this.sendMessageToTab(
          this.activeDownload.tabId,
          { type: 'CHECK_DOWNLOAD_READY' }
        );

        if (response && response.ready && response.url) {
          console.log(`Download link ready: ${response.url}`);

          // Store metadata from download page if available
          if (response.metadata) {
            // Use metadata from download page, fallback to purchaseItem data
            this.activeDownload.metadata = {
              artist: response.metadata.artist || this.activeDownload.purchaseItem.artist,
              title: response.metadata.title || this.activeDownload.purchaseItem.title
            };
            console.log('Using metadata:', this.activeDownload.metadata);
          } else {
            // Fallback to purchaseItem data
            this.activeDownload.metadata = {
              artist: this.activeDownload.purchaseItem.artist,
              title: this.activeDownload.purchaseItem.title
            };
          }

          // Step 3: Extract and initiate download
          await this.initiateDownload(response.url);
        } else if (checkCount >= maxChecks) {
          // Timeout
          throw new Error('Download preparation timeout');
        } else {
          // Check again after interval - but only if still active
          if (this.activeDownload) {
            this.monitoringTimeout = setTimeout(checkForDownload, this.checkInterval);
          }
        }

      } catch (error) {
        console.error('Error checking download readiness:', error);
        // Only handle error if we haven't been cancelled
        if (this.activeDownload) {
          this.handleError(error);
        }
      }
    };

    // Start checking
    this.monitoringTimeout = setTimeout(checkForDownload, this.checkInterval);
  }

  /**
   * Send message to tab and return response
   */
  sendMessageToTab(tabId, message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        resolve(response || {});
      });
    });
  }

  /**
   * Initiate download using Chrome Downloads API
   */
  async initiateDownload(downloadUrl) {
    if (!this.activeDownload) return;

    try {
      // Validate download URL is from trusted Bandcamp domain
      if (!this.isValidDownloadUrl(downloadUrl)) {
        throw new Error(`Invalid download URL: ${downloadUrl}. Must be from bcbits.com domain.`);
      }

      // Step 4: Start download using Chrome Downloads API
      // Build the folder structure if we have metadata
      let downloadOptions = {
        url: downloadUrl,
        saveAs: false  // Don't prompt for each file
      };

      if (this.activeDownload.metadata && this.activeDownload.metadata.artist && this.activeDownload.metadata.title) {
        // Sanitize for filesystem
        const sanitize = (str) => str.replace(/[<>:"\\|?*]/g, '_').trim();
        const artist = sanitize(this.activeDownload.metadata.artist);
        const title = sanitize(this.activeDownload.metadata.title);

        // We'll suggest a path structure, but let the service worker handle the actual filename
        // The service worker will extract the original filename from the URL
        downloadOptions.filename = `TrailMix/${artist}/${title}/`;
        console.log('Suggesting download path structure:', downloadOptions.filename);
      }

      const downloadId = await chrome.downloads.download(downloadOptions);

      // Check again after async operation in case download was cancelled
      if (!this.activeDownload) {
        // Cancel the download we just started since we were cancelled
        if (downloadId) {
          try {
            chrome.downloads.cancel(downloadId).catch((error) => {
              // Ignore "must be in progress" error
              if (!error?.message?.includes('must be in progress')) {
                console.warn('Failed to cancel newly started download:', error);
              }
            });
          } catch (error) {
            // Ignore synchronous errors
            if (!error?.message?.includes('must be in progress')) {
              console.warn('Failed to cancel newly started download:', error);
            }
          }
        }
        return;
      }

      this.activeDownload.downloadId = downloadId;
      this.activeDownload.status = 'downloading';

      console.log(`Started download ${downloadId} for ${this.activeDownload.purchaseItem.title}`);

      // Step 5: Close the tab
      if (this.activeDownload && this.activeDownload.tabId) {
        try {
          await chrome.tabs.remove(this.activeDownload.tabId);
          console.log(`Closed tab ${this.activeDownload.tabId}`);
        } catch (error) {
          console.warn('Failed to close tab:', error);
        }
      }

    } catch (error) {
      console.error('Failed to initiate download:', error);
      this.handleError(error);
    }
  }

  /**
   * Handle download state changes from Chrome Downloads API
   */
  handleDownloadChange(downloadDelta) {
    if (!this.activeDownload || downloadDelta.id !== this.activeDownload.downloadId) {
      return;
    }

    // Track progress
    if (downloadDelta.bytesReceived || downloadDelta.totalBytes) {
      const bytesReceived = downloadDelta.bytesReceived?.current ||
                           this.downloadProgress[downloadDelta.id]?.bytesReceived || 0;
      const totalBytes = downloadDelta.totalBytes?.current ||
                        this.activeDownload.totalBytes || 0;

      if (!this.activeDownload.totalBytes && totalBytes > 0) {
        this.activeDownload.totalBytes = totalBytes;
      }

      const percentComplete = totalBytes > 0 ? Math.round((bytesReceived / totalBytes) * 100) : 0;

      this.downloadProgress[downloadDelta.id] = {
        downloadId: downloadDelta.id,
        bytesReceived,
        totalBytes,
        percentComplete
      };

      // Call progress callback if set
      if (this.onProgress) {
        this.onProgress(this.downloadProgress[downloadDelta.id]);
      }

      console.log(`Download progress: ${percentComplete}% (${bytesReceived}/${totalBytes})`);
    }

    // Handle state changes
    if (downloadDelta.state) {
      if (downloadDelta.state.current === 'complete') {
        console.log(`Download completed: ${this.activeDownload.purchaseItem.title}`);
        this.handleCompletion();
      } else if (downloadDelta.state.current === 'interrupted') {
        console.error(`Download interrupted: ${this.activeDownload.purchaseItem.title}`);
        this.handleError(new Error('Download interrupted'));
      }
    }
  }

  /**
   * Handle successful download completion
   */
  handleCompletion() {
    if (this.activeDownload && this.activeDownload.promise) {
      // Clean up progress tracking for completed download
      if (this.activeDownload.downloadId) {
        delete this.downloadProgress[this.activeDownload.downloadId];
      }

      this.activeDownload.promise.resolve({
        success: true,
        purchaseItem: this.activeDownload.purchaseItem
      });
    }
    this.cleanup();
  }

  /**
   * Handle download error
   */
  handleError(error) {
    if (this.activeDownload) {
      // Clean up progress tracking for failed download
      if (this.activeDownload.downloadId) {
        delete this.downloadProgress[this.activeDownload.downloadId];
      }

      // Close tab if still open
      if (this.activeDownload.tabId && chrome.tabs && chrome.tabs.remove) {
        const removePromise = chrome.tabs.remove(this.activeDownload.tabId);
        if (removePromise && typeof removePromise.catch === 'function') {
          removePromise.catch(() => {});
        }
      }

      // Reject the promise
      if (this.activeDownload.promise) {
        this.activeDownload.promise.reject(error);
      }
    }
    this.cleanup();
  }

  /**
   * Cancel the current download
   */
  cancel() {
    // Clear any pending monitoring timeouts
    if (this.monitoringTimeout) {
      clearTimeout(this.monitoringTimeout);
      this.monitoringTimeout = null;
    }

    if (this.activeDownload) {
      // Clean up progress tracking for cancelled download
      if (this.activeDownload.downloadId) {
        delete this.downloadProgress[this.activeDownload.downloadId];
      }

      // Cancel Chrome download if in progress
      if (this.activeDownload.downloadId && chrome.downloads && chrome.downloads.cancel) {
        try {
          const cancelPromise = chrome.downloads.cancel(this.activeDownload.downloadId);
          if (cancelPromise && typeof cancelPromise.catch === 'function') {
            cancelPromise.catch((error) => {
              // Ignore "Download must be in progress" error - this happens when
              // we try to cancel a download that just started but isn't registered yet
              if (!error?.message?.includes('must be in progress')) {
                console.warn('Failed to cancel download:', error);
              }
            });
          }
        } catch (error) {
          // Ignore synchronous errors as well
          if (!error?.message?.includes('must be in progress')) {
            console.warn('Failed to cancel download:', error);
          }
        }
      }

      // Close tab if still open
      if (this.activeDownload.tabId && chrome.tabs && chrome.tabs.remove) {
        const removePromise = chrome.tabs.remove(this.activeDownload.tabId);
        if (removePromise && typeof removePromise.catch === 'function') {
          removePromise.catch(() => {});
        }
      }

      // Reject the promise
      if (this.activeDownload.promise) {
        this.activeDownload.promise.reject(new Error('Download cancelled'));
      }
    }
    this.cleanup();
  }

  /**
   * Clean up after download
   */
  cleanup() {
    this.activeDownload = null;
    // Keep progress history for completed downloads
  }

  /**
   * Validate download URL is from trusted Bandcamp domain
   * @param {string} url - URL to validate
   * @returns {boolean} true if URL is valid
   */
  isValidDownloadUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const urlObj = new URL(url);
      // Allow downloads only from Bandcamp's content delivery network
      // bcbits.com is Bandcamp's CDN domain for media files
      return urlObj.protocol === 'https:' &&
             urlObj.hostname.endsWith('.bcbits.com');
    } catch (error) {
      // Invalid URL
      return false;
    }
  }
}

// Export for both Node.js (tests) and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DownloadManager;
} else if (typeof window !== 'undefined') {
  window.DownloadManager = DownloadManager;
}

