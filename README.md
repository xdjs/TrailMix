# Trail Mix Chrome Extension

A Chrome extension that allows users to bulk-download their paid Bandcamp purchases in MP3 format with embedded metadata and artwork.

## Features

- **Bulk Download**: Download all your paid Bandcamp purchases at once
- **Side Panel UI**: Persistent side panel interface that stays open during downloads
- **MP3 Format**: Downloads in MP3 format with embedded metadata
- **Artwork Embedding**: Includes album artwork in downloaded files
- **Smart Organization**: Organizes files as `TrailMix/Artist/Album/filename.mp3`
- **Progress Tracking**: Real-time progress dashboard with detailed status
- **Error Handling**: Automatic retry and graceful error recovery
- **Session Management**: Secure authentication without credential storage
- **Queue Persistence**: Downloads resume automatically after browser restarts

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
4. **Auto-Refresh**: The side panel automatically detects when you've logged in and updates the UI
5. **Start Download**: Click "Start Download" to begin bulk downloading your purchases
6. **Monitor Progress**: Watch the progress dashboard in the side panel for real-time status updates
7. **Pause/Resume**: Use the Pause and Resume buttons to control downloads
8. **Completion**: Files are organized in your Downloads folder under `TrailMix/Artist/Album/`

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
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run acceptance tests
npm run test:acceptance

# Run all tests
npm test
```

### Code Quality

- Minimum 85% test coverage required
- ESLint configuration for code style
- Pre-commit hooks for quality checks

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

## Support

For issues, feature requests, or questions:
- Check the [troubleshooting guide](docs/troubleshooting.md)
- Review [known issues](docs/known-issues.md)
- Open an issue on the project repository

## License

MIT License - See [LICENSE](LICENSE) file for details

## Roadmap

See the [implementation plan](plans/implementation_plan.md) for detailed development phases and timelines.

---

**Version**: 1.0.0-dev  
**Status**: In Development  
**Chrome Extension**: Manifest V3

