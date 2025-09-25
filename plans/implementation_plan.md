# Trail Mix - Implementation Plan

## 🎉 Project Status: Phase 3 Complete — Moving to Phase 4

**✅ PHASE 1 COMPLETED** - Chrome Extension Foundation
**✅ PHASE 2 SIMPLIFIED** - Basic Authentication (Login button opens Bandcamp login)
**✅ PHASE 3 COMPLETED** - Purchase Discovery & Parallel Download Start
**📊 Progress**: Discovery via pagedata + normalized download URLs; tabs spawn with configurable concurrency
**🧪 Testing**: Manual runs confirm 3 concurrent tabs; diagnostics added in service worker
**🚀 Status**: One-step kickoff (`DISCOVER_AND_START`) implemented; ready to evolve download manager (Phase 4)

### Recent Achievements:
- ✅ **Phase 1 Complete**: Full Chrome extension foundation
- ✅ **Phase 2 Simplified**: Authentication detection works, login opens in new tab
- ✅ Session detection properly identifies logged-in/logged-out states
- ✅ Robust error handling for cookie API failures and network errors
- ✅ Service worker message handling for authentication status checks

### Strategic Decision:
**Focusing on Core Functionality First** - Getting the essential flow working:
1. Detect login state ✅
2. Find user's purchases ✅ (Phase 3)
3. Start parallel downloads via tabs ✅ (Phase 3)
4. Build download manager + metadata (Phase 4/5 - Upcoming)
5. Then circle back to polish UI and advanced features

### Phase 1 Foundation:
- ✅ Complete Chrome extension structure implemented
- ✅ Service worker with lifecycle management
- ✅ Popup UI with complete interface and styling
- ✅ Content script for Bandcamp page interaction
- ✅ Comprehensive utility library with error handling
- ✅ Full testing infrastructure with Jest and Chrome API mocks
- ✅ Git repository initialized with all code committed

**🔄 Next**: Phase 4 Task 4.2 - Redesign Queue Management System

---

## 📋 Up Next - Priority Todo List

### Active Development Tasks
1. **Redesign and reimplement queue management from scratch**
   - Start fresh with new architecture
   - Better integration with download manager
   - Support for batch operations

2. **Create DownloadJob class for state tracking**
   - Encapsulate download state and metadata
   - Track progress, errors, and retry attempts
   - Enable serialization for persistence

3. **Implement retry logic with exponential backoff**
   - Handle transient network failures
   - Max 3 retry attempts by default
   - Exponential backoff (2^n seconds)

4. **Add error classification and handling**
   - Categorize errors (network, permission, disk, auth)
   - Different strategies per error type
   - User-friendly error messages

5. **Implement pause/resume functionality**
   - Individual and queue-wide pause/resume
   - Persist state across sessions
   - Resume from interruption point

6. **Implement file organization system**
   - Create Downloads/Bandcamp/Artist/Album/ structure
   - Sanitize filenames for filesystem compatibility
   - Handle duplicates with numbering

7. **Research and implement album ZIP file handling**
   - Evaluate extraction vs keeping as ZIP
   - Consider memory constraints
   - User preference for format

8. **Implement pagination handling for purchases page**
   - Handle infinite scroll/load more buttons
   - Support large collections (100+ albums)
   - Track loaded vs total purchases

---

## Overview
This document outlines the detailed implementation plan for the Trail Mix Chrome extension based on the PRD requirements. The extension will enable users to bulk-download their paid Bandcamp purchases in MP3 format with embedded metadata and artwork.

## Architecture Overview

### Core Components
1. **Chrome Extension Framework**
   - Manifest V3 configuration
   - Background service worker
   - Content scripts for DOM parsing
   - Extension popup UI

2. **Authentication Module**
   - Session cookie management
   - Login credential handling
   - Bandcamp session validation

3. **Purchase Discovery Module**
   - DOM scraping of purchases page
   - Album/track metadata extraction
   - Download link discovery

4. **Download Manager**
   - Sequential download orchestration
   - Progress tracking
   - Error handling and retry logic
   - Resume functionality

5. **Metadata & Organization Module**
   - ID3 tag embedding
   - Album artwork handling
   - File organization system

6. **UI Components**
   - Progress dashboard
   - Download controls
   - Error reporting

## Testing Framework & Strategy

### Testing Architecture
- **Unit Tests**: Jest-based testing for individual functions and modules
- **Integration Tests**: Chrome extension API testing with mock environments
- **Acceptance Tests**: End-to-end workflow validation with real Bandcamp scenarios
- **Mock Data**: Comprehensive test data sets for various Bandcamp account types

### Testing Structure
```
tests/
├── unit/
│   ├── auth-manager.test.js
│   ├── download-manager.test.js
│   ├── metadata-handler.test.js
│   └── utils.test.js
├── integration/
│   ├── extension-lifecycle.test.js
│   ├── content-script.test.js
│   └── api-integration.test.js
├── acceptance/
│   ├── complete-workflow.test.js
│   ├── error-scenarios.test.js
│   └── performance.test.js
├── mock-data/
│   ├── bandcamp-pages/
│   ├── sample-albums/
│   └── test-accounts/
└── fixtures/
    ├── dom-snapshots/
    └── api-responses/
```

### Test Coverage Requirements
- **Minimum 85% code coverage** for all modules
- **100% coverage** for critical paths (authentication, download, metadata)
- **Acceptance tests** for every user-facing feature
- **Performance benchmarks** for large library scenarios

## Detailed Implementation Plan with Tasks

### Phase 1: Project Setup & Chrome Extension Foundation (Week 1) ✅ COMPLETED

**Duration**: 5 days ✅ COMPLETED  
**Dependencies**: None  
**Deliverables**: ✅ Working Chrome extension shell with basic structure  
**Status**: ✅ ALL TASKS COMPLETED - 22/22 unit tests passing - Extension loads successfully in Chrome

