# Trail Mix Chrome Extension

A Chrome extension that allows users to bulk-download their paid Bandcamp purchases in MP3 format with embedded metadata and artwork.

## Features

- **Bulk Download**: Download all your paid Bandcamp purchases at once
- **MP3 Format**: Downloads in MP3 format with embedded metadata
- **Artwork Embedding**: Includes album artwork in downloaded files
- **Smart Organization**: Organizes files as `Artist / Album / TrackNumber - Title.mp3`
- **Progress Tracking**: Real-time progress dashboard with detailed status
- **Error Handling**: Automatic retry and graceful error recovery
- **Session Management**: Secure authentication without credential storage

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

- Google Chrome browser (latest version recommended)
- Active Bandcamp account with purchased music
- Sufficient disk space for downloads

## Usage

1. **Login**: Click the extension icon and log in to your Bandcamp account
2. **Start Download**: Click "Start Download" to begin bulk downloading your purchases
3. **Monitor Progress**: Watch the progress dashboard for real-time status updates
4. **Choose Location**: Select your preferred download folder in settings
5. **Completion**: Files will be organized and ready to play in your music library

## Project Structure

```
trail-mix/
├── manifest.json              # Chrome extension configuration
├── background/                 # Service worker and background scripts
├── content/                   # Content scripts for Bandcamp page interaction
├── popup/                     # Extension popup UI
├── lib/                       # Core library modules
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

- **Service Worker**: Manages extension lifecycle and coordinates components
- **Content Scripts**: Handle Bandcamp page scraping and interaction
- **Popup UI**: Provides user interface and progress tracking
- **Core Libraries**: Handle authentication, downloads, and metadata processing

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

[License information to be added]

## Roadmap

See the [implementation plan](plans/implementation_plan.md) for detailed development phases and timelines.

---

**Version**: 1.0.0-dev  
**Status**: In Development  
**Chrome Extension**: Manifest V3

