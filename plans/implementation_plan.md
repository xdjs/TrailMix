# Bandcamp Downloader - Implementation Plan

## Overview
This document outlines the detailed implementation plan for the Bandcamp Downloader Chrome extension based on the PRD requirements. The extension will enable users to bulk-download their paid Bandcamp purchases in MP3 format with embedded metadata and artwork.

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

### Phase 1: Project Setup & Chrome Extension Foundation (Week 1)

**Duration**: 5 days  
**Dependencies**: None  
**Deliverables**: Working Chrome extension shell with basic structure

#### Task 1.1: Initialize Project Structure (Day 1)
- [ ] Create root project directory: `bandcamp-downloader/`
- [ ] Set up folder structure:
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
- [ ] Initialize Git repository
- [ ] Create basic README.md with setup instructions

**Unit Tests:**
- [ ] Test project structure validation script
- [ ] Test file path utilities
- [ ] Test Git initialization verification

**Acceptance Test:**
- [ ] **AC1.1**: All required directories are created
- [ ] **AC1.2**: Git repository is properly initialized
- [ ] **AC1.3**: README.md contains setup instructions
- [ ] **AC1.4**: Project structure matches specification

#### Task 1.2: Create Manifest V3 Configuration (Day 1)
- [ ] Create `manifest.json` with basic extension metadata
- [ ] Define required permissions:
  - [ ] `downloads` - for managing file downloads
  - [ ] `cookies` - for session management
  - [ ] `activeTab` - for current tab access
  - [ ] `storage` - for extension settings
  - [ ] `scripting` - for content script injection
- [ ] Add host permissions for `*.bandcamp.com`
- [ ] Configure content security policy
- [ ] Set up extension icons (16x16, 32x32, 48x48, 128x128)

**Unit Tests:**
- [ ] Test manifest.json schema validation
- [ ] Test permission configuration parsing
- [ ] Test CSP policy validation
- [ ] Test icon file existence and dimensions

**Acceptance Test:**
- [ ] **AC1.2.1**: Manifest V3 format is valid and loads in Chrome
- [ ] **AC1.2.2**: All required permissions are declared
- [ ] **AC1.2.3**: Host permissions include *.bandcamp.com
- [ ] **AC1.2.4**: Extension icons display correctly in all sizes
- [ ] **AC1.2.5**: CSP allows required functionality

#### Task 1.3: Implement Service Worker Foundation (Day 2)
- [ ] Create `background/service-worker.js`
- [ ] Implement extension lifecycle management:
  - [ ] `chrome.runtime.onInstalled` handler
  - [ ] `chrome.runtime.onStartup` handler
- [ ] Set up message passing system between components
- [ ] Add basic error handling and logging
- [ ] Test service worker activation

**Unit Tests:**
- [ ] Test service worker lifecycle event handlers
- [ ] Test message passing system functionality
- [ ] Test error handling and logging functions
- [ ] Test service worker registration and activation
- [ ] Mock Chrome runtime API calls

**Acceptance Test:**
- [ ] **AC1.3.1**: Service worker activates on extension install
- [ ] **AC1.3.2**: Lifecycle events trigger appropriate handlers
- [ ] **AC1.3.3**: Message passing works between service worker and other components
- [ ] **AC1.3.4**: Errors are logged with appropriate detail
- [ ] **AC1.3.5**: Service worker persists across browser sessions

#### Task 1.4: Create Popup UI Shell (Day 2-3)
- [ ] Design popup layout in `popup/popup.html`:
  - [ ] Header with extension title
  - [ ] Authentication status section
  - [ ] Progress dashboard area
  - [ ] Control buttons section
  - [ ] Settings/options area
- [ ] Create basic CSS styling in `popup/popup.css`
- [ ] Implement popup JavaScript controller in `popup/popup.js`
- [ ] Add popup-to-background communication

**Unit Tests:**
- [ ] Test popup HTML structure validation
- [ ] Test CSS styling and responsive layout
- [ ] Test popup JavaScript initialization
- [ ] Test popup-to-background message handling
- [ ] Test UI component rendering

**Acceptance Test:**
- [ ] **AC1.4.1**: Popup opens with correct dimensions and layout
- [ ] **AC1.4.2**: All UI sections are properly styled and positioned
- [ ] **AC1.4.3**: Popup communicates successfully with background script
- [ ] **AC1.4.4**: UI elements are accessible and keyboard navigable
- [ ] **AC1.4.5**: Popup closes and reopens without state issues