#### Task 1.1: Initialize Project Structure (Day 1) ✅ COMPLETED
- [x] Create root project directory: `bandcamp-downloader/`
- [x] Set up folder structure:
  ```
  bandcamp-downloader/
  ├── manifest.json
  ├── background/
  │   └── service-worker.js
  ├── content/
  │   └── bandcamp-scraper.js
  ├── popup/
  │   ├── popup.html
  │   ├── popup.js
  │   └── popup.css
  ├── lib/
  │   ├── auth-manager.js
  │   ├── download-manager.js
  │   ├── metadata-handler.js
  │   └── utils.js
  ├── assets/
  │   ├── icons/
  │   └── styles/
  ├── tests/
  │   ├── mock-data/
  │   └── unit/
  └── docs/
  ```
- [x] Initialize Git repository
- [x] Create basic README.md with setup instructions

**Unit Tests:**
- [x] Test project structure validation script
- [x] Test file path utilities
- [x] Test Git initialization verification

**Acceptance Test:**
- [x] **AC1.1**: All required directories are created
- [x] **AC1.2**: Git repository is properly initialized
- [x] **AC1.3**: README.md contains setup instructions
- [x] **AC1.4**: Project structure matches specification

#### Task 1.2: Create Manifest V3 Configuration (Day 1) ✅ COMPLETED
- [x] Create `manifest.json` with basic extension metadata
- [x] Define required permissions:
  - [x] `downloads` - for managing file downloads
  - [x] `cookies` - for session management
  - [x] `activeTab` - for current tab access
  - [x] `storage` - for extension settings
  - [x] `scripting` - for content script injection
- [x] Add host permissions for `*.bandcamp.com`
- [x] Configure content security policy
- [x] Set up extension icons (16x16, 32x32, 48x48, 128x128)

**Unit Tests:**
- [x] Test manifest.json schema validation
- [x] Test permission configuration parsing
- [x] Test CSP policy validation
- [x] Test icon file existence and dimensions

**Acceptance Test:**
- [x] **AC1.2.1**: Manifest V3 format is valid and loads in Chrome
- [x] **AC1.2.2**: All required permissions are declared
- [x] **AC1.2.3**: Host permissions include *.bandcamp.com
- [x] **AC1.2.4**: Extension icons display correctly in all sizes
- [x] **AC1.2.5**: CSP allows required functionality

#### Task 1.3: Implement Service Worker Foundation (Day 2) ✅ COMPLETED
- [x] Create `background/service-worker.js`
- [x] Implement extension lifecycle management:
  - [x] `chrome.runtime.onInstalled` handler
  - [x] `chrome.runtime.onStartup` handler
- [x] Set up message passing system between components
- [x] Add basic error handling and logging
- [x] Test service worker activation

**Unit Tests:**
- [x] Test service worker lifecycle event handlers
- [x] Test message passing system functionality
- [x] Test error handling and logging functions
- [x] Test service worker registration and activation
- [x] Mock Chrome runtime API calls

**Acceptance Test:**
- [x] **AC1.3.1**: Service worker activates on extension install
- [x] **AC1.3.2**: Lifecycle events trigger appropriate handlers
- [x] **AC1.3.3**: Message passing works between service worker and other components
- [x] **AC1.3.4**: Errors are logged with appropriate detail
- [x] **AC1.3.5**: Service worker persists across browser sessions

#### Task 1.4: Create Popup UI Shell (Day 2-3) ✅ COMPLETED
- [x] Design popup layout in `popup/popup.html`:
  - [x] Header with extension title
  - [x] Authentication status section
  - [x] Progress dashboard area
  - [x] Control buttons section
  - [x] Settings/options area
- [x] Create basic CSS styling in `popup/popup.css`
- [x] Implement popup JavaScript controller in `popup/popup.js`
- [x] Add popup-to-background communication

**Unit Tests:**
- [x] Test popup HTML structure validation
- [x] Test CSS styling and responsive layout
- [x] Test popup JavaScript initialization
- [x] Test popup-to-background message handling
- [x] Test UI component rendering

**Acceptance Test:**
- [x] **AC1.4.1**: Popup opens with correct dimensions and layout
- [x] **AC1.4.2**: All UI sections are properly styled and positioned
- [x] **AC1.4.3**: Popup communicates successfully with background script
- [x] **AC1.4.4**: UI elements are accessible and keyboard navigable
- [x] **AC1.4.5**: Popup closes and reopens without state issues

#### Task 1.5: Set Up Content Script Infrastructure (Day 3) ✅ COMPLETED
- [x] Create `content/bandcamp-scraper.js`
- [x] Implement content script injection system
- [x] Add DOM ready detection
- [x] Set up content-to-background messaging
- [x] Create utility functions for DOM manipulation

**Unit Tests:**
- [x] Test content script injection mechanism
- [x] Test DOM ready detection functions
- [x] Test content-to-background messaging
- [x] Test DOM manipulation utilities
- [x] Mock Bandcamp page structures for testing

**Acceptance Test:**
- [x] **AC1.5.1**: Content script injects successfully on Bandcamp pages
- [x] **AC1.5.2**: DOM ready detection works reliably
- [x] **AC1.5.3**: Content script can communicate with background script
- [x] **AC1.5.4**: DOM utilities function correctly on real Bandcamp pages
- [x] **AC1.5.5**: Content script doesn't interfere with page functionality

#### Task 1.6: Create Core Library Modules (Day 4) ✅ COMPLETED
- [x] Create `lib/utils.js` with common utilities:
  - [x] Logging functions
  - [x] Error handling helpers
  - [x] String sanitization functions
  - [x] File path utilities
- [x] Create empty module files:
  - [x] `lib/auth-manager.js`
  - [x] `lib/download-manager.js`
  - [x] `lib/metadata-handler.js`
- [x] Add module export/import structure

**Unit Tests:**
- [x] Test logging functions with various log levels
- [x] Test error handling helper functions
- [x] Test string sanitization with edge cases
- [x] Test file path utilities across platforms
- [x] Test module import/export functionality

**Acceptance Test:**
- [x] **AC1.6.1**: Utils module functions work correctly in isolation
- [x] **AC1.6.2**: Error handling provides meaningful error information
- [x] **AC1.6.3**: String sanitization handles special characters safely
- [x] **AC1.6.4**: File path utilities work on Windows, Mac, and Linux
- [x] **AC1.6.5**: Module structure supports future development needs

