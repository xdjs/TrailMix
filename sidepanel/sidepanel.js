/**
 * Bandcamp Downloader - Popup Script
 * Handles popup UI interactions and communication with background script
 */

// DOM elements
let elements = {};

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup);

// Listen for when side panel becomes visible again
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    console.log('Side panel became visible, re-checking authentication...');
    await checkAuthenticationStatus();
  }
});

// Listen for tab updates to detect when user completes login
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If a Bandcamp tab finished loading, re-check authentication
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('bandcamp.com')) {
    console.log('Bandcamp tab loaded, re-checking authentication...');
    checkAuthenticationStatus();
  }
});

async function initializePopup() {
  // Get DOM elements
  elements = {
    authStatus: document.getElementById('authStatus'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    loginBtn: document.getElementById('loginBtn'),
    discoverySection: document.getElementById('discoverySection'),
    discoverySpinner: document.getElementById('discoverySpinner'),
    discoveryText: document.getElementById('discoveryText'),
    discoveryCancelBtn: document.getElementById('discoveryCancelBtn'),
    progressSection: document.getElementById('progressSection'),
    progressStats: document.getElementById('progressStats'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    currentItem: document.getElementById('currentItem'),
    controlsSection: document.querySelector('.controls-section'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
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
  // Pause button handler is set dynamically via onclick to toggle between pause/resume
  elements.pauseBtn.onclick = handlePauseDownload; // Initial state is pause
  elements.stopBtn.addEventListener('click', handleStopDownload);
  elements.discoveryCancelBtn.addEventListener('click', handleDiscoveryCancel);
  elements.loginBtn.addEventListener('click', handleLogin);

  // Log
  elements.clearLogBtn.addEventListener('click', handleClearLog);
}

async function loadInitialState() {
  try {
    // Get extension status and settings
    const response = await sendMessageToBackground({ type: 'GET_EXTENSION_STATUS' });

    // Settings are loaded but no longer displayed in UI

    // Restore download state if there's an active or paused queue
    if (response.downloadState) {
      const state = response.downloadState;

      if (state.isActive || state.isPaused || state.queueSize > 0) {
        // Show progress section since we have an active/paused queue
        elements.progressSection.style.display = 'block';
        elements.progressSection.classList.add('active');
        elements.pauseBtn.style.display = 'inline-block';
        elements.stopBtn.style.display = 'inline-block';
        updateStartButtonVisibility(true, true); // authenticated=true, downloadActive=true

        // Update progress display
        if (state.total > 0) {
          const percentage = Math.round((state.completed / state.total) * 100);
          elements.progressFill.style.width = `${percentage}%`;
          elements.progressText.textContent = `${percentage}%`;
          elements.progressStats.textContent = formatProgressStats(percentage, state.completed, state.total);
        }

        // Set correct button state
        if (state.isPaused) {
          elements.pauseBtn.textContent = 'Resume';
          elements.pauseBtn.onclick = handleResumeDownload;
          addLogEntry(`Queue restored: ${state.queueSize} items pending, ${state.completed} completed`, 'info');
        } else if (state.isActive) {
          elements.pauseBtn.textContent = 'Pause';
          elements.pauseBtn.onclick = handlePauseDownload;
          addLogEntry(`Downloads in progress: ${state.completed} of ${state.total} completed`, 'info');
        }
      }
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
      updateStartButtonVisibility(true, false);
      elements.startBtn.disabled = false;
      elements.loginBtn.style.display = 'none';
      addLogEntry('Authentication verified');
      
      // Show user info if available
      if (response.userInfo && response.userInfo.collectionCount !== undefined) {
        addLogEntry(`Found ${response.userInfo.collectionCount} items in collection`);
      }
    } else {
      updateAuthStatus('not-logged-in', 'Not logged in to Bandcamp');
      elements.loginBtn.style.display = 'inline-block';
      updateStartButtonVisibility(false, false);
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

function updateStartButtonVisibility(isAuthenticated, isDownloadActive) {
  if (isAuthenticated && !isDownloadActive) {
    elements.startBtn.classList.add('visible');
  } else {
    elements.startBtn.classList.remove('visible');
  }
}

function formatProgressStats(percentage, completed, total, active) {
  let stats = `${percentage}% (${completed} of ${total} albums)`;
  if (active !== undefined && active > 0) {
    stats += ` (${active} active)`;
  }
  return stats;
}

// Discovery view helpers
function showDiscoveryView() {
  // Hide controls section (Start Download button)
  elements.controlsSection.style.display = 'none';

  // Show discovery view
  elements.discoverySection.style.display = 'block';

  // Reset to loading state
  elements.discoverySpinner.style.display = 'block';
  elements.discoveryText.textContent = 'Finding purchases...';
}

function hideDiscoveryView() {
  elements.discoverySection.style.display = 'none';

  // Show controls section again
  elements.controlsSection.style.display = 'block';
}

function showDiscoveryError(errorMessage) {
  // Hide spinner and show error text
  elements.discoverySpinner.style.display = 'none';
  elements.discoveryText.textContent = errorMessage;
}

// Event handlers
async function handleStartDownload() {
  try {
    // Show discovery interstitial view
    showDiscoveryView();
    addLogEntry('Discovering purchases...');

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
        const errorMsg = discoveryResponse?.error || 'Unknown error';
        addLogEntry('Failed to discover purchases: ' + errorMsg, 'error');
        console.error('Discovery failed, response:', discoveryResponse);
        showDiscoveryError(errorMsg);
        return;
      }

      const purchaseCount = discoveryResponse.purchases ? discoveryResponse.purchases.length : 0;

      // Handle no purchases found
      if (purchaseCount === 0) {
        addLogEntry('No purchases found');
        showDiscoveryError('No purchases found');
        return;
      }

      addLogEntry(`Found ${purchaseCount} purchases`);
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
      // Hide discovery view and show progress view
      hideDiscoveryView();
      elements.progressSection.style.display = 'block';
      elements.progressSection.classList.add('active');
      elements.pauseBtn.style.display = 'inline-block';
      elements.stopBtn.style.display = 'inline-block';
      updateStartButtonVisibility(true, true); // authenticated=true, downloadActive=true

      elements.progressStats.textContent = formatProgressStats(0, 0, response.totalPurchases || 0);
      addLogEntry('Download started', 'success');
    } else if (response && response.status === 'failed') {
      const errorMsg = response.error || 'Unknown error';
      addLogEntry('Failed to start download: ' + errorMsg, 'error');
      showDiscoveryError(errorMsg);
    } else {
      addLogEntry('No response from download handler', 'error');
      console.error('Invalid or missing response:', response);
      showDiscoveryError('No response from download handler');
    }
  } catch (error) {
    console.error('Error in handleStartDownload:', error);
    addLogEntry('Failed to start download: ' + error.message, 'error');
    showDiscoveryError(error.message);
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
      elements.progressSection.classList.remove('active');
      elements.pauseBtn.style.display = 'none';
      elements.stopBtn.style.display = 'none';
      updateStartButtonVisibility(true, false); // authenticated=true, downloadActive=false

      addLogEntry('Download stopped', 'warning');
    }
  } catch (error) {
    addLogEntry('Failed to stop download', 'error');
  }
}

async function handleDiscoveryCancel() {
  try {
    // Use same logic as stop download to cancel any in-progress operations
    const response = await sendMessageToBackground({ type: 'STOP_DOWNLOAD' });

    if (response.status === 'stopped') {
      // Hide discovery view and return to start state
      hideDiscoveryView();
      updateStartButtonVisibility(true, false); // authenticated=true, downloadActive=false
      addLogEntry('Discovery cancelled', 'warning');
    }
  } catch (error) {
    addLogEntry('Failed to cancel discovery', 'error');
    // Still hide the view even if cancel failed
    hideDiscoveryView();
    updateStartButtonVisibility(true, false);
  }
}

async function handleLogin() {
  try {
    // Open Bandcamp login page in a new tab (keep side panel open)
    await chrome.tabs.create({ url: 'https://bandcamp.com/login', active: true });
    addLogEntry('Opening Bandcamp login page in new tab');
    addLogEntry('Side panel will remain open - return here after logging in', 'info');
  } catch (error) {
    addLogEntry('Failed to open login page', 'error');
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

    // Update progress stats text
    elements.progressStats.textContent = formatProgressStats(percentage, stats.completed, stats.total, stats.active);

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
