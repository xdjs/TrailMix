/**
 * Trail Mix - Service Worker
 * Handles extension lifecycle and coordinates between components
 */

// Service worker runs independently - no external imports needed
// Import DownloadManager for single download functionality
importScripts('../lib/download-manager.js');

// Extension lifecycle management
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation
    initializeExtension();
  } else if (details.reason === 'update') {
    // Extension updated from previousVersion
  }
});

// Register startup listener
chrome.runtime.onStartup.addListener(() => {
  // Extension starting up
});

// Initialize extension defaults
async function initializeExtension() {
  try {
    // Set default settings
    await chrome.storage.local.set({
      downloadLocation: '', // Will use browser default
      retryAttempts: 3,
      downloadDelay: 2000, // 2 seconds between downloads
      metadataEmbedding: true,
      artworkEmbedding: true,
      maxConcurrentDownloads: 3 // Default to 3 parallel downloads
    });
    
    // Extension initialized with default settings
  } catch (error) {
    // Failed to initialize extension
  }
}

// Message handling between components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message.type, message);

  switch (message.type) {
    case 'GET_EXTENSION_STATUS':
      handleGetStatus(sendResponse);
      return true; // Keep channel open for async response

    case 'START_DOWNLOAD':
      handleStartDownload(message, sendResponse);
      return true;

    case 'PAUSE_DOWNLOAD':
      handlePauseDownload(sendResponse);
      return true;

    case 'STOP_DOWNLOAD':
      handleStopDownload(sendResponse);
      return true;

    case 'CHECK_AUTHENTICATION':
      handleCheckAuthentication(sendResponse);
      return true;

    case 'DISCOVER_PURCHASES':
      handleDiscoverPurchases(sendResponse);
      return true;

    case 'DISCOVER_AND_START':
      handleDiscoverAndStart(sendResponse);
      return true;

    case 'DOWNLOAD_ALBUM':
      handleDownloadAlbum(message.data, sendResponse);
      return true;

    case 'DOWNLOAD_SINGLE':
      handleDownloadSingle(message.data, sendResponse);
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Status handler
async function handleGetStatus(sendResponse) {
  try {
    const settings = await chrome.storage.local.get();
    sendResponse({ 
      status: 'ready',
      settings: settings 
    });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

// State for download management
let downloadState = {
  isActive: false,
  isPaused: false,
  purchases: [],
  currentIndex: 0,
  completed: 0,
  failed: 0,
  activeDownloads: new Map(), // Track active download tabs
  downloadQueue: [],           // Queue of pending downloads
  downloadIds: new Map()       // Map downloadId -> purchase for Downloads API fallback
};

// Process reentrancy guard
let isProcessing = false;

// Global download manager instance for sequential processing
let globalDownloadManager = null;

// Download handlers
async function handleStartDownload(data, sendResponse) {
  try {
    // Use purchases passed from popup if available, otherwise discover
    if (data && data.purchases) {
      downloadState.purchases = data.purchases;
    } else if (data && data.data && Array.isArray(data.data.purchases)) {
      // Accept nested payload shape as well
      downloadState.purchases = data.data.purchases;
    } else {
      // Fallback: discover purchases
      const discoveryResponse = await discoverPurchases();
      if (!discoveryResponse.success) {
        sendResponse({ status: 'failed', error: discoveryResponse.error });
        return;
      }
      downloadState.purchases = discoveryResponse.purchases;
    }
    downloadState.isActive = true;
    downloadState.isPaused = false;
    downloadState.currentIndex = 0;
    downloadState.completed = 0;
    downloadState.failed = 0;

    // Diagnostics summary
    try {
      const total = Array.isArray(downloadState.purchases) ? downloadState.purchases.length : 0;
      const withDirectUrl = downloadState.purchases.filter(p => p && typeof p.downloadUrl === 'string' && p.downloadUrl.startsWith('http')).length;
      const withoutDirectUrl = total - withDirectUrl;
      console.log(`[TrailMix] Purchases summary: total=${total}, with downloadUrl=${withDirectUrl}, without=${withoutDirectUrl}`);
    } catch (_) {}

    console.log('Download state initialized:', {
      isActive: downloadState.isActive,
      total: downloadState.purchases.length,
      currentIndex: downloadState.currentIndex
    });
    console.log('About to call processNextDownload()...');

    // Start downloading
    await processNextDownload();

    console.log('processNextDownload() completed');
    sendResponse({ status: 'started', totalPurchases: downloadState.purchases.length });
  } catch (error) {
    sendResponse({ status: 'failed', error: error.message });
  }
}

function handlePauseDownload(sendResponse) {
  downloadState.isPaused = true;
  sendResponse({ status: 'paused' });
}

function handleStopDownload(sendResponse) {
  downloadState.isActive = false;
  downloadState.isPaused = false;
  sendResponse({ status: 'stopped' });
}

// Discover user's purchases
async function handleDiscoverPurchases(sendResponse) {
  try {
    const response = await discoverPurchases();
    console.log('Sending discovery response:', response);
    sendResponse(response);
  } catch (error) {
    console.error('Error in handleDiscoverPurchases:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Discover purchases by communicating with content script
async function discoverPurchases() {
  try {
    // Find or create a Bandcamp tab
    let tabs = await chrome.tabs.query({ url: '*://*.bandcamp.com/*' });
    let tab;

    if (tabs.length > 0) {
      tab = tabs[0];
      // Keep popup open: do not activate tab
      await chrome.tabs.update(tab.id, { active: false });
    } else {
      // Create a new background tab with Bandcamp
      tab = await chrome.tabs.create({ url: 'https://bandcamp.com', active: false });
      // Wait for it to load
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Refresh tab info to ensure URL is populated
    try {
      const refreshed = await chrome.tabs.get(tab.id);
      if (refreshed) tab = refreshed;
    } catch (_) {}

    // Check if we're already on the purchases page
    const isOnPurchases = !!(tab && tab.url && tab.url.includes('/purchases'));

    if (!isOnPurchases) {
      try {
        console.log('Not on purchases page, need to navigate. Current URL:', tab.url);

        // Send message to content script to find and navigate to purchases page
        const navResponse = await chrome.tabs.sendMessage(tab.id, { type: 'NAVIGATE_TO_PURCHASES' });
        console.log('Navigation response:', navResponse);

        if (navResponse.success && navResponse.purchasesUrl) {
          // Navigate to the purchases URL
          console.log('Navigating to purchases URL:', navResponse.purchasesUrl);
          await chrome.tabs.update(tab.id, { url: navResponse.purchasesUrl, active: false });

          // Wait for navigation to complete
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Update tab info after navigation
          tab = await chrome.tabs.get(tab.id);
          console.log('After navigation, new URL:', tab.url);
        } else if (navResponse.error) {
          console.error('Failed to find purchases URL:', navResponse.error);
          return { success: false, error: navResponse.error };
        } else {
          console.error('Could not find purchases page');
          return { success: false, error: 'Could not find purchases page. Please click on your avatar and go to Purchases manually.' };
        }
      } catch (err) {
        console.error('Error getting username:', err);
        return { success: false, error: 'Could not determine username. Please visit your Bandcamp collection page manually.' };
      }
    }

    // Now scrape purchases from the collection page
    const scrapeResponse = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PURCHASES' });

    return scrapeResponse;
  } catch (error) {
    console.error('Error discovering purchases:', error);
    return { success: false, error: error.message };
  }
}

// Discover and immediately start downloads (single-step flow)
async function handleDiscoverAndStart(sendResponse) {
  try {
    const discoveryResponse = await discoverPurchases();
    if (!discoveryResponse || !discoveryResponse.success) {
      sendResponse({ status: 'failed', error: discoveryResponse?.error || 'Discovery failed' });
      return;
    }

    // Seed state similar to handleStartDownload
    downloadState.purchases = Array.isArray(discoveryResponse.purchases) ? discoveryResponse.purchases : [];
    downloadState.isActive = true;
    downloadState.isPaused = false;
    downloadState.currentIndex = 0;
    downloadState.completed = 0;
    downloadState.failed = 0;

    try {
      const total = downloadState.purchases.length;
      const withDirectUrl = downloadState.purchases.filter(p => p && typeof p.downloadUrl === 'string' && p.downloadUrl.startsWith('http')).length;
      const withoutDirectUrl = total - withDirectUrl;
      console.log(`[TrailMix] DISCOVER_AND_START: total=${total}, with downloadUrl=${withDirectUrl}, without=${withoutDirectUrl}`);
    } catch (_) {}

    // Kick off downloads
    await processNextDownload();

    sendResponse({ status: 'started', totalPurchases: downloadState.purchases.length });
  } catch (error) {
    console.error('Error in DISCOVER_AND_START:', error);
    sendResponse({ status: 'failed', error: error.message });
  }
}

// Process downloads sequentially using DownloadManager
async function processNextDownload() {
  console.log('processNextDownload called. Active:', downloadState.isActive, 'Paused:', downloadState.isPaused);
  console.log('Current index:', downloadState.currentIndex, 'Total purchases:', downloadState.purchases.length);

  if (!downloadState.isActive || downloadState.isPaused) {
    return;
  }

  // Prevent reentrancy
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Check if we have more items to download
    if (downloadState.currentIndex < downloadState.purchases.length) {
      const purchase = downloadState.purchases[downloadState.currentIndex];
      downloadState.currentIndex++;

      console.log(`Starting download ${downloadState.currentIndex} of ${downloadState.purchases.length}: ${purchase.title}`);

      // Create download manager if not exists
      if (!globalDownloadManager) {
        globalDownloadManager = new DownloadManager();

        // Set up progress callback
        globalDownloadManager.onProgress = (progress) => {
          console.log(`Download progress: ${progress.percentComplete}%`);
          broadcastProgress();
        };
      }

      try {
        // Ensure we have a download URL before delegating to the download manager
        const downloadUrl = await resolveDownloadUrlForPurchase(purchase);
        if (downloadUrl) {
          purchase.downloadUrl = downloadUrl;
        }

        // Download using DownloadManager (sequential - one at a time)
        await globalDownloadManager.download(purchase);

        // Success
        downloadState.completed++;
        console.log(`Download completed: ${purchase.title} (${downloadState.completed}/${downloadState.purchases.length})`);

      } catch (error) {
        // Failed
        downloadState.failed++;
        console.error(`Download failed for ${purchase.title}:`, error);
      }

      // Broadcast progress
      broadcastProgress();

      // Process next item after a short delay
      setTimeout(() => {
        isProcessing = false;
        processNextDownload();
      }, 1000);

    } else {
      // All downloads complete
      downloadState.isActive = false;
      console.log(`All downloads complete: ${downloadState.completed} successful, ${downloadState.failed} failed`);
      broadcastProgress();
      isProcessing = false;
    }
  } catch (error) {
    console.error('Error in processNextDownload:', error);
    isProcessing = false;
  }
}

// Broadcast progress to popup
function broadcastProgress() {
  const progress = {
    total: downloadState.purchases.length,
    completed: downloadState.completed,
    failed: downloadState.failed,
    active: globalDownloadManager && globalDownloadManager.activeDownload ? 1 : 0,
    isActive: downloadState.isActive,
    isPaused: downloadState.isPaused
  };

  // Send to all extension views (popup, etc)
  chrome.runtime.sendMessage({
    type: 'DOWNLOAD_PROGRESS',
    progress: progress
  }).catch(() => {
    // Popup might not be open, ignore error
  });
}
/*
// Helper to initiate download with Chrome Downloads API
async function initiateDirectDownload(url, filename) {
  try {
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false  // Don't prompt for each file
    });

    console.log(`Started download ${downloadId} for ${filename}`);
    return downloadId;
  } catch (error) {
    console.error('Failed to start download:', error);
    return null;
  }
}
*/

// Download single item using DownloadManager (Phase 4)
async function handleDownloadSingle(data, sendResponse) {
  try {
    // Create a new DownloadManager instance
    const downloadManager = new DownloadManager();

    // Set up progress callback
    downloadManager.onProgress = (progress) => {
      console.log(`Download progress: ${progress.percentComplete}%`);
      // Send progress to popup
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_PROGRESS_SINGLE',
        progress: progress
      }).catch(() => {});
    };

    // Get the purchase item from data
    const purchaseItem = data && data.purchaseItem;
    if (!purchaseItem || !purchaseItem.downloadUrl) {
      sendResponse({ success: false, error: 'No purchase item provided' });
      return;
    }

    console.log(`Starting single download for: ${purchaseItem.title}`);

    // Start the download
    const result = await downloadManager.download(purchaseItem);

    console.log(`Download completed for: ${purchaseItem.title}`);
    sendResponse({ success: true, result });

  } catch (error) {
    console.error('Single download failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Resolve the download URL for a purchase, fetching it from the album page if necessary
async function resolveDownloadUrlForPurchase(purchase) {
  if (!purchase) {
    throw new Error('No purchase provided for download');
  }

  if (purchase.downloadUrl) {
    return purchase.downloadUrl;
  }

  if (!purchase.url) {
    throw new Error(`Purchase ${purchase.title || ''} is missing an album URL`);
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const tabs = await chrome.tabs.query({ url: '*://*.bandcamp.com/*' });
  let tab = tabs[0];
  let createdTabId = null;

  if (!tab) {
    // If we don't already have a Bandcamp tab, open one to the album page so the content script can resolve the link
    tab = await chrome.tabs.create({ url: purchase.url, active: false });
    createdTabId = tab.id;

    // Wait for tab to complete loading instead of arbitrary timeout
    await new Promise((resolve) => {
      const checkTabStatus = (tabId, changeInfo) => {
        if (tabId === createdTabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(checkTabStatus);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(checkTabStatus);

      // Fallback timeout in case the tab never completes
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(checkTabStatus);
        resolve();
      }, 5000);
    });
  }

  const tabId = tab.id;
  const maxAttempts = 5;
  let lastError = null;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let response;

      try {
        response = await chrome.tabs.sendMessage(tabId, {
          type: 'GET_DOWNLOAD_LINK',
          albumUrl: purchase.url
        });
      } catch (error) {
        const message = (error && error.message) ? error.message : String(error);
        lastError = message;

        // If the content script isn't ready yet, retry a few times
        if (message.includes('Receiving end does not exist') && attempt < maxAttempts - 1) {
          await wait(1000);
          continue;
        }

        break;
      }

      if (response?.navigating) {
        await wait(2000);
        continue;
      }

      if (response?.success && response.downloadUrl) {
        purchase.downloadUrl = response.downloadUrl;
        return response.downloadUrl;
      }

      if (response?.error) {
        lastError = response.error;
        break;
      }

      if (response?.success === false && response.isOwned) {
        lastError = response.message || 'Download link not ready yet';
        await wait(1500);
        continue;
      }

      if (response?.message) {
        lastError = response.message;
      }

      if (attempt < maxAttempts - 1) {
        await wait(1500);
      }
    }
  } finally {
    if (createdTabId !== null) {
      try {
        await chrome.tabs.remove(createdTabId);
      } catch (_) {
        // Ignore failures closing the temporary tab
      }
    }
  }

  throw new Error(lastError || 'Download URL not available for purchase');
}

// Download a single album
async function downloadAlbum(purchase) {
  try {
    const downloadUrl = await resolveDownloadUrlForPurchase(purchase);
    await initiateDownload(downloadUrl, purchase);
  } catch (error) {
    console.error('Error downloading album:', error);
    throw error;
  }
}

// Initiate actual file download
async function initiateDownload(downloadUrl, purchase) {
  try {
    // Navigate to download page which should trigger browser download
    const tabs = await chrome.tabs.query({ url: '*://*.bandcamp.com/*' });
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { url: downloadUrl });
    }
  } catch (error) {
    console.error('Error initiating download:', error);
  }
}

// Handle individual album download request
async function handleDownloadAlbum(data, sendResponse) {
  try {
    await downloadAlbum(data);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Enhanced authentication handler with better cookie detection
async function handleCheckAuthentication(sendResponse) {
  try {
    // Get all Bandcamp cookies for analysis
    const allCookies = await chrome.cookies.getAll({
      domain: 'bandcamp.com'
    });
    
    const subdomainCookies = await chrome.cookies.getAll({
      domain: '.bandcamp.com'
    });
    
    const allBandcampCookies = [...allCookies, ...subdomainCookies];


    // Detailed session cookie analysis
    const sessionCookies = allBandcampCookies.filter(c => c.name.toLowerCase().includes('session'));
    
    // Look for known Bandcamp authentication indicators with stricter validation
    const authCookies = allBandcampCookies.filter(cookie => {
      const cookieName = cookie.name.toLowerCase();
      const cookieValue = cookie.value ? cookie.value.trim() : '';
      
      // Skip empty or very short values (likely not real auth data)
      if (!cookieValue || cookieValue.length < 5) {
        return false;
      }
      
      // Skip common non-auth values
      const nonAuthValues = ['null', 'undefined', '0', 'false', 'anonymous', 'guest'];
      if (nonAuthValues.includes(cookieValue.toLowerCase())) {
        return false;
      }
      
      // More specific authentication patterns
      const strongAuthPatterns = [
        'identity',      // Bandcamp user identity
        'fan_id',        // Fan ID  
        'logged_in',     // Login status
        'user_id',       // User ID
        'auth_token',    // Auth token
        'login_token',   // Login token
        'bc_user',       // Bandcamp user
        'client-id'      // Client identifier
      ];
      
      // Weaker patterns that need additional validation
      const weakAuthPatterns = ['session'];
      
      const hasStrongPattern = strongAuthPatterns.some(pattern => 
        cookieName.includes(pattern)
      );
      
      const hasWeakPattern = weakAuthPatterns.some(pattern => 
        cookieName.includes(pattern)
      );
      
      if (hasStrongPattern) {
        return true;
      }
      
      if (hasWeakPattern) {
        // For session cookies, require longer values that look like real session data
        // Exclude URL-encoded tracking data (contains %XX patterns)
        const hasUrlEncoding = cookieValue.includes('%') && /%[0-9A-F]{2}/i.test(cookieValue);
        const looksLikeTracking = hasUrlEncoding || cookieValue.includes('t%3A') || cookieValue.includes('r%3A');
        
        return cookieValue.length > 20 && 
               !cookieValue.includes('anonymous') &&
               !cookieValue.includes('guest') &&
               !looksLikeTracking;
      }
      
      return false;
    });
    
    // Additional check: look for any cookie that suggests authentication
    const significantCookies = allBandcampCookies.filter(cookie =>
      cookie.value && 
      cookie.value.length > 10 && // Ignore simple flags
      !cookie.name.includes('csrf') && // Ignore CSRF tokens
      !cookie.name.includes('_ga') && // Ignore Google Analytics
      !cookie.name.includes('utm')    // Ignore tracking
    );
    
    const isAuthenticated = authCookies.length > 0;


    sendResponse({
      isAuthenticated: isAuthenticated,
      userInfo: isAuthenticated ? { 
        method: 'service-worker-cookies',
        authCookies: authCookies.length,
        totalCookies: allBandcampCookies.length,
        cookieNames: authCookies.map(c => c.name)
      } : {
        method: 'service-worker-cookies',
        totalCookies: allBandcampCookies.length,
        cookieNames: allBandcampCookies.map(c => c.name)
      },
      lastChecked: Date.now(),
      cacheValid: false
    });

  } catch (error) {
    sendResponse({
      error: error.message,
      isAuthenticated: false
    });
  }
}

// Error handling
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('error', (event) => {
    // Service worker error occurred
  });
  self.addEventListener('unhandledrejection', (event) => {
    // Unhandled promise rejection occurred
  });
}