#### Task 1.7: Extension Testing & Validation (Day 5) ✅ COMPLETED
- [x] Load extension in Chrome developer mode
- [x] Test popup opens correctly
- [x] Verify service worker loads without errors
- [x] Test content script injection on bandcamp.com
- [x] Validate all permissions are working
- [x] Create basic smoke test checklist

**Unit Tests:**
- [x] Test manifest.json validation
- [x] Test service worker lifecycle functions
- [x] Test popup DOM structure and basic functionality
- [x] Test content script injection and messaging
- [x] Test utility functions (logging, error handling, sanitization)

**Acceptance Test:**
- [x] **AC1.1**: Extension loads successfully in Chrome developer mode
- [x] **AC1.2**: Popup opens when extension icon is clicked
- [x] **AC1.3**: Service worker starts without console errors
- [x] **AC1.4**: Content script injects on bandcamp.com pages
- [x] **AC1.5**: All required permissions are granted and functional
- [x] **AC1.6**: Extension icon displays correctly in browser toolbar

### Phase 2: Authentication & Session Management ✅ SIMPLIFIED

**Status**: Core authentication working - deferring advanced features for later version
**Implementation**: Login button opens Bandcamp login page in new tab
**Completed**:
- ✅ Session detection using cookies
- ✅ Login/logout state tracking
- ✅ Basic login flow (opens Bandcamp login page)

#### Task 2.1: Implement Session Detection ✅ COMPLETED
- [x] Create `lib/auth-manager.js` core functionality
- [x] Implement cookie-based session validation:
  - [x] Read Bandcamp session cookies using Chrome cookies API
  - [x] Validate session by checking authentication endpoints
  - [x] Detect logged-in vs logged-out state
- [x] Create session status checking functions
- [x] Add session state caching to avoid repeated checks
- [x] Test session detection with logged-in/out states

**Unit Tests:**
- [x] Test session cookie parsing and validation with URL-encoded tracking data filtering
- [x] Test authentication state management and caching
- [x] Test service worker message handling for authentication checks
- [x] Test error handling for cookie API failures, network errors, and validation failures
- [x] Test authentication status detection for both logged-in and logged-out states

**Acceptance Test:**
- [x] **AC2.1**: Service worker responds to CHECK_AUTHENTICATION messages
- [x] **AC2.2**: Correctly identifies logged-in state when valid authentication cookies present
- [x] **AC2.3**: Correctly identifies logged-out state (excludes URL-encoded tracking cookies)
- [x] **AC2.4**: Handles authentication errors gracefully (cookie API failures, network errors, validation errors)

#### Tasks 2.2-2.6: DEFERRED TO LATER VERSION
**Rationale**: Basic authentication is working (login button opens Bandcamp login page).
Advanced features like in-extension login forms, session monitoring, and state management
will be implemented after core download functionality is proven.

**What's Working Now**:
- ✅ Cookie-based session detection
- ✅ Login button that opens Bandcamp login
- ✅ Automatic detection of login state changes
- ✅ No credential storage (security requirement met)

### Phase 3: Purchase Discovery & Core Download ✅ COMPLETED

**Status**: Core functionality implemented with parallel download system
**Focus**: Discover purchases and download with configurable parallel processing
**Dependencies**: Basic authentication (✅ complete)
**Deliverables**: Purchase discovery, parallel downloads, Chrome Downloads API integration

Additional outcome:
- ✅ Single-step kickoff route `DISCOVER_AND_START` implemented in service worker
- ✅ Popup updated to prefer `DISCOVER_AND_START` with legacy fallback
- ✅ Tabs opened in background (inactive) to keep popup open during discovery

#### Task 3.1: Purchases Page Navigation ✅ COMPLETED
- [x] Implement purchases page navigation:
  - [x] Extract username from Collection button href
  - [x] Construct purchases URL: `https://bandcamp.com/{username}/purchases`
  - [x] Navigate directly to purchases page (no UI clicking needed)
- [x] Handle page detection:
  - [x] Check if already on purchases page
  - [x] Detect collection/purchases page variations
  - [x] Add robust fallback methods
- [x] Add DOM waiting and loading detection:
  - [x] Wait for collection-grid elements to load
  - [x] Handle multiple selector variations
  - [x] 10-second timeout for slow connections

#### Task 3.2: Album Discovery & Parsing ✅ COMPLETED
- [x] Analyze Bandcamp purchases page DOM structure
- [x] Create robust CSS selectors for album elements:
  - [x] `ol.collection-grid li.collection-item-container`
  - [x] Multiple fallback selectors for different layouts
- [x] Implement album information extraction:
  - [x] Album title extraction from `.collection-item-title`
  - [x] Artist name extraction from `.collection-item-artist`
  - [x] Purchase date extraction (if available)
  - [x] Album URL extraction from item links
  - [x] Thumbnail artwork URL extraction
- [x] Add fallback selectors for DOM structure changes
- [x] Create album data structure with download URLs
- [x] Test with purchases page layout

#### Task 3.3: Download Link Extraction ✅ COMPLETED
**Note**: Download links are directly available on purchases page - no need to navigate to individual album pages!
- [x] Extract download links from purchases page:
  - [x] Find `a[href*="/download/album"]` and `a[href*="/download/track"]` links
  - [x] Extract download URLs directly from purchase items
  - [x] Store download URLs with purchase metadata
- [x] Skip individual album page navigation (not needed)
- [x] Implement parallel download architecture:
  - [x] Configurable MAX_CONCURRENT_DOWNLOADS (default: 3)
  - [x] Tab pool management for parallel downloads
  - [x] Active download tracking with Map structure

#### Task 3.4: Download Page Processing ✅ COMPLETED
- [x] Handle download page states:
  - [x] Detect "Preparing" state on download pages
  - [x] Monitor for download button appearance
  - [x] Auto-click download button when ready
  - [x] 30-second timeout for preparation
- [x] Implement download monitoring:
  - [x] Track tab states for completion
  - [x] Detect download_complete or thank-you pages
  - [x] Auto-close tabs after download starts
- [x] Add Chrome Downloads API integration:
  - [x] Listen for download state changes
  - [x] Track completed downloads
  - [x] Helper function for direct download initiation