#### Task 1.5: Set Up Content Script Infrastructure (Day 3)
- [ ] Create `content/bandcamp-scraper.js`
- [ ] Implement content script injection system
- [ ] Add DOM ready detection
- [ ] Set up content-to-background messaging
- [ ] Create utility functions for DOM manipulation

**Unit Tests:**
- [ ] Test content script injection mechanism
- [ ] Test DOM ready detection functions
- [ ] Test content-to-background messaging
- [ ] Test DOM manipulation utilities
- [ ] Mock Bandcamp page structures for testing

**Acceptance Test:**
- [ ] **AC1.5.1**: Content script injects successfully on Bandcamp pages
- [ ] **AC1.5.2**: DOM ready detection works reliably
- [ ] **AC1.5.3**: Content script can communicate with background script
- [ ] **AC1.5.4**: DOM utilities function correctly on real Bandcamp pages
- [ ] **AC1.5.5**: Content script doesn't interfere with page functionality

#### Task 1.6: Create Core Library Modules (Day 4)
- [ ] Create `lib/utils.js` with common utilities:
  - [ ] Logging functions
  - [ ] Error handling helpers
  - [ ] String sanitization functions
  - [ ] File path utilities
- [ ] Create empty module files:
  - [ ] `lib/auth-manager.js`
  - [ ] `lib/download-manager.js`
  - [ ] `lib/metadata-handler.js`
- [ ] Add module export/import structure

**Unit Tests:**
- [ ] Test logging functions with various log levels
- [ ] Test error handling helper functions
- [ ] Test string sanitization with edge cases
- [ ] Test file path utilities across platforms
- [ ] Test module import/export functionality

**Acceptance Test:**
- [ ] **AC1.6.1**: Utils module functions work correctly in isolation
- [ ] **AC1.6.2**: Error handling provides meaningful error information
- [ ] **AC1.6.3**: String sanitization handles special characters safely
- [ ] **AC1.6.4**: File path utilities work on Windows, Mac, and Linux
- [ ] **AC1.6.5**: Module structure supports future development needs

#### Task 1.7: Extension Testing & Validation (Day 5)
- [ ] Load extension in Chrome developer mode
- [ ] Test popup opens correctly
- [ ] Verify service worker loads without errors
- [ ] Test content script injection on bandcamp.com
- [ ] Validate all permissions are working
- [ ] Create basic smoke test checklist

**Unit Tests:**
- [ ] Test manifest.json validation
- [ ] Test service worker lifecycle functions
- [ ] Test popup DOM structure and basic functionality
- [ ] Test content script injection and messaging
- [ ] Test utility functions (logging, error handling, sanitization)

**Acceptance Test:**
- [ ] **AC1.1**: Extension loads successfully in Chrome developer mode
- [ ] **AC1.2**: Popup opens when extension icon is clicked
- [ ] **AC1.3**: Service worker starts without console errors
- [ ] **AC1.4**: Content script injects on bandcamp.com pages
- [ ] **AC1.5**: All required permissions are granted and functional
- [ ] **AC1.6**: Extension icon displays correctly in browser toolbar

### Phase 2: Authentication & Session Management (Week 2)

**Duration**: 5 days  
**Dependencies**: Phase 1 complete  
**Deliverables**: Working authentication system with session management

#### Task 2.1: Implement Session Detection (Day 1)
- [ ] Create `lib/auth-manager.js` core functionality
- [ ] Implement cookie-based session validation:
  - [ ] Read Bandcamp session cookies using Chrome cookies API
  - [ ] Validate session by checking authentication endpoints
  - [ ] Detect logged-in vs logged-out state
- [ ] Create session status checking functions
- [ ] Add session state caching to avoid repeated checks
- [ ] Test session detection with logged-in/out states

#### Task 2.2: Build Login Flow UI (Day 2)
- [ ] Design login prompt interface in popup:
  - [ ] Username/email input field
  - [ ] Password input field
  - [ ] Login button
  - [ ] Status messages area
- [ ] Add login form styling
- [ ] Implement form validation (required fields, format checking)
- [ ] Create login state management in popup
- [ ] Add loading indicators during login process

#### Task 2.3: Implement Login Process (Day 2-3)
- [ ] Create login automation in content script:
  - [ ] Navigate to Bandcamp login page
  - [ ] Fill login form programmatically
  - [ ] Submit login credentials
  - [ ] Detect successful/failed login
- [ ] Handle login response processing
- [ ] Implement login error handling:
  - [ ] Invalid credentials
  - [ ] Network errors
  - [ ] Captcha challenges
