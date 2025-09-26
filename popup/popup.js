/**
 * Bandcamp Downloader - Popup Script
 * Handles popup UI interactions and communication with background script
 */

// DOM elements
let elements = {};

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);

async function initializePopup() {
  // Get DOM elements
  elements = {
    authStatus: document.getElementById('authStatus'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    loginBtn: document.getElementById('loginBtn'),
    progressSection: document.getElementById('progressSection'),
    progressStats: document.getElementById('progressStats'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    currentItem: document.getElementById('currentItem'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
    downloadLocation: document.getElementById('downloadLocation'),
    selectLocationBtn: document.getElementById('selectLocationBtn'),
    downloadDelay: document.getElementById('downloadDelay'),
    embedMetadata: document.getElementById('embedMetadata'),
    embedArtwork: document.getElementById('embedArtwork'),
    logContent: document.getElementById('logContent'),
    clearLogBtn: document.getElementById('clearLogBtn')
  };
  
  // Set up event listeners
  setupEventListeners();
  
  // Load initial state
  await loadInitialState();
  
  // Check authentication status
  await checkAuthenticationStatus();
}

function setupEventListeners() {
  // Control buttons
  elements.startBtn.addEventListener('click', handleStartDownload);
  elements.pauseBtn.addEventListener('click', handlePauseDownload);
  elements.stopBtn.addEventListener('click', handleStopDownload);
  elements.loginBtn.addEventListener('click', handleLogin);
  
  // Settings
  elements.selectLocationBtn.addEventListener('click', handleSelectLocation);
  elements.downloadDelay.addEventListener('change', handleSettingsChange);
  elements.embedMetadata.addEventListener('change', handleSettingsChange);
  elements.embedArtwork.addEventListener('change', handleSettingsChange);
  
  // Log
  elements.clearLogBtn.addEventListener('click', handleClearLog);
}

async function loadInitialState() {
  try {
    // Get extension status and settings
    const response = await sendMessageToBackground({ type: 'GET_EXTENSION_STATUS' });
    
    if (response.settings) {
      // Load settings into UI
      elements.downloadLocation.value = response.settings.downloadLocation || 'Browser default';
      elements.downloadDelay.value = response.settings.downloadDelay / 1000 || 2;
      elements.embedMetadata.checked = response.settings.metadataEmbedding !== false;
      elements.embedArtwork.checked = response.settings.artworkEmbedding !== false;
    }
    
    addLogEntry('Extension loaded successfully');
  } catch (error) {
    addLogEntry('Failed to load extension state', 'error');
  }
}

async function checkAuthenticationStatus() {
  try {
    updateAuthStatus('checking', 'Checking authentication...');
    
    // Use the background script's authentication manager
    const response = await sendMessageToBackground({ type: 'CHECK_AUTHENTICATION' });
    
    if (response.error) {
      updateAuthStatus('error', 'Unable to check authentication');
      addLogEntry(`Authentication check failed: ${response.error}`, 'error');
      return;
    }
    
    if (response.isAuthenticated) {
      updateAuthStatus('connected', 'Connected to Bandcamp');
      elements.startBtn.disabled = false;
      elements.loginBtn.style.display = 'none';
      addLogEntry('Authentication verified');
      
      // Show user info if available
      if (response.userInfo && response.userInfo.collectionCount !== undefined) {
        addLogEntry(`Found ${response.userInfo.collectionCount} items in collection`);
      }
    } else {
      updateAuthStatus('error', 'Not logged in to Bandcamp');
      elements.loginBtn.style.display = 'inline-block';
      elements.startBtn.disabled = true;
      addLogEntry('Authentication required - please log in to Bandcamp', 'warning');
    }
  } catch (error) {
    updateAuthStatus('error', 'Unable to check authentication');
    addLogEntry('Authentication check failed', 'error');
  }
}

function updateAuthStatus(status, message) {
  elements.statusText.textContent = message;
  elements.statusIndicator.className = `status-indicator ${status}`;
}

// Event handlers
async function handleStartDownload() {
  try {
    addLogEntry('Discovering purchases and starting downloads...');

    // Preferred: single-step flow handled entirely by background
    let response = await sendMessageToBackground({ type: 'DISCOVER_AND_START' });
    console.log('DISCOVER_AND_START response:', response);

    // Fallback to legacy two-step flow if needed
    if (!response || response.status !== 'started') {
      console.warn('DISCOVER_AND_START failed or unsupported, falling back to two-step flow');
      addLogEntry('Falling back to legacy start flow', 'warning');

      const discoveryResponse = await sendMessageToBackground({ type: 'DISCOVER_PURCHASES' });
      console.log('Discovery response:', discoveryResponse);

      if (!discoveryResponse || !discoveryResponse.success) {
        addLogEntry('Failed to discover purchases: ' + (discoveryResponse?.error || 'Unknown error'), 'error');
        console.error('Discovery failed, response:', discoveryResponse);
        return;
      }

      const purchaseCount = discoveryResponse.purchases ? discoveryResponse.purchases.length : 0;
      addLogEntry(`Found ${purchaseCount} purchases`);
      if (purchaseCount === 0) return;

      if (discoveryResponse.purchases && Array.isArray(discoveryResponse.purchases)) {
        discoveryResponse.purchases.slice(0, 3).forEach(purchase => {
          if (purchase && purchase.title && purchase.artist) {
            addLogEntry(`  • ${purchase.title} by ${purchase.artist}`);
          }
        });
        if (purchaseCount > 3) {
          addLogEntry(`  ... and ${purchaseCount - 3} more`);
        }
      }

      addLogEntry('Starting download process...');
      response = await sendMessageToBackground({
        type: 'START_DOWNLOAD',
        purchases: discoveryResponse.purchases
      });
      console.log('START_DOWNLOAD response:', response);
    }

    if (response && response.status === 'started') {
      elements.progressSection.style.display = 'block';
      elements.startBtn.style.display = 'none';
      elements.pauseBtn.style.display = 'inline-block';
      elements.stopBtn.style.display = 'inline-block';

      elements.progressStats.textContent = `0 of ${response.totalPurchases || 0} albums`;
      addLogEntry('Download started', 'success');
    } else if (response && response.status === 'failed') {
      addLogEntry('Failed to start download: ' + (response.error || 'Unknown error'), 'error');
    } else {
      addLogEntry('No response from download handler', 'error');
      console.error('Invalid or missing response:', response);
    }
  } catch (error) {
    console.error('Error in handleStartDownload:', error);
    addLogEntry('Failed to start download: ' + error.message, 'error');
  }
}

async function handlePauseDownload() {
  try {
    const response = await sendMessageToBackground({ type: 'PAUSE_DOWNLOAD' });
    
    if (response.status === 'paused') {
      elements.pauseBtn.textContent = 'Resume';
      elements.pauseBtn.onclick = handleResumeDownload;
      addLogEntry('Download paused', 'warning');
    }
  } catch (error) {
    addLogEntry('Failed to pause download', 'error');
  }
}

async function handleResumeDownload() {
  try {
    const response = await sendMessageToBackground({ type: 'START_DOWNLOAD' });

    // Check for both 'resumed' (when resuming paused queue) and 'started' (fresh start)
    if (response.status === 'resumed' || response.status === 'started') {
      elements.pauseBtn.textContent = 'Pause';
      elements.pauseBtn.onclick = handlePauseDownload;
      addLogEntry('Download resumed', 'success');
    }
  } catch (error) {
    addLogEntry('Failed to resume download', 'error');
  }
}

async function handleStopDownload() {
  try {
    const response = await sendMessageToBackground({ type: 'STOP_DOWNLOAD' });
    
    if (response.status === 'stopped') {
      elements.progressSection.style.display = 'none';
      elements.startBtn.style.display = 'inline-block';
      elements.pauseBtn.style.display = 'none';
      elements.stopBtn.style.display = 'none';
      
      addLogEntry('Download stopped', 'warning');
    }
  } catch (error) {
    addLogEntry('Failed to stop download', 'error');
  }
}

async function handleLogin() {
  try {
    // Open Bandcamp login page
    await chrome.tabs.create({ url: 'https://bandcamp.com/login' });
    addLogEntry('Opening Bandcamp login page');
    
    // Close popup
    window.close();
  } catch (error) {
    addLogEntry('Failed to open login page', 'error');
  }
}

async function handleSelectLocation() {
  // TODO: Implement folder selection
  // Chrome extensions have limited file system access
  // This will need to be implemented with downloads API
  addLogEntry('Custom folder selection coming soon', 'warning');
}

async function handleSettingsChange() {
  try {
    const settings = {
      downloadDelay: elements.downloadDelay.value * 1000,
      metadataEmbedding: elements.embedMetadata.checked,
      artworkEmbedding: elements.embedArtwork.checked
    };
    
    await chrome.storage.local.set(settings);
    addLogEntry('Settings saved');
  } catch (error) {
    addLogEntry('Failed to save settings', 'error');
  }
}

function handleClearLog() {
  elements.logContent.innerHTML = '<div class="log-entry">Log cleared</div>';
}

// Utility functions
function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    console.log('Sending message to background:', message);
    chrome.runtime.sendMessage(message, (response) => {
      console.log('Received response:', response);
      if (chrome.runtime.lastError) {
        console.error('Chrome runtime error:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

function addLogEntry(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `${timestamp}: ${message}`;
  
  elements.logContent.appendChild(entry);
  elements.logContent.scrollTop = elements.logContent.scrollHeight;
}

// Update progress (will be called by background script)
function updateProgress(stats) {
  if (stats.total > 0) {
    const percentage = Math.round((stats.completed / stats.total) * 100);
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressText.textContent = `${percentage}%`;
    elements.progressStats.textContent = `${stats.completed} of ${stats.total} albums`;

    // Show active downloads count
    if (stats.active !== undefined && stats.active > 0) {
      elements.progressStats.textContent += ` (${stats.active} active)`;
    }

    if (stats.currentAlbum) {
      elements.currentItem.querySelector('.current-album').textContent = stats.currentAlbum;
    }

    if (stats.currentTrack) {
      elements.currentItem.querySelector('.current-track').textContent = stats.currentTrack;
    }

    // Update pause button state based on queue status
    if (typeof stats.isPaused === 'boolean' && elements.pauseBtn) {
      if (stats.isPaused) {
        elements.pauseBtn.textContent = 'Resume';
        elements.pauseBtn.onclick = handleResumeDownload;
      } else if (stats.isActive) {
        elements.pauseBtn.textContent = 'Pause';
        elements.pauseBtn.onclick = handlePauseDownload;
      }
    }
  }
}

// Listen for progress updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_PROGRESS') {
    updateProgress(message.progress);
  }
});