#### Task 3.5: Parallel Download Management ✅ COMPLETED
- [x] Create parallel download system:
  - [x] Implement `startParallelDownload()` function
  - [x] Track active downloads with Map structure
  - [x] Queue management for pending downloads
- [x] Add configurable concurrency:
  - [x] `maxConcurrentDownloads` setting (default: 3)
  - [x] Dynamic spawning of new downloads as others complete
  - [x] Prevent overwhelming browser with too many tabs
- [x] Implement progress tracking:
  - [x] Real-time progress broadcasting to popup
  - [x] Track completed, failed, and active counts
  - [x] Display active download count in UI

#### Task 3.6: Pagination Handling
- [ ] Implement infinite scroll detection:
  - [ ] Detect when user's purchases use pagination
  - [ ] Check for "Load More" button or scroll trigger
  - [ ] Monitor for dynamically loaded content
- [ ] Create pagination navigation:
  - [ ] Automatically scroll to load more purchases
  - [ ] Handle "Load More" button clicks if present
  - [ ] Wait for new content to load before continuing
- [ ] Implement complete collection scanning:
  - [ ] Keep loading until all purchases found
  - [ ] Track total vs loaded purchase count
  - [ ] Handle very large collections (100+ albums)
- [ ] Add pagination error handling:
  - [ ] Handle network errors during pagination
  - [ ] Retry failed page loads
  - [ ] Set maximum pagination attempts

#### Task 3.7: Download Completion Handling ✅ COMPLETED
- [x] Monitor download tabs:
  - [x] Check for completion indicators every 2 seconds
  - [x] Detect download_complete, thank-you, or .zip URLs
  - [x] 2-minute timeout for stuck downloads
- [x] Handle tab lifecycle:
  - [x] Auto-close tabs after download starts
  - [x] Clean up tracking data on completion
  - [x] Start next download from queue
- [x] Error handling:
  - [x] Track failed downloads separately
  - [x] Continue processing queue on failures
  - [x] Log detailed error information

**Manual Testing Instructions for Phase 3:**

1. **Setup:**
   - Load extension in Chrome developer mode
   - Log in to Bandcamp with an account that has purchases
   - Open the extension popup

2. **Test Purchase Discovery:**
   - Click "Start Download" button
   - Verify extension navigates to `https://bandcamp.com/{username}/purchases`
   - Check console for "Found X purchases" message
   - Verify popup shows list of first 3 purchases

3. **Test Parallel Downloads:**
   - After discovery completes, watch for multiple tabs opening (up to 3)
   - Each tab should navigate to a download page
   - Verify tabs auto-close after download starts
   - Check progress bar shows "X of Y albums (Z active)"

4. **Test Download Page Handling:**
   - Watch for "Preparing download..." pages
   - Verify extension auto-clicks download button when ready
   - Check that actual file downloads start in Chrome

5. **Test Completion:**
   - Wait for all downloads to complete
   - Verify final message shows completed and failed counts
   - Check Chrome's download folder for .zip files

**Expected Results:**
- ✅ Purchases discovered successfully
- ✅ Multiple downloads run in parallel (max 3 tabs)
- ✅ "Preparing" state handled automatically
- ✅ Progress updates shown in real-time
- ✅ Files downloaded to Chrome's default download folder
- [ ] Test download link validation functions

**Acceptance Test:**
- [ ] **AC3.6.1**: Handles pagination to load all purchases
- [ ] **AC3.6.2**: Works with collections of 100+ albums
- [ ] **AC3.7.1**: Successfully extracts all albums from purchases page
- [ ] **AC3.7.2**: Correctly identifies album metadata (title, artist, date)
- [ ] **AC3.7.3**: Finds valid download links for all purchased albums
- [ ] **AC3.7.4**: Handles edge cases (special characters, missing data)
- [ ] **AC3.7.5**: Works with different Bandcamp page layouts
- [ ] **AC3.7.6**: Scraping completes within reasonable time limits

### Phase 4: Download Manager Implementation (Week 4) - REFACTORED

**Duration**: 5 days
**Dependencies**: Phase 3 complete (purchase discovery working)
**Deliverables**: Complete download management system with progress tracking

#### Completed Tasks ✅

**Task 4.1: Core Download Engine (COMPLETED)**
- [x] Create `lib/download-manager.js` foundation
- [x] Implement single download functionality:
  - [x] Open download page in inactive tab
  - [x] Monitor tab for download link readiness
  - [x] Extract download link when ready
  - [x] Initiate download using Chrome Downloads API
  - [x] Close tab after initiating download
- [x] Integrate Chrome Downloads API:
  - [x] Use `chrome.downloads.download()` for file downloads
  - [x] Handle download initiation
  - [x] Monitor download progress events
  - [x] Detect download completion/failure
- [x] Security & stability fixes:
  - [x] Add URL validation (bcbits.com only)
  - [x] Fix memory leak in downloadProgress
  - [x] Fix race condition in tab creation

#### Remaining Tasks

**Task 4.2: Redesign Queue Management System (Days 1-2)**
- [ ] Design new queue architecture from scratch
- [ ] Create improved queue data structure
- [ ] Implement queue operations:
  - [ ] Add items to queue
  - [ ] Remove items from queue
  - [ ] Reorder/prioritize items
  - [ ] Clear queue
- [ ] Build sequential processing with better state management
- [ ] Add batch operations support
- [ ] Create queue persistence mechanism
- [ ] Integrate queue with service worker

**Task 4.3: Create DownloadJob Class (Day 2)**
- [ ] Design DownloadJob class for encapsulation
- [ ] Track download state and metadata:
  - [ ] Download status (pending, downloading, completed, failed)
  - [ ] Progress information (bytes, percentage)
  - [ ] Error information
  - [ ] Retry count
- [ ] Implement state transitions
- [ ] Add progress tracking per job
- [ ] Store error information and retry attempts
- [ ] Create job serialization for persistence

**Task 4.4: Implement Retry Logic (Day 3)**
- [ ] Add retry mechanism with exponential backoff
- [ ] Configure max retry attempts (default: 3)
- [ ] Track retry count per download
- [ ] Implement backoff calculation (2^n seconds)
- [ ] Handle permanent vs transient failures
- [ ] Add retry queue management
- [ ] Create retry status reporting

