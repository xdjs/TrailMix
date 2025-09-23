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
      artworkEmbedding: true
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
      handleStartDownload(message.data, sendResponse);
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
  failed: 0
};

// Download handlers
async function handleStartDownload(data, sendResponse) {
  try {
    // First, discover purchases
    const discoveryResponse = await discoverPurchases();
    if (!discoveryResponse.success) {
      sendResponse({ status: 'failed', error: discoveryResponse.error });
      return;
    }

    downloadState.purchases = discoveryResponse.purchases;
    downloadState.isActive = true;
    downloadState.isPaused = false;
    downloadState.currentIndex = 0;
    downloadState.completed = 0;
    downloadState.failed = 0;

    // Start downloading
    processNextDownload();
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

    // Check if we're already on the user's collection page
    const isOnCollection = tab.url.includes('bandcamp.com/') &&
                          (tab.url.endsWith('/collection') ||
                           tab.url.includes('/collection?') ||
                           tab.url.match(/bandcamp\.com\/[^\/]+\/?$/));

    if (!isOnCollection) {
      try {
        console.log('Not on collection page, need to navigate. Current URL:', tab.url);

        // Get the username from the current page
        const authResponse = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_AUTH_STATUS' });
        console.log('Auth response:', authResponse);

        if (authResponse.username) {
          // Navigate to the user's collection page
          const collectionUrl = `https://bandcamp.com/${authResponse.username}`;
          console.log('Navigating to collection URL:', collectionUrl);
          await chrome.tabs.update(tab.id, { url: collectionUrl });

          // Wait for navigation to complete
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Update tab info after navigation
          tab = await chrome.tabs.get(tab.id);
          console.log('After navigation, new URL:', tab.url);
        } else {
          console.log('No username found, trying to get it from home page...');
          // If we can't get username, try to find it from cookies or navigation
          // First, try navigating to the main page to get logged-in user info
          await chrome.tabs.update(tab.id, { url: 'https://bandcamp.com' });
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Try again to get username
          const retryAuth = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_AUTH_STATUS' });
          console.log('Retry auth response:', retryAuth);

          if (retryAuth.username) {
            const collectionUrl = `https://bandcamp.com/${retryAuth.username}`;
            console.log('Found username on retry, navigating to:', collectionUrl);
            await chrome.tabs.update(tab.id, { url: collectionUrl });
            await new Promise(resolve => setTimeout(resolve, 3000));
            tab = await chrome.tabs.get(tab.id);
            console.log('After retry navigation, new URL:', tab.url);
          } else {
            console.error('Could not determine username after retry');
            return { success: false, error: 'Could not determine username. Please visit your Bandcamp collection page manually.' };
          }
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

// Process next download in queue
async function processNextDownload() {
  if (!downloadState.isActive || downloadState.isPaused) {
    return;
  }

  if (downloadState.currentIndex >= downloadState.purchases.length) {
    // All downloads complete
    downloadState.isActive = false;
    return;
  }

  const purchase = downloadState.purchases[downloadState.currentIndex];

  try {
    // Download this album
    await downloadAlbum(purchase);
    downloadState.completed++;
  } catch (error) {
    console.error('Failed to download:', purchase.title, error);
    downloadState.failed++;
  }

  downloadState.currentIndex++;

  // Add delay between downloads
  const settings = await chrome.storage.local.get(['downloadDelay']);
  const delay = settings.downloadDelay || 2000;

  setTimeout(() => {
    processNextDownload();
  }, delay);
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