- [ ] Add login success confirmation

#### Task 2.4: Session Monitoring System (Day 3-4)
- [ ] Implement session expiry detection:
  - [ ] Monitor authentication status during operations
  - [ ] Detect when session becomes invalid
  - [ ] Trigger re-authentication prompts
- [ ] Create session refresh mechanisms
- [ ] Add session timeout handling
- [ ] Implement graceful session expiry recovery

#### Task 2.5: Authentication State Management (Day 4)
- [ ] Create authentication state store:
  - [ ] Track current login status
  - [ ] Store session validation results
  - [ ] Manage authentication events
- [ ] Implement auth state synchronization between components
- [ ] Add authentication event broadcasting
- [ ] Create auth state persistence (session-based only)

#### Task 2.6: Authentication Testing (Day 5)
- [ ] Test login flow with valid credentials
- [ ] Test login flow with invalid credentials
- [ ] Test session expiry scenarios
- [ ] Test authentication across browser restarts
- [ ] Validate no credential storage (per PRD requirement)
- [ ] Create authentication test scenarios

**Unit Tests:**
- [ ] Test session cookie parsing and validation
- [ ] Test authentication state management
- [ ] Test login form automation functions
- [ ] Test session expiry detection logic
- [ ] Test authentication event broadcasting

**Acceptance Test:**
- [ ] **AC2.6.1**: Valid credentials successfully authenticate user
- [ ] **AC2.6.2**: Invalid credentials show appropriate error messages
- [ ] **AC2.6.3**: Session expiry is detected and handled gracefully
- [ ] **AC2.6.4**: No credentials are stored locally after logout
- [ ] **AC2.6.5**: Authentication state persists during browser session
- [ ] **AC2.6.6**: Re-authentication prompts appear when session expires

### Phase 3: Purchase Discovery & Scraping (Week 3)

**Duration**: 5 days  
**Dependencies**: Phase 2 complete (authentication working)  
**Deliverables**: Complete purchase discovery and metadata extraction system

#### Task 3.1: Purchases Page Navigation (Day 1)
- [ ] Implement purchases page navigation:
  - [ ] Detect current page and navigate to purchases if needed
  - [ ] Handle Bandcamp URL structure for purchases page
  - [ ] Add robust page loading detection
- [ ] Create pagination handling:
  - [ ] Detect if pagination exists
  - [ ] Implement page-by-page navigation
  - [ ] Handle "Load More" buttons if present
- [ ] Add DOM waiting and loading detection:
  - [ ] Wait for dynamic content to load
  - [ ] Detect when purchase list is fully loaded
  - [ ] Handle slow network conditions

#### Task 3.2: Album Discovery & Parsing (Day 1-2)
- [ ] Analyze Bandcamp purchases page DOM structure
- [ ] Create robust CSS selectors for album elements
- [ ] Implement album information extraction:
  - [ ] Album title extraction
  - [ ] Artist name extraction
  - [ ] Purchase date extraction
  - [ ] Album URL extraction
  - [ ] Thumbnail artwork URL extraction
- [ ] Add fallback selectors for DOM structure changes
- [ ] Create album data structure/schema
- [ ] Test with different purchase page layouts

#### Task 3.3: Individual Album Page Processing (Day 2-3)
- [ ] Implement album page navigation:
  - [ ] Navigate to individual album pages
  - [ ] Handle album page loading detection
  - [ ] Manage browser tab/window for navigation
- [ ] Create track-level metadata extraction:
  - [ ] Extract track numbers
  - [ ] Extract track titles
  - [ ] Extract track durations
  - [ ] Identify track order/sequencing
- [ ] Add album-level metadata extraction:
  - [ ] Full album title
  - [ ] Release date
  - [ ] Album description
  - [ ] High-resolution artwork URLs

#### Task 3.4: Download Link Discovery (Day 3-4)
- [ ] Locate download page access:
  - [ ] Find download links/buttons on album pages
  - [ ] Navigate to download pages
  - [ ] Handle download page authentication
- [ ] Implement MP3 download link extraction:
  - [ ] Parse download page DOM for MP3 links
  - [ ] Extract direct download URLs
  - [ ] Handle different download page layouts
  - [ ] Validate download link accessibility
- [ ] Add download format detection:
  - [ ] Confirm MP3 format availability
  - [ ] Handle cases where MP3 isn't available
  - [ ] Extract download file metadata