**Task 4.5: Error Classification & Handling (Day 3)**
- [ ] Classify error types:
  - [ ] Network errors (timeout, connection lost)
  - [ ] Permission errors (file access denied)
  - [ ] Disk errors (no space, write failed)
  - [ ] Authentication errors (session expired)
  - [ ] Server errors (404, 500, etc)
- [ ] Create error handling strategies per type
- [ ] Add user-friendly error messages
- [ ] Implement error recovery mechanisms
- [ ] Log errors for debugging

**Task 4.6: Pause/Resume Functionality (Day 4)**
- [ ] Implement pause for individual downloads
- [ ] Add queue-wide pause/resume
- [ ] Persist pause state in session storage
- [ ] Handle resume after browser restart
- [ ] Maintain download position on resume
- [ ] Create pause/resume UI controls
- [ ] Test pause/resume with large files

**Task 4.7: File Organization System (Day 4)**
- [ ] Implement folder structure creation:
  - [ ] Create `Downloads/Bandcamp/Artist/Album/` structure
  - [ ] Handle nested folder creation in Downloads folder
  - [ ] Ensure cross-platform path compatibility
- [ ] Add filename sanitization:
  - [ ] Remove/replace invalid filesystem characters
  - [ ] Handle Unicode characters properly
  - [ ] Maintain filename readability
  - [ ] Log sanitization decisions
- [ ] Implement duplicate handling:
  - [ ] Detect duplicate filenames
  - [ ] Append numbers for conflicts (e.g., "Album (2).zip")
  - [ ] Log duplicate resolution decisions
  - [ ] Maintain original filename intent
- [ ] Create organized download paths:
  - [ ] Generate proper paths for each download
  - [ ] Pass filename to Chrome Downloads API
  - [ ] Handle path length limits

**Task 4.8: Album ZIP File Handling (Day 4)**
- [ ] Research ZIP file handling options:
  - [ ] Investigate if Chrome can auto-extract ZIPs
  - [ ] Evaluate JSZip library for in-browser extraction
  - [ ] Consider leaving as ZIP vs extracting
  - [ ] Assess memory constraints for large albums
- [ ] Design ZIP handling strategy:
  - [ ] Determine if extraction is needed/wanted
  - [ ] Plan extraction workflow if applicable
  - [ ] Consider user preferences for ZIP vs extracted
- [ ] Implement chosen approach:
  - [ ] If keeping ZIP: organize ZIP files properly
  - [ ] If extracting: implement extraction logic
  - [ ] Handle extraction errors gracefully
- [ ] Test ZIP handling:
  - [ ] Test with various album sizes
  - [ ] Test memory usage during extraction
  - [ ] Verify file integrity after processing

**Task 4.9: Integration & Testing (Day 5)**
- [ ] Integrate all components:
  - [ ] Connect queue with DownloadJob class
  - [ ] Wire up retry logic with queue
  - [ ] Integrate error handling throughout
  - [ ] Connect pause/resume to UI
- [ ] Test queue management:
  - [ ] Test queue operations (add, remove, reorder)
  - [ ] Test sequential processing
  - [ ] Test batch operations
  - [ ] Test queue persistence
- [ ] Test DownloadJob functionality:
  - [ ] Test state transitions
  - [ ] Test progress tracking
  - [ ] Test job serialization
- [ ] Test retry logic scenarios:
  - [ ] Test exponential backoff timing
  - [ ] Test max retry limits
  - [ ] Test permanent vs transient failures
- [ ] Test error handling paths:
  - [ ] Test each error type classification
  - [ ] Test error recovery mechanisms
  - [ ] Test user error messages
- [ ] Test pause/resume functionality:
  - [ ] Test individual download pause/resume
  - [ ] Test queue-wide pause/resume
  - [ ] Test resume after browser restart
- [ ] Performance testing:
  - [ ] Large download queues (50+ items)
  - [ ] Long-running download sessions
  - [ ] Memory usage monitoring

**Unit Tests:**
- [x] Test single download functionality
- [ ] Test new queue data structure operations
- [ ] Test DownloadJob class methods
- [ ] Test retry logic with exponential backoff
- [ ] Test error classification and handling
- [ ] Test pause/resume state management

**Acceptance Tests:**
- [x] **AC4.1.1**: Single download completes successfully
- [x] **AC4.1.2**: Download progress tracked accurately
- [x] **AC4.1.3**: Tab closed after download initiated
- [x] **AC4.1.4**: URL validation prevents non-bcbits downloads
- [ ] **AC4.2.1**: Queue processes downloads sequentially
- [ ] **AC4.3.1**: DownloadJob tracks state correctly
- [ ] **AC4.4.1**: Failed downloads retry with backoff
- [ ] **AC4.5.1**: Errors classified and handled appropriately
- [ ] **AC4.6.1**: Downloads can be paused and resumed
- [ ] **AC4.7.1**: Files organized in Downloads/Bandcamp/Artist/Album structure
- [ ] **AC4.7.2**: Filenames sanitized for filesystem compatibility
- [ ] **AC4.8.1**: ZIP files handled according to chosen strategy
- [ ] **AC4.8.2**: Memory usage acceptable for ZIP processing
- [ ] **AC4.9.1**: Large queues (50+ items) process reliably
- [ ] **AC4.9.2**: Memory usage remains stable during long sessions

### Phase 5: Metadata & File Organization (Week 5)

**Duration**: 5 days  
**Dependencies**: Phase 4 complete (download manager working)  
**Deliverables**: Complete metadata handling and file organization system

#### Task 5.1: Metadata Embedding Research & Setup (Day 1)
- [ ] Research browser-compatible ID3 tagging libraries:
  - [ ] Evaluate jsmediatags, node-id3, or similar libraries
  - [ ] Test library compatibility with Chrome extensions
  - [ ] Assess performance and file size impact
- [ ] Create `lib/metadata-handler.js` foundation
- [ ] Implement metadata extraction from Bandcamp's MP3s:
  - [ ] Read existing ID3 tags from downloaded files
  - [ ] Validate pre-existing metadata quality
  - [ ] Identify missing metadata fields
