/**
 * Bandcamp Downloader - Service Worker
 * Handles extension lifecycle and coordinates between components
 */

// Extension lifecycle management
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Bandcamp Downloader installed:', details.reason);
  
  if (details.reason === 'install') {
    // First time installation
    console.log('First time installation - setting up defaults');
    initializeExtension();
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Extension updated from version:', details.previousVersion);
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Bandcamp Downloader starting up');
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
    
    console.log('Extension initialized with default settings');
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

// Message handling between components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service worker received message:', message.type);
  
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
      
    default:
      console.warn('Unknown message type:', message.type);
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
    console.error('Failed to get status:', error);
    sendResponse({ error: error.message });
  }
}

// Download handlers (placeholder implementations)
function handleStartDownload(data, sendResponse) {
  console.log('Start download requested');
  // TODO: Implement download logic
  sendResponse({ status: 'started' });
}

function handlePauseDownload(sendResponse) {
  console.log('Pause download requested');
  // TODO: Implement pause logic
  sendResponse({ status: 'paused' });
}

function handleStopDownload(sendResponse) {
  console.log('Stop download requested');
  // TODO: Implement stop logic
  sendResponse({ status: 'stopped' });
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

