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

          // Step 3: Extract and initiate download
          await this.initiateDownload(response.url);
        } else if (checkCount >= maxChecks) {
          // Timeout
          throw new Error('Download preparation timeout');
        } else {
          // Check again after interval
          setTimeout(checkForDownload, this.checkInterval);
        }

      } catch (error) {
        console.error('Error checking download readiness:', error);
        this.handleError(error);
      }
    };

    // Start checking
    setTimeout(checkForDownload, this.checkInterval);
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
      // Step 4: Start download using Chrome Downloads API
      const downloadId = await chrome.downloads.download({
        url: downloadUrl,
        saveAs: false  // Don't prompt for each file
      });

      this.activeDownload.downloadId = downloadId;
      this.activeDownload.status = 'downloading';

      console.log(`Started download ${downloadId} for ${this.activeDownload.purchaseItem.title}`);

      // Step 5: Close the tab
      if (this.activeDownload.tabId) {
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
    if (this.activeDownload) {
      // Cancel Chrome download if in progress
      if (this.activeDownload.downloadId && chrome.downloads && chrome.downloads.cancel) {
        const cancelPromise = chrome.downloads.cancel(this.activeDownload.downloadId);
        if (cancelPromise && typeof cancelPromise.catch === 'function') {
          cancelPromise.catch(() => {});
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
}

// Export for both Node.js (tests) and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DownloadManager;
} else if (typeof window !== 'undefined') {
  window.DownloadManager = DownloadManager;
}