- [ ] Set up metadata processing pipeline:
  - [ ] Create metadata validation functions
  - [ ] Design metadata enhancement workflow
  - [ ] Plan metadata embedding process

#### Task 5.2: Metadata Embedding Implementation (Day 1-2)
- [ ] Implement core metadata embedding:
  - [ ] Artist name embedding
  - [ ] Album title embedding
  - [ ] Track number embedding
  - [ ] Track title embedding
  - [ ] Release date embedding
- [ ] Add extended metadata support:
  - [ ] Genre information (if available)
  - [ ] Album artist vs track artist
  - [ ] Disc number for multi-disc albums
  - [ ] Comment field with download source info
- [ ] Create metadata validation and correction:
  - [ ] Fix encoding issues
  - [ ] Standardize metadata format
  - [ ] Handle missing or corrupted tags

#### Task 5.3: Album Artwork Processing (Day 2-3)
- [ ] Implement artwork download system:
  - [ ] Download highest resolution artwork from Bandcamp
  - [ ] Handle different artwork formats (JPEG, PNG)
  - [ ] Manage artwork file sizes and quality
- [ ] Create artwork embedding functionality:
  - [ ] Embed artwork into MP3 ID3 tags
  - [ ] Handle artwork size limits for ID3 tags
  - [ ] Optimize artwork for embedding
- [ ] Add artwork caching system:
  - [ ] Cache downloaded artwork to avoid re-downloading
  - [ ] Manage cache storage and cleanup
  - [ ] Handle artwork updates and versions

#### Task 5.4: File Processing Integration (Day 3-4)
- [ ] Integrate metadata processing with download manager:
  - [ ] Process files immediately after download
  - [ ] Handle processing failures gracefully
  - [ ] Maintain download progress accuracy
- [ ] Create file validation system:
  - [ ] Verify file integrity after processing
  - [ ] Validate metadata embedding success
  - [ ] Check final file organization
- [ ] Add processing progress tracking:
  - [ ] Track metadata embedding progress
  - [ ] Report file organization progress
  - [ ] Update UI with processing status

#### Task 5.5: Metadata Testing (Day 5)
- [ ] Test metadata embedding:
  - [ ] Verify all metadata fields are embedded correctly
  - [ ] Test with various MP3 file types
  - [ ] Validate metadata player compatibility
- [ ] Test artwork processing:
  - [ ] Verify artwork embedding in various players
  - [ ] Test different artwork sizes and formats
  - [ ] Validate artwork caching functionality
- [ ] Integration testing:
  - [ ] Test full download-to-organization pipeline
  - [ ] Verify processing doesn't break downloads
  - [ ] Test with large batches of files

**Unit Tests:**
- [ ] Test ID3 tag writing and reading functions
- [ ] Test artwork processing and embedding
- [ ] Test metadata validation and correction

**Acceptance Test:**
- [ ] **AC5.5.1**: All metadata fields appear correctly in music players
- [ ] **AC5.6.3**: Artwork displays properly in all tested players
- [ ] **AC5.6.4**: Special characters in filenames are handled safely
- [ ] **AC5.6.5**: Duplicate files are renamed appropriately
- [ ] **AC5.6.6**: Processing completes without corrupting files

### Phase 6: User Interface Development (Week 6)

**Duration**: 5 days  
**Dependencies**: Phase 5 complete (metadata & organization working)  
**Deliverables**: Complete user interface with progress tracking and controls

#### Task 6.1: Progress Dashboard Design & Implementation (Day 1-2)
- [ ] Design progress dashboard layout:
  - [ ] Overall progress bar (X of Y albums completed)
  - [ ] Current item display (album/track being downloaded)
  - [ ] Download speed and time estimates
  - [ ] Completed vs remaining items counters
- [ ] Implement real-time progress updates:
  - [ ] Connect to download manager progress events
  - [ ] Update progress bars smoothly
  - [ ] Show current file being processed
  - [ ] Display processing status (downloading, processing metadata, organizing)
- [ ] Add detailed progress information:
  - [ ] Show current album artwork thumbnail
  - [ ] Display current track information
  - [ ] Show download queue position
  - [ ] Add estimated time remaining

#### Task 6.2: Control Interface Development (Day 2-3)
- [ ] Create download control buttons:
  - [ ] Start download button
  - [ ] Pause/resume download button
  - [ ] Stop download button
  - [ ] Clear queue button
- [ ] Implement settings configuration:
  - [ ] Custom download location selector
  - [ ] Download throttling options
  - [ ] Retry attempt configuration
  - [ ] Metadata embedding preferences
- [ ] Add advanced controls:
  - [ ] Skip current download option
  - [ ] Restart failed downloads
  - [ ] Priority adjustment for queue items
- [ ] Create settings persistence:
  - [ ] Save user preferences
  - [ ] Load settings on extension start
  - [ ] Validate setting values

#### Task 6.3: Status Reporting & Logging (Day 3)
- [ ] Implement download status indicators:
  - [ ] Authentication status display
  - [ ] Download queue status
  - [ ] Current operation status
  - [ ] Error/warning indicators
- [ ] Create error reporting system:
  - [ ] Display download errors clearly
  - [ ] Show retry attempts and outcomes
  - [ ] Provide error resolution suggestions
- [ ] Add download decision logging:
  - [ ] Log filename conflicts and resolutions
  - [ ] Track sanitization actions
  - [ ] Record processing decisions
  - [ ] Show log in expandable section

#### Task 6.4: Completion & Notification System (Day 3-4)
- [ ] Implement completion notifications:
  - [ ] Browser notifications for download completion
  - [ ] Success/failure summary display
  - [ ] Final statistics presentation
- [ ] Create download summary:
  - [ ] Total files downloaded
  - [ ] Total size downloaded
  - [ ] Time taken for complete process
  - [ ] Success/failure breakdown
- [ ] Add post-completion actions:
  - [ ] Open download folder option
  - [ ] Clear completed downloads
  - [ ] Export download log
  - [ ] Start new download session