#### Task 3.5: Data Aggregation & Validation (Day 4)
- [ ] Create comprehensive data structure:
  - [ ] Combine album and track metadata
  - [ ] Link download URLs to tracks
  - [ ] Organize data for download processing
- [ ] Implement data validation:
  - [ ] Verify all required fields are present
  - [ ] Validate download URLs are accessible
  - [ ] Check for missing or corrupted metadata
- [ ] Add data sanitization:
  - [ ] Clean up extracted text (remove HTML, fix encoding)
  - [ ] Sanitize filenames and paths
  - [ ] Handle special characters and unicode

#### Task 3.6: Scraping Testing & Mock Data (Day 5)
- [ ] Test scraping with various account types:
  - [ ] Accounts with many purchases
  - [ ] Accounts with few purchases
  - [ ] Different album types (single, EP, LP)
- [ ] Create mock data for testing:
  - [ ] Sample album metadata
  - [ ] Mock download URLs
  - [ ] Test data for edge cases
- [ ] Validate scraping accuracy:
  - [ ] Compare extracted data with actual album info
  - [ ] Test download link validity
  - [ ] Verify metadata completeness

**Unit Tests:**
- [ ] Test DOM parsing functions with mock HTML
- [ ] Test CSS selector robustness with variations
- [ ] Test metadata extraction accuracy
- [ ] Test pagination handling logic
- [ ] Test download link validation functions

**Acceptance Test:**
- [ ] **AC3.6.1**: Successfully extracts all albums from purchases page
- [ ] **AC3.6.2**: Correctly identifies album metadata (title, artist, date)
- [ ] **AC3.6.3**: Finds valid download links for all purchased albums
- [ ] **AC3.6.4**: Handles edge cases (special characters, missing data)
- [ ] **AC3.6.5**: Works with different Bandcamp page layouts
- [ ] **AC3.6.6**: Scraping completes within reasonable time limits

### Phase 4: Download Manager Implementation (Week 4)

**Duration**: 5 days  
**Dependencies**: Phase 3 complete (purchase discovery working)  
**Deliverables**: Complete download management system with progress tracking

#### Task 4.1: Core Download Engine (Day 1)
- [ ] Create `lib/download-manager.js` foundation
- [ ] Implement sequential download queue:
  - [ ] Create download queue data structure
  - [ ] Add queue management (add, remove, prioritize)
  - [ ] Implement sequential processing (one at a time)
- [ ] Integrate Chrome Downloads API:
  - [ ] Use `chrome.downloads.download()` for file downloads
  - [ ] Handle download initiation
  - [ ] Monitor download progress events
  - [ ] Detect download completion/failure
- [ ] Create download job management:
  - [ ] Track individual download jobs
  - [ ] Manage download metadata
  - [ ] Handle download state transitions

#### Task 4.2: Progress Tracking System (Day 1-2)
- [ ] Implement download progress tracking:
  - [ ] Track individual file download progress
  - [ ] Calculate overall progress (X of Y albums completed)
  - [ ] Track bytes downloaded vs total size
- [ ] Create progress state management:
  - [ ] Maintain download state in memory (session-based only)
  - [ ] Track completed vs pending downloads
  - [ ] Store current download status
- [ ] Implement progress reporting to UI:
  - [ ] Send progress updates to popup
  - [ ] Update progress indicators in real-time
  - [ ] Show current downloading item details

#### Task 4.3: Error Handling & Retry Logic (Day 2-3)
- [ ] Implement download failure detection:
  - [ ] Monitor Chrome download events for failures
  - [ ] Detect network errors and timeouts
  - [ ] Identify different failure types
- [ ] Create retry mechanism:
  - [ ] Implement configurable retry attempts (default: 3)
  - [ ] Add exponential backoff for retries
  - [ ] Track retry count per download
- [ ] Add comprehensive error handling:
  - [ ] Handle network connectivity issues
  - [ ] Manage disk space problems
  - [ ] Deal with permission errors
  - [ ] Log error details for debugging

#### Task 4.4: Resume & Recovery Functionality (Day 3)
- [ ] Implement session expiry handling:
  - [ ] Detect when authentication expires during downloads
  - [ ] Stop current downloads gracefully
  - [ ] Prompt user for re-authentication
  - [ ] Resume from last successful download after re-login
- [ ] Create download interruption recovery:
  - [ ] Handle browser/extension crashes
  - [ ] Clean up partial downloads
  - [ ] Resume from interruption point
- [ ] Add download state persistence (session-based only):
  - [ ] Keep current state in memory
  - [ ] No cross-session persistence (per requirements)
  - [ ] Reset state on extension reload

