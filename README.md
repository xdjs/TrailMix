# Trail Mix Chrome Extension

A Chrome extension that allows users to bulk-download their paid Bandcamp purchases with embedded metadata and artwork.

## Features

- **Bulk Download**: Download all your paid Bandcamp purchases at once
- **Side Panel UI**: Persistent side panel interface that stays open during downloads
- **High-Quality Audio**: Downloads in AAC (M4A) or original format (ZIP for albums with multiple formats)
- **Smart Organization**: Organizes files as `TrailMix/Artist/Album/filename.ext`
- **Progress Tracking**: Real-time progress dashboard with detailed status
- **Activity Logging**: Comprehensive activity log showing all download lifecycle events
- **Error Handling**: Automatic retry and graceful error recovery
- **Session Management**: Secure authentication without credential storage
- **Queue Persistence**: Downloads resume automatically after browser restarts
- **Pause/Resume**: Full control over download queue with pause and resume functionality

## Installation

### Development Setup

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd trail-mix
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select this directory
   - The extension icon should appear in your browser toolbar

### Prerequisites

- Google Chrome browser version 114+ (for side panel support)
- Active Bandcamp account with purchased music
- Sufficient disk space for downloads

## Usage

1. **Open Side Panel**: Click the Trail Mix extension icon in your browser toolbar to open the side panel
2. **Login**: If not authenticated, click "Login to Bandcamp" (opens in new tab, side panel stays open)
3. **Authenticate**: Log in to Bandcamp in the new tab, then return to the side panel
4. **Auto-Detection**: The side panel automatically detects when you've logged in
5. **Start Download**: Click "Start Download" to discover and begin downloading your purchases
6. **Monitor Progress**:
   - Watch the progress bar and download statistics
   - View detailed activity log (expand "Activity Log" section)
   - See current download information in real-time
7. **Control Downloads**:
   - **Pause**: Click "Pause" to pause the current download and queue
   - **Resume**: Click "Resume" to continue from where you left off
   - **Cancel & Reset**: Click "Cancel & Reset" to stop all downloads and clear the queue
8. **Completion**: Files are organized in your Downloads folder under `TrailMix/Artist/Album/`

### Activity Log

The Activity Log provides comprehensive visibility into download operations:
- Discovery status (purchases found, errors)
- Download start/completion with file paths
- Pause/resume events with current position
- Cancellation and error messages
- Automatic deduplication of repeated messages

### Side Panel Benefits

- **Persistent UI**: Side panel stays open while you browse or work in other tabs
- **Always Accessible**: No need to repeatedly click the extension icon
- **Better for Long Operations**: Ideal for monitoring long-running download sessions
- **Resizable**: Drag the side panel edge to adjust width to your preference

## Project Structure

```
trail-mix/
├── manifest.json              # Chrome extension configuration
├── background/                 # Service worker and background scripts
├── content/                   # Content scripts for Bandcamp page interaction
├── sidepanel/                 # Extension side panel UI
│   ├── sidepanel.html         # Side panel HTML structure
│   ├── sidepanel.css          # Side panel styles
│   └── sidepanel.js           # Side panel logic and UI controller
├── lib/                       # Core library modules
│   ├── download-manager.js    # Download orchestration
│   ├── download-queue.js      # Queue management with persistence
│   ├── download-job.js        # Individual download job tracking
│   └── utils.js               # Utility functions
├── assets/                    # Icons and styling assets
├── tests/                     # Test files (unit, integration, acceptance)
├── docs/                      # Documentation
└── plans/                     # Project planning documents
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- <test-file-name>

# Run tests in watch mode
npm test -- --watch
```

### Test Coverage

Current test coverage includes:
- Service worker lifecycle and message handling
- Download queue with persistence
- Download job state management
- Authentication manager
- Content script scraping and navigation
- Side panel UI and activity logging
- File naming and metadata handling

### Code Quality

- Test-driven development approach
- Comprehensive unit test coverage
- Code follows Chrome Extension Manifest V3 best practices

## Architecture

The extension follows a modular architecture:

- **Service Worker**: Manages extension lifecycle, coordinates components, and handles download queue
- **Content Scripts**: Handle Bandcamp page scraping and interaction
- **Side Panel UI**: Provides persistent user interface and real-time progress tracking
- **Core Libraries**: Handle authentication, downloads, queue management, and metadata processing
- **Download Queue**: Persistent queue system with pause/resume and retry logic

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate tests
4. Ensure all tests pass and code coverage is maintained
5. Submit a pull request

## Legal Notice

This extension is intended for **personal archival use only** of music you have legally purchased on Bandcamp. Users are responsible for complying with Bandcamp's terms of service and applicable copyright laws.

## Current Status

**Phase 5**: UI Enhancement - In Progress
- ✅ Phase 1: Chrome Extension Foundation (Complete)
- ✅ Phase 2: Authentication & Session Management (Complete)
- ✅ Phase 3: Purchase Discovery & Scraping (Complete)
- ✅ Phase 4: Download System & Metadata (Complete)
- 🔄 Phase 5: UI Polish & User Experience (In Progress)
  - ✅ Side Panel UI Conversion
  - ✅ Enhanced Activity Logging
- ⏳ Phase 6: Testing & Polish (Planned)
- ⏳ Phase 7: Production Release (Planned)

### Recent Updates

- **Task 5.6: Enhanced Activity Logging** - Comprehensive logging of download lifecycle events
- **Task 4.10: Side Panel UI** - Converted popup to persistent side panel interface
- **Task 4.7.4: Album Folder Organization** - Downloads organized by Artist/Album structure

## Roadmap

See the [implementation plan](plans/implementation_plan.md) for detailed development phases, tasks, and acceptance criteria.

## License

MIT License - See [LICENSE](LICENSE) file for details

---

**Version**: 1.0.0-dev
**Status**: Phase 5 - UI Enhancement
**Chrome Extension**: Manifest V3