#### Task 6.5: UI Polish & Responsiveness (Day 4)
- [ ] Improve UI styling and layout:
  - [ ] Consistent visual design
  - [ ] Responsive layout for different popup sizes
  - [ ] Loading states and animations
  - [ ] Error state styling
- [ ] Add user experience improvements:
  - [ ] Tooltips for controls and status
  - [ ] Keyboard shortcuts for common actions
  - [ ] Accessibility improvements
  - [ ] Help text and guidance
- [ ] Optimize UI performance:
  - [ ] Efficient DOM updates
  - [ ] Smooth animations
  - [ ] Minimal UI blocking during operations

#### Task 6.6: UI Testing & User Experience (Day 5)
- [ ] Test UI with various scenarios:
  - [ ] Large download queues
  - [ ] Error conditions
  - [ ] Network interruptions
  - [ ] Long-running downloads
- [ ] Validate UI responsiveness:
  - [ ] Test with different screen sizes
  - [ ] Verify popup behavior
  - [ ] Check animation smoothness
- [ ] User experience testing:
  - [ ] Test complete user workflow
  - [ ] Verify intuitive operation
  - [ ] Check error message clarity
  - [ ] Validate help and guidance

**Unit Tests:**
- [ ] Test UI component rendering and state management
- [ ] Test progress bar calculations and updates
- [ ] Test button click handlers and form validation
- [ ] Test responsive layout breakpoints
- [ ] Test accessibility features (ARIA labels, keyboard nav)

**Acceptance Test:**
- [ ] **AC6.6.1**: UI remains responsive during large downloads
- [ ] **AC6.6.2**: Progress indicators accurately reflect current status
- [ ] **AC6.6.3**: Error messages are clear and actionable
- [ ] **AC6.6.4**: All controls work as expected by users
- [ ] **AC6.6.5**: UI is accessible to users with disabilities
- [ ] **AC6.6.6**: Complete workflow can be performed intuitively

### Phase 7: Testing & Polish (Week 7)

**Duration**: 5 days  
**Dependencies**: Phase 6 complete (UI fully implemented)  
**Deliverables**: Production-ready extension with comprehensive testing

#### Task 7.1: Comprehensive Functionality Testing (Day 1-2)
- [ ] Test with various Bandcamp account types:
  - [ ] Accounts with 1-10 purchases
  - [ ] Accounts with 50+ purchases
  - [ ] Accounts with 100+ purchases
  - [ ] Different purchase types (singles, EPs, albums)
- [ ] Test different library configurations:
  - [ ] Various music genres and artists
  - [ ] Different album artwork sizes/formats
  - [ ] Albums with special characters in names
  - [ ] Multi-disc albums and compilations
- [ ] Verify metadata embedding accuracy:
  - [ ] Test metadata in different music players
  - [ ] Verify artwork displays correctly
  - [ ] Check filename organization accuracy
  - [ ] Validate special character handling
- [ ] Test resume and recovery functionality:
  - [ ] Interrupt downloads mid-process
  - [ ] Test session expiry recovery
  - [ ] Verify partial download cleanup
  - [ ] Test browser restart scenarios

#### Task 7.2: Error Scenario & Edge Case Testing (Day 2-3)
- [ ] Network interruption handling:
  - [ ] Test with slow/unstable internet
  - [ ] Simulate network disconnections
  - [ ] Test with bandwidth limitations
  - [ ] Verify timeout handling
- [ ] Session expiry scenarios:
  - [ ] Test authentication timeout during downloads
  - [ ] Verify re-authentication prompts
  - [ ] Test login failure recovery
  - [ ] Validate session refresh handling
- [ ] Bandcamp site changes simulation:
  - [ ] Test with modified DOM selectors
  - [ ] Simulate missing elements
  - [ ] Test with different page layouts
  - [ ] Verify fallback selector functionality
- [ ] Performance testing:
  - [ ] Large library processing (200+ albums)
  - [ ] Memory usage monitoring
  - [ ] CPU usage during operations
  - [ ] Long-running session stability

#### Task 7.3: User Experience Testing & Polish (Day 3-4)
- [ ] UI/UX refinements:
  - [ ] Polish visual design elements
  - [ ] Improve layout consistency
  - [ ] Enhance loading state indicators
  - [ ] Refine error message presentation
- [ ] Performance optimizations:
  - [ ] Optimize DOM parsing efficiency
  - [ ] Improve memory management
  - [ ] Enhance download queue processing
  - [ ] Optimize UI update frequency
- [ ] Error message improvements:
  - [ ] Make error messages more user-friendly
  - [ ] Add actionable error resolution steps
  - [ ] Improve error categorization
  - [ ] Add context-sensitive help
- [ ] Accessibility improvements:
  - [ ] Add ARIA labels for screen readers
  - [ ] Ensure keyboard navigation works
  - [ ] Test with accessibility tools
  - [ ] Improve color contrast

#### Task 7.4: Documentation & User Guide Creation (Day 4)
- [ ] Create user documentation:
  - [ ] Installation instructions
  - [ ] Getting started guide
  - [ ] Feature overview and usage
  - [ ] Troubleshooting guide
- [ ] Create developer documentation:
  - [ ] Code architecture overview
  - [ ] API documentation
  - [ ] Extension structure explanation
  - [ ] Maintenance and update procedures
- [ ] Add inline help:
  - [ ] Tooltip explanations
  - [ ] Context-sensitive help text
  - [ ] Error resolution guidance
  - [ ] Feature explanation popups

#### Task 7.5: Final Integration & Release Preparation (Day 5)
- [ ] Complete end-to-end testing:
  - [ ] Full workflow testing from login to completion
  - [ ] Test with real user scenarios
  - [ ] Verify all features work together
  - [ ] Final performance validation
- [ ] Prepare for release:
  - [ ] Clean up debug code and console logs
  - [ ] Optimize file sizes and assets
  - [ ] Validate manifest.json configuration
  - [ ] Create release package
- [ ] Final quality assurance:
  - [ ] Code review and cleanup
  - [ ] Security review
  - [ ] Privacy compliance check
  - [ ] Final testing checklist completion