#### Task 4.5: Rate Limiting & Throttling (Day 4)
- [ ] Implement download rate limiting:
  - [ ] Add configurable delays between downloads
  - [ ] Default to 2-3 seconds between downloads
  - [ ] Respect Bandcamp server load
- [ ] Create bandwidth management:
  - [ ] Monitor download speeds
  - [ ] Adjust timing based on performance
  - [ ] Handle server response times
- [ ] Add polite downloading behavior:
  - [ ] Avoid overwhelming Bandcamp servers
  - [ ] Implement reasonable request patterns
  - [ ] Add user-configurable throttling options

#### Task 4.6: Download Manager Testing (Day 5)
- [ ] Test sequential download processing:
  - [ ] Verify downloads happen one at a time
  - [ ] Test queue management functionality
  - [ ] Validate download completion detection
- [ ] Test error scenarios:
  - [ ] Network interruptions
  - [ ] Authentication expiry
  - [ ] Disk space issues
  - [ ] Invalid download URLs
- [ ] Test retry and recovery:
  - [ ] Failed download retry attempts
  - [ ] Session expiry recovery
  - [ ] Partial download cleanup
- [ ] Performance testing:
  - [ ] Large download queues
  - [ ] Long-running download sessions
  - [ ] Memory usage monitoring

**Unit Tests:**
- [ ] Test download queue data structure operations
- [ ] Test Chrome Downloads API integration
- [ ] Test progress tracking calculations
- [ ] Test retry logic with exponential backoff
- [ ] Test error classification and handling

**Acceptance Test:**
- [ ] **AC4.6.1**: Downloads process sequentially without overlapping
- [ ] **AC4.6.2**: Progress tracking accurately reflects download status
- [ ] **AC4.6.3**: Failed downloads retry automatically up to limit
- [ ] **AC4.6.4**: Session expiry stops downloads and prompts re-auth
- [ ] **AC4.6.5**: Large queues (50+ items) process reliably
- [ ] **AC4.6.6**: Memory usage remains stable during long sessions

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

#### Task 5.4: File Organization System (Day 3-4)
- [ ] Implement folder structure creation:
  - [ ] Create `Artist / Album / TrackNumber - Title.mp3` structure
  - [ ] Handle nested folder creation
  - [ ] Ensure cross-platform path compatibility
- [ ] Add filename sanitization:
  - [ ] Remove/replace invalid filesystem characters
  - [ ] Handle Unicode characters properly
  - [ ] Maintain filename readability
  - [ ] Log sanitization decisions
- [ ] Implement duplicate handling:
  - [ ] Detect duplicate filenames
  - [ ] Append numbers for conflicts (e.g., "Song (2).mp3")
  - [ ] Log duplicate resolution decisions
  - [ ] Maintain original filename intent

#### Task 5.5: File Processing Integration (Day 4)
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

#### Task 5.6: Metadata & Organization Testing (Day 5)
- [ ] Test metadata embedding:
  - [ ] Verify all metadata fields are embedded correctly
  - [ ] Test with various MP3 file types
  - [ ] Validate metadata player compatibility
- [ ] Test file organization:
  - [ ] Verify folder structure creation
  - [ ] Test filename sanitization edge cases
  - [ ] Validate duplicate handling
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
- [ ] Test filename sanitization with edge cases
- [ ] Test folder structure creation logic
- [ ] Test artwork processing and embedding
- [ ] Test duplicate file handling algorithms

**Acceptance Test:**
- [ ] **AC5.6.1**: All metadata fields appear correctly in music players
- [ ] **AC5.6.2**: Files are organized in correct folder structure
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

| Phase | Week | Duration | Tasks | Key Deliverables |
|-------|------|----------|-------|------------------|
| 1 | 1 | 5 days | 7 tasks | Project setup, extension foundation |
| 2 | 2 | 5 days | 6 tasks | Authentication and session management |
| 3 | 3 | 5 days | 6 tasks | Purchase discovery and scraping |
| 4 | 4 | 5 days | 6 tasks | Download manager implementation |
| 5 | 5 | 5 days | 6 tasks | Metadata and file organization |
| 6 | 6 | 5 days | 6 tasks | User interface development |
| 7 | 7 | 5 days | 5 tasks | Testing and polish |

**Total Estimated Duration: 7 weeks (35 working days)**  
**Total Tasks: 42 detailed tasks with 300+ sub-tasks**  
**Testing Coverage: Unit tests and acceptance tests for every task**

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
