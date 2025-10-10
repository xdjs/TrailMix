/**
 * Trail Mix - Manifest Manager Tests
 * Unit tests for manifest tracking functionality
 */

const { ManifestManager } = require('../../lib/manifest-manager.js');

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      _store: {},
      get: jest.fn((keys) => {
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(key => {
            if (key in global.chrome.storage.local._store) {
              result[key] = global.chrome.storage.local._store[key];
            }
          });
          return Promise.resolve(result);
        } else if (typeof keys === 'object') {
          // Handle object with default values
          const result = {};
          for (const key in keys) {
            result[key] = global.chrome.storage.local._store[key] || keys[key];
          }
          return Promise.resolve(result);
        } else {
          return Promise.resolve(global.chrome.storage.local._store);
        }
      }),
      set: jest.fn((data) => {
        global.chrome.storage.local._store = { ...global.chrome.storage.local._store, ...data };
        return Promise.resolve();
      }),
      remove: jest.fn((keys) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => {
          delete global.chrome.storage.local._store[key];
        });
        return Promise.resolve();
      })
    }
  },
  downloads: {
    download: jest.fn(() => Promise.resolve(123))
  }
};

describe('ManifestManager', () => {
  let manager;

  beforeEach(() => {
    // Reset storage and mocks before each test
    global.chrome.storage.local._store = {};
    jest.clearAllMocks();
    manager = new ManifestManager();
  });

  describe('initialize()', () => {
    test('should load existing entries from storage', async () => {
      const existingEntries = [
        { artist: 'Artist 1', title: 'Album 1', timestamp: '2025-01-01T00:00:00.000Z', filePath: 'TrailMix/Artist 1/Album 1/file.zip' },
        { artist: 'Artist 2', title: 'Album 2', timestamp: '2025-01-02T00:00:00.000Z', filePath: 'TrailMix/Artist 2/Album 2/file.zip' }
      ];
      global.chrome.storage.local._store.manifestEntries = existingEntries;

      await manager.initialize();

      expect(manager.entries).toEqual(existingEntries);
      expect(manager.getEntryCount()).toBe(2);
    });

    test('should initialize with empty array when no existing entries', async () => {
      await manager.initialize();

      expect(manager.entries).toEqual([]);
      expect(manager.getEntryCount()).toBe(0);
    });

    test('should handle invalid storage data gracefully', async () => {
      global.chrome.storage.local._store.manifestEntries = 'invalid';

      await manager.initialize();

      expect(manager.entries).toEqual([]);
      expect(manager.getEntryCount()).toBe(0);
    });
  });

  describe('appendEntry()', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should append a new entry and save to storage', async () => {
      await manager.appendEntry('Test Artist', 'Test Album', '2025-10-10T12:00:00.000Z', 'TrailMix/Test Artist/Test Album/file.zip');

      expect(manager.entries).toHaveLength(1);
      expect(manager.entries[0]).toEqual({
        artist: 'Test Artist',
        title: 'Test Album',
        timestamp: '2025-10-10T12:00:00.000Z',
        filePath: 'TrailMix/Test Artist/Test Album/file.zip'
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        manifestEntries: manager.entries
      });
    });

    test('should NOT export to file after appending (only at finalization)', async () => {
      const downloadCallsBefore = chrome.downloads.download.mock.calls.length;
      
      await manager.appendEntry('Test Artist', 'Test Album', '2025-10-10T12:00:00.000Z', 'TrailMix/Test Artist/Test Album/file.zip');

      const downloadCallsAfter = chrome.downloads.download.mock.calls.length;
      expect(downloadCallsAfter).toBe(downloadCallsBefore); // No new download calls
    });

    test('should append multiple entries', async () => {
      await manager.appendEntry('Artist 1', 'Album 1', '2025-01-01T00:00:00.000Z', 'TrailMix/Artist 1/Album 1/file.zip');
      await manager.appendEntry('Artist 2', 'Album 2', '2025-01-02T00:00:00.000Z', 'TrailMix/Artist 2/Album 2/file.zip');
      await manager.appendEntry('Artist 3', 'Album 3', '2025-01-03T00:00:00.000Z', 'TrailMix/Artist 3/Album 3/file.zip');

      expect(manager.entries).toHaveLength(3);
      expect(manager.entries[0].artist).toBe('Artist 1');
      expect(manager.entries[1].artist).toBe('Artist 2');
      expect(manager.entries[2].artist).toBe('Artist 3');
    });
  });

  describe('exportToFile()', () => {
    test('should create JSONL format with one entry per line', async () => {
      await manager.initialize();
      await manager.appendEntry('Artist 1', 'Album 1', '2025-01-01T00:00:00.000Z', 'TrailMix/Artist 1/Album 1/file.zip');
      await manager.appendEntry('Artist 2', 'Album 2', '2025-01-02T00:00:00.000Z', 'TrailMix/Artist 2/Album 2/file.zip');

      // Manually trigger export (normally happens at finalization)
      await manager.exportToFile();

      // Get the download call
      const downloadCall = chrome.downloads.download.mock.calls[chrome.downloads.download.mock.calls.length - 1][0];
      
      // Should be a data URL with proper format and manifest marker
      expect(downloadCall.url).toMatch(/^data:application\/json;charset=utf-8;base64,.*#trailmix-manifest$/);
      expect(downloadCall.conflictAction).toBe('overwrite');
      
      // Decode and verify JSONL format (remove fragment)
      const urlWithoutFragment = downloadCall.url.split('#')[0];
      const base64Content = urlWithoutFragment.replace('data:application/json;charset=utf-8;base64,', '');
      const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
      
      const lines = decodedContent.split('\n');
      expect(lines).toHaveLength(2);
      
      const entry1 = JSON.parse(lines[0]);
      expect(entry1.artist).toBe('Artist 1');
      expect(entry1.title).toBe('Album 1');
      
      const entry2 = JSON.parse(lines[1]);
      expect(entry2.artist).toBe('Artist 2');
      expect(entry2.title).toBe('Album 2');
    });

    test('should not export when entries are empty', async () => {
      await manager.initialize();
      const callsBefore = chrome.downloads.download.mock.calls.length;

      await manager.exportToFile();

      const callsAfter = chrome.downloads.download.mock.calls.length;
      expect(callsAfter).toBe(callsBefore);
    });
  });

  describe('finalize()', () => {
    test('should deduplicate entries by artist+title (case-insensitive)', async () => {
      await manager.initialize();
      await manager.appendEntry('Artist 1', 'Album 1', '2025-01-01T00:00:00.000Z', 'TrailMix/Artist 1/Album 1/file.zip');
      await manager.appendEntry('ARTIST 1', 'ALBUM 1', '2025-01-02T00:00:00.000Z', 'TrailMix/ARTIST 1/ALBUM 1/file.zip');
      await manager.appendEntry('Artist 2', 'Album 2', '2025-01-03T00:00:00.000Z', 'TrailMix/Artist 2/Album 2/file.zip');

      jest.clearAllMocks(); // Clear previous download calls

      await manager.finalize();

      // Should only have 2 entries after deduplication
      const finalSetCall = chrome.storage.local.set.mock.calls.find(call => 
        call[0].manifestEntries && call[0].manifestEntries.length === 2
      );
      expect(finalSetCall).toBeDefined();
      expect(finalSetCall[0].manifestEntries).toHaveLength(2);

      // Should keep the earlier timestamp
      const artist1Entry = finalSetCall[0].manifestEntries.find(e => 
        e.artist.toLowerCase() === 'artist 1'
      );
      expect(artist1Entry.timestamp).toBe('2025-01-01T00:00:00.000Z');
    });

    test('should export final version and clear storage', async () => {
      await manager.initialize();
      await manager.appendEntry('Test Artist', 'Test Album', '2025-10-10T12:00:00.000Z', 'TrailMix/Test Artist/Test Album/file.zip');

      jest.clearAllMocks();

      await manager.finalize();

      // Should export to file
      expect(chrome.downloads.download).toHaveBeenCalled();

      // Should clear storage
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['manifestEntries']);

      // Should clear in-memory entries
      expect(manager.entries).toEqual([]);
      expect(manager.getEntryCount()).toBe(0);
    });

    test('should handle empty entries gracefully', async () => {
      await manager.initialize();

      await manager.finalize();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['manifestEntries']);
      expect(manager.entries).toEqual([]);
    });

    test('should keep earliest timestamp when deduplicating', async () => {
      await manager.initialize();
      // Add entries with different timestamps
      await manager.appendEntry('Artist', 'Album', '2025-01-03T00:00:00.000Z', 'TrailMix/Artist/Album/file3.zip');
      await manager.appendEntry('Artist', 'Album', '2025-01-01T00:00:00.000Z', 'TrailMix/Artist/Album/file1.zip');
      await manager.appendEntry('Artist', 'Album', '2025-01-02T00:00:00.000Z', 'TrailMix/Artist/Album/file2.zip');

      jest.clearAllMocks();

      await manager.finalize();

      // Should keep only one entry with earliest timestamp
      const finalSetCall = chrome.storage.local.set.mock.calls.find(call => 
        call[0].manifestEntries && call[0].manifestEntries.length === 1
      );
      expect(finalSetCall).toBeDefined();
      expect(finalSetCall[0].manifestEntries).toHaveLength(1);
      expect(finalSetCall[0].manifestEntries[0].timestamp).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  describe('reset()', () => {
    test('should clear all entries and storage', async () => {
      await manager.initialize();
      await manager.appendEntry('Test Artist', 'Test Album', '2025-10-10T12:00:00.000Z', 'TrailMix/Test Artist/Test Album/file.zip');

      await manager.reset();

      expect(manager.entries).toEqual([]);
      expect(manager.getEntryCount()).toBe(0);
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['manifestEntries']);
    });
  });

  describe('getEntries()', () => {
    test('should return a copy of entries array', async () => {
      await manager.initialize();
      await manager.appendEntry('Test Artist', 'Test Album', '2025-10-10T12:00:00.000Z', 'TrailMix/Test Artist/Test Album/file.zip');

      const entries = manager.getEntries();

      expect(entries).toEqual(manager.entries);
      expect(entries).not.toBe(manager.entries); // Should be a copy, not the same reference
    });
  });
});