- [ ] Create release documentation:
  - [ ] Release notes
  - [ ] Known issues list
  - [ ] Installation guide
  - [ ] Support information

**Unit Tests:**
- [ ] Run complete unit test suite with 85%+ coverage
- [ ] Validate all critical path tests pass
- [ ] Test build and packaging scripts
- [ ] Test installation and uninstallation procedures

**Acceptance Test:**
- [ ] **AC7.5.1**: Complete workflow works end-to-end without issues
- [ ] **AC7.5.2**: Extension installs and uninstalls cleanly
- [ ] **AC7.5.3**: All features work as documented in user guide
- [ ] **AC7.5.4**: Performance meets or exceeds requirements
- [ ] **AC7.5.5**: Security review passes with no critical issues
- [ ] **AC7.5.6**: Extension is ready for production use

## Technical Implementation Details

### Chrome Extension APIs Usage

#### Downloads API
```javascript
chrome.downloads.download({
  url: downloadUrl,
  filename: `${artist}/${album}/${trackNumber} - ${title}.mp3`,
  conflictAction: 'overwrite'
});
```

#### Cookies API
```javascript
chrome.cookies.getAll({
  domain: '.bandcamp.com'
}, (cookies) => {
  // Validate session cookies
});
```

### DOM Scraping Strategy
- Use robust CSS selectors for element targeting
- Implement fallback selectors for site changes
- Add retry logic for dynamic content loading
- Use MutationObserver for DOM change detection

### Data Flow Architecture
1. **Authentication Check** → Session validation
2. **Purchase Discovery** → Scrape purchases page
3. **Album Processing** → Extract individual album data
4. **Download Queue** → Sequential download management
5. **File Processing** → Metadata embedding and organization
6. **Progress Reporting** → UI updates and completion tracking

## Risk Mitigation Strategies

### DOM Structure Changes
- Implement multiple selector fallbacks
- Use semantic HTML attributes where possible
- Add comprehensive error logging
- Design modular scraping components for easy updates

### Performance Considerations
- Implement download throttling with reasonable delays between downloads
- Use efficient DOM parsing techniques
- Minimize memory usage during large downloads
- Keep progress state in memory only (no cross-session persistence)

### Legal and Ethical Considerations
- Clearly document personal archival use only
- Respect Bandcamp's terms of service
- Implement reasonable rate limiting
- Add user warnings about appropriate use

## Development Timeline & Task Summary

| Phase | Status | Key Deliverables | Notes |
|-------|--------|------------------|-------|
| 1 | ✅ COMPLETED | Extension foundation, manifest, service worker | All 7 tasks complete |
| 2 | ✅ SIMPLIFIED | Basic authentication with tab-based login | Core auth working, advanced features deferred |
| 3 | ✅ COMPLETED | Purchase discovery & core download | DISCOVER_AND_START + parallel tab spawning |
| 4 | ⏳ MODIFIED | Basic download implementation | Will implement core features only |
| 5 | ⏳ DEFERRED | Metadata and file organization | After core functionality proven |
| 6 | ⏳ DEFERRED | Full UI development | After core functionality proven |
| 7 | ⏳ ONGOING | Testing and polish | Continuous as we build |

**Revised Strategy**: Build core functionality first (login → discover → download), then enhance
**Current Focus**: Phase 3 - Get purchase discovery and basic download working
**Progress**: Phase 1 complete, Phase 2 simplified & working, Phase 3 in progress

### Task Dependencies
- **Phase 1**: No dependencies (foundation)
- **Phase 2**: Requires Phase 1 (extension shell)
- **Phase 3**: Requires Phase 2 (authentication working)
- **Phase 4**: Requires Phase 3 (purchase discovery working)
- **Phase 5**: Requires Phase 4 (download manager working)
- **Phase 6**: Requires Phase 5 (metadata & organization working)
- **Phase 7**: Requires Phase 6 (UI fully implemented)

## Dependencies and Requirements

### Development Dependencies
- Chrome Extension development environment
- Web scraping testing tools
- ID3 tagging library (browser-compatible)
- CSS framework for UI (optional)

### External Dependencies
- Chrome browser (Manifest V3 support)
- Active Bandcamp account with purchases
- Stable internet connection for downloads

### Technical Requirements
- Modern JavaScript (ES6+)
- Chrome Extension APIs knowledge
- DOM manipulation expertise
- File system handling understanding

## Success Metrics

### Functional Success
- Successfully authenticate with Bandcamp
- Discover and list all paid purchases
- Download MP3 files with correct metadata
- Organize files in specified folder structure
- Handle interruptions and resume downloads

### Performance Success
- Handle libraries with 100+ albums
- Maintain stable download speeds
- Minimal memory usage during operation
- Responsive UI during downloads

### User Experience Success
- Intuitive setup and operation
- Clear progress indication
- Helpful error messages
- Reliable operation across sessions

## Future Considerations (Post-v1)

### Potential Enhancements
- Multiple format support (FLAC, WAV)
- Parallel download capabilities
- Credential storage with encryption
- Sync mode for new purchases
- Liner notes extraction
- Advanced metadata customization

### Scalability Improvements
- Database for download history
- Advanced error recovery
- Bandwidth management
- Cloud storage integration

---

## Implementation Decisions (Based on User Feedback)

1. **Download Location**: ✅ Custom folder selection - Users can specify their preferred download directory
2. **File Naming Conflicts**: ✅ Make reasonable assumptions (append numbers for duplicates, sanitize special characters) and log decisions in download log
3. **Error Recovery**: ✅ Stop downloads on session expiry and offer user option to resume with new login
4. **Progress Persistence**: ✅ Do the simplest thing - No persistence across browser sessions (session-based only)
5. **Rate Limiting**: ✅ Implement reasonable delays between downloads to respect Bandcamp's servers
6. **Artwork Resolution**: ✅ Use highest resolution artwork available from Bandcamp
7. **Browser Compatibility**: ✅ Chrome-only target (Manifest V3)
8. **Testing Approach**: ✅ Include mock data capabilities for testing without requiring specific test accounts

## ✅ All Requirements Clarified

The implementation plan is now complete with all decisions finalized. Ready to proceed with development following the 7-week roadmap.
