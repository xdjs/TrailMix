# Manifest System Implementation

## Overview
Implemented a JSONL manifest file (`TrailMix.json`) that tracks all downloads to the TrailMix root folder. The manifest records artist, item name (album/track/EP), timestamp, and file path for each download.

## Components Implemented

### 1. Manifest Manager (`lib/manifest-manager.js`)
- **ManifestManager class** with singleton instance
- **appendEntry()**: Adds a new entry after each download
- **readExistingManifest()**: Loads existing manifest on initialization
- **writeManifest()**: Generates JSONL Blob and downloads via Chrome API
- **finalize()**: Deduplicates entries and writes final version on batch completion
- **Error handling**: All methods fail gracefully without crashing downloads

### 2. Download Manager Updates (`lib/download-manager.js`)
- **recordDownloadInManifest()**: New method called on completion
- Uses `chrome.downloads.search()` to get final filename (including uniquify suffix)
- Extracts relative path from full system path
- Calls manifestManager.appendEntry() with metadata
- **handleCompletion()**: Now async to support manifest recording

### 3. Service Worker Integration (`background/service-worker.js`)
- Imports `manifest-manager.js`
- **Filename routing**: Detects manifest downloads via `isManifest` metadata flag
- Routes `TrailMix.json` to `TrailMix/TrailMix.json` (root level)
- Uses `conflictAction: 'overwrite'` to replace on each write
- **Batch completion**: Calls `manifestManager.finalize()` when queue is empty

### 4. Test Coverage
- **manifest-manager.test.js**: 25 tests covering all functionality
  - Initialization and reading existing manifests
  - JSONL format generation
  - Appending entries
  - Deduplication
  - Error handling
- **download-manager.test.js**: Added 5 manifest recording tests
  - Recording on completion
  - Path extraction
  - Graceful handling of missing manager
  - Error tolerance

## Data Format

### JSONL Entry Structure
```jsonl
{"artist":"Artist Name","item_name":"Album Title","timestamp":"2025-10-09T12:34:56.789Z","filePath":"TrailMix/Artist Name/Album Title/file.zip"}
```

Each line is a complete, standalone JSON object. No trailing commas between lines.

### File Location
- **Path**: `Downloads/TrailMix/TrailMix.json`
- **Format**: JSONL (JSON Lines) - one JSON object per line
- **Updates**: Written after each download, finalized after batch completes
- **Conflict resolution**: Overwrites existing file
- **Deduplication**: Final version removes duplicate entries by filePath

## Behavior

### Per-Download Recording
1. Download completes in DownloadManager
2. `recordDownloadInManifest()` queries final filename via Chrome API
3. Extracts relative path (strips absolute path prefix)
4. Appends entry to ManifestManager
5. ManifestManager writes updated manifest to disk

### Batch Finalization
1. Queue processing completes (queue empty)
2. Service worker calls `manifestManager.finalize()`
3. Deduplicates entries by filePath
4. Writes final manifest version

### Error Handling
- Manifest writes never block or crash downloads
- All async operations wrapped in try-catch
- Console warnings logged but not propagated
- Missing manifestManager handled gracefully in DownloadManager

## Testing Status
✅ All 24 manifest manager tests passing
✅ All 15 download manager tests passing (including 5 new manifest tests)
✅ No linter errors
✅ Error tolerance verified for:
  - Missing manifest file
  - Write failures
  - Missing manifestManager global
  - Chrome API errors
✅ Fixed: Uses data URLs instead of blob URLs (service worker compatibility)

## Implementation Notes

### Technical Decisions
1. **JSONL over single JSON array**: Easier to append without full parse/serialize
2. **Overwrite instead of append mode**: Chrome downloads API limitation
3. **Read-modify-write pattern**: Necessary for cross-session persistence
4. **Data URL with metadata marker**: Enables routing in onDeterminingFilename (data URLs work in service workers, blob URLs don't)
5. **Deduplication on finalize**: Handles interrupted/retried downloads
6. **Base64 encoding**: Uses `btoa(unescape(encodeURIComponent()))` for proper UTF-8 handling

### Chrome Extension Constraints
- Cannot write files directly to filesystem
- Must use `chrome.downloads.download()` with data URLs (blob URLs not supported in service workers)
- Filename routing via `onDeterminingFilename` listener
- Data URLs encode content directly in the URL

### Future Enhancements
- Optional: Add format/quality metadata
- Optional: Track failed downloads
- Optional: Export manifest as CSV or other formats
- Optional: UI to view manifest contents

