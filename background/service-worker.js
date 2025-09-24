/**
 * Trail Mix - Service Worker
 * Handles extension lifecycle and coordinates between components
 */

// Service worker runs independently - no external imports needed

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

    case 'DOWNLOAD_ALBUM':
      handleDownloadAlbum(message.data, sendResponse);
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
  downloadQueue: []            // Queue of pending downloads
};

// Download handlers
async function handleStartDownload(data, sendResponse) {
  try {
    // Use purchases passed from popup if available, otherwise discover
    if (data && data.purchases) {
      downloadState.purchases = data.purchases;
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

    console.log('Download state initialized:', downloadState);
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
    sendResponse(response);
  } catch (error) {
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
      // Make sure the tab is active
      await chrome.tabs.update(tab.id, { active: true });
    } else {
      // Create a new tab with Bandcamp
      tab = await chrome.tabs.create({ url: 'https://bandcamp.com', active: true });
      // Wait for it to load
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Check if we're already on the purchases page
    const isOnPurchases = tab.url.includes('/purchases');

    if (!isOnPurchases) {
      try {
        console.log('Not on purchases page, need to navigate. Current URL:', tab.url);

        // Send message to content script to find and navigate to purchases page
        const navResponse = await chrome.tabs.sendMessage(tab.id, { type: 'NAVIGATE_TO_PURCHASES' });
        console.log('Navigation response:', navResponse);

        if (navResponse.success && navResponse.purchasesUrl) {
          // Navigate to the purchases URL
          console.log('Navigating to purchases URL:', navResponse.purchasesUrl);
          await chrome.tabs.update(tab.id, { url: navResponse.purchasesUrl });

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

    // TEST: Open a new tab after scraping
    console.log('TEST: Opening new tab after scraping purchases...');
    await chrome.tabs.create({ url: 'https://www.google.com', active: false });
    console.log('TEST: New tab created');

    return scrapeResponse;
  } catch (error) {
    console.error('Error discovering purchases:', error);
    return { success: false, error: error.message };
  }
}

// Process downloads with parallel management
async function processNextDownload() {
  console.log('processNextDownload called. Active:', downloadState.isActive, 'Paused:', downloadState.isPaused);
  console.log('Current index:', downloadState.currentIndex, 'Total purchases:', downloadState.purchases.length);

  if (!downloadState.isActive || downloadState.isPaused) {
    return;
  }

  // Get configured max concurrent downloads
  const settings = await chrome.storage.local.get(['maxConcurrentDownloads']);
  const maxConcurrent = settings.maxConcurrentDownloads || 3; // Default to 3

  console.log('Max concurrent:', maxConcurrent, 'Active downloads:', downloadState.activeDownloads.size);

  // Check if we can start more downloads
  while (downloadState.activeDownloads.size < maxConcurrent &&
         downloadState.currentIndex < downloadState.purchases.length) {

    const purchase = downloadState.purchases[downloadState.currentIndex];
    downloadState.currentIndex++;

    console.log('Starting download', downloadState.currentIndex, 'of', downloadState.purchases.length);

    // Start download in parallel
    startParallelDownload(purchase);
  }

  // Check if all downloads are complete
  if (downloadState.activeDownloads.size === 0 &&
      downloadState.currentIndex >= downloadState.purchases.length) {
    downloadState.isActive = false;
    console.log(`Downloads complete: ${downloadState.completed} successful, ${downloadState.failed} failed`);
  }
}

// Start a download in parallel
async function startParallelDownload(purchase) {
  try {
    console.log('Starting download for:', purchase.title, 'URL:', purchase.downloadUrl);

    // If we already have the download URL, use it directly
    if (purchase.downloadUrl) {
      // Create a new tab for this download
      const tab = await chrome.tabs.create({
        url: purchase.downloadUrl,
        active: false  // Don't switch to the tab
      });

      console.log('Created tab', tab.id, 'for', purchase.title);

      // Track this download
      downloadState.activeDownloads.set(tab.id, {
        purchase: purchase,
        tabId: tab.id,
        status: 'downloading'
      });

      // Monitor the tab for download completion
      monitorDownloadTab(tab.id, purchase);
    } else {
      // Fallback to old method if no download URL
      await downloadAlbum(purchase);
    }
  } catch (error) {
    console.error('Failed to start download:', purchase.title, error);
    downloadState.failed++;

    // Process next download
    processNextDownload();
  }
}

// Monitor a download tab for completion
async function monitorDownloadTab(tabId, purchase) {
  try {
    // Initial delay to let page load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send message to content script to monitor download page
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'MONITOR_DOWNLOAD_PAGE'
      });

      if (response && response.success) {
        console.log(`Download monitoring started for ${purchase.title}: ${response.status}`);
      }
    } catch (err) {
      console.log('Content script not ready yet, will retry...');
    }

    // Monitor the tab for changes
    const checkInterval = setInterval(async () => {
      try {
        const tab = await chrome.tabs.get(tabId);

        // Check if tab still exists
        if (!tab) {
          clearInterval(checkInterval);
          handleDownloadComplete(tabId, purchase);
          return;
        }

        // Check various completion indicators
        if (tab.url && (
          tab.url.includes('download_complete') ||
          tab.url.includes('thank-you') ||
          tab.url.includes('.zip') ||  // Direct download file
          tab.url.startsWith('blob:')   // Downloaded blob
        )) {
          clearInterval(checkInterval);

          // Wait a bit for download to fully start
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Close the tab
          try {
            await chrome.tabs.remove(tabId);
          } catch (e) {
            // Tab may already be closed
          }

          handleDownloadComplete(tabId, purchase);
        }
      } catch (error) {
        // Tab was likely closed
        clearInterval(checkInterval);
        handleDownloadComplete(tabId, purchase);
      }
    }, 2000); // Check every 2 seconds

    // Set a timeout to prevent infinite monitoring
    setTimeout(() => {
      clearInterval(checkInterval);
      handleDownloadComplete(tabId, purchase);
    }, 120000); // 2 minute timeout

  } catch (error) {
    console.error('Error monitoring download tab:', error);
    handleDownloadComplete(tabId, purchase);
  }
}

// Handle download completion
function handleDownloadComplete(tabId, purchase) {
  // Remove from active downloads
  downloadState.activeDownloads.delete(tabId);

  // Update stats
  downloadState.completed++;

  console.log(`Download complete: ${purchase.title} (${downloadState.completed}/${downloadState.purchases.length})`);

  // Send progress update to popup
  broadcastProgress();

  // Process next download
  setTimeout(() => {
    processNextDownload();
  }, 1000); // Small delay between starting next download
}

// Broadcast progress to popup
function broadcastProgress() {
  const progress = {
    total: downloadState.purchases.length,
    completed: downloadState.completed,
    failed: downloadState.failed,
    active: downloadState.activeDownloads.size,
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

// Listen for Chrome download events
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state) {
    if (downloadDelta.state.current === 'complete') {
      console.log(`Chrome download completed: ${downloadDelta.id}`);

      // Track completed downloads
      chrome.downloads.search({ id: downloadDelta.id }, (downloads) => {
        if (downloads && downloads.length > 0) {
          const download = downloads[0];
          console.log(`Downloaded file: ${download.filename}`);

          // Could match this to our purchase tracking if needed
        }
      });
    } else if (downloadDelta.state.current === 'interrupted') {
      console.error(`Download interrupted: ${downloadDelta.id}`);
    }
  }
});

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

// Download a single album
async function downloadAlbum(purchase) {
  try {
    // Find or create a Bandcamp tab
    const tabs = await chrome.tabs.query({ url: '*://*.bandcamp.com/*' });
    let tab = tabs[0];

    // Get download link from the album page
    const linkResponse = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_DOWNLOAD_LINK',
      albumUrl: purchase.url
    });

    if (linkResponse.navigating) {
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try again after navigation
      const retryResponse = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_DOWNLOAD_LINK',
        albumUrl: purchase.url
      });

      if (retryResponse.success && retryResponse.downloadUrl) {
        await initiateDownload(retryResponse.downloadUrl, purchase);
      }
    } else if (linkResponse.success && linkResponse.downloadUrl) {
      await initiateDownload(linkResponse.downloadUrl, purchase);
    }
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
self.addEventListener('error', (event) => {
  // Service worker error occurred
});

self.addEventListener('unhandledrejection', (event) => {
  // Unhandled promise rejection occurred
});

