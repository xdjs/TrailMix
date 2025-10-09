/**
 * Tests for Manifest Manager
 */

const { ManifestManager } = require('../../lib/manifest-manager.js');

describe('ManifestManager', () => {
  let manifestManager;
  let mockDownloads;
  let mockStorage;

  beforeEach(() => {
    manifestManager = new ManifestManager();
    
    // Mock chrome.downloads API
    mockDownloads = {
      search: jest.fn(),
      download: jest.fn()
    };
    
    // Mock chrome.storage.local API with in-memory store
    mockStorage = {
      _store: {},
      get: jest.fn((keys) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        const result = {};
        keysArray.forEach(key => {
          if (key in mockStorage._store) {
            result[key] = mockStorage._store[key];
          }
        });
        return Promise.resolve(result);
      }),
      set: jest.fn((data) => {
        Object.assign(mockStorage._store, data);
        return Promise.resolve();
      })
    };
    
    global.chrome = {
      downloads: mockDownloads,
      storage: {
        local: mockStorage
      }
    };
    
    // Mock btoa and related functions for data URL encoding
    global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'));
    global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));
    
    // Mock global downloadMetadata
    global.downloadMetadata = new Map();
  });

  afterEach(() => {
    jest.clearAllMocks();
    manifestManager.reset();
  });

  describe('initialization', () => {
    it('should start with empty entries and not initialized', () => {
      expect(manifestManager.entries).toEqual([]);
      expect(manifestManager.isInitialized).toBe(false);
      expect(manifestManager.isPending).toBe(false);
    });

    it('should initialize with no existing manifest in storage', async () => {
      await manifestManager.initialize();
      
      expect(manifestManager.isInitialized).toBe(true);
      expect(manifestManager.entries).toEqual([]);
      expect(mockStorage.get).toHaveBeenCalledWith(['manifestEntries']);
    });

    it('should only initialize once', async () => {
      await manifestManager.initialize();
      await manifestManager.initialize();
      
      expect(mockStorage.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('readExistingManifest', () => {
    it('should handle no existing manifest in storage gracefully', async () => {
      await manifestManager.readExistingManifest();
      
      expect(manifestManager.entries).toEqual([]);
      expect(mockStorage.get).toHaveBeenCalledWith(['manifestEntries']);
    });

    it('should handle storage read errors gracefully', async () => {
      mockStorage.get.mockRejectedValue(new Error('Storage read failed'));
      
      await manifestManager.readExistingManifest();
      
      expect(manifestManager.entries).toEqual([]);
    });

    it('should load existing entries from storage', async () => {
      const existingEntries = [
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:00:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file1.zip'
        },
        {
          artist: 'Artist 2',
          item_name: 'Album 2',
          timestamp: '2025-01-02T00:00:00.000Z',
          filePath: 'TrailMix/Artist 2/Album 2/file2.zip'
        }
      ];
      
      mockStorage._store.manifestEntries = existingEntries;
      
      await manifestManager.readExistingManifest();
      
      expect(manifestManager.entries).toHaveLength(2);
      expect(manifestManager.entries[0]).toEqual({
        artist: 'Artist 1',
        item_name: 'Album 1',
        timestamp: '2025-01-01T00:00:00.000Z',
        filePath: 'TrailMix/Artist 1/Album 1/file1.zip'
      });
      expect(manifestManager.entries[1]).toEqual({
        artist: 'Artist 2',
        item_name: 'Album 2',
        timestamp: '2025-01-02T00:00:00.000Z',
        filePath: 'TrailMix/Artist 2/Album 2/file2.zip'
      });
    });

    it('should handle non-array storage data gracefully', async () => {
      mockStorage._store.manifestEntries = "invalid data";
      
      await manifestManager.readExistingManifest();
      
      expect(manifestManager.entries).toEqual([]);
    });
  });

  describe('appendEntry', () => {
    beforeEach(async () => {
      mockDownloads.download.mockResolvedValue(123);
    });

    it('should append a new entry and write manifest', async () => {
      await manifestManager.appendEntry(
        'Test Artist',
        'Test Album',
        '2025-10-09T12:00:00.000Z',
        'TrailMix/Test Artist/Test Album/file.zip'
      );
      
      expect(manifestManager.entries).toHaveLength(1);
      expect(manifestManager.entries[0]).toEqual({
        artist: 'Test Artist',
        item_name: 'Test Album',
        timestamp: '2025-10-09T12:00:00.000Z',
        filePath: 'TrailMix/Test Artist/Test Album/file.zip'
      });
      
      // Should save to storage
      expect(mockStorage.set).toHaveBeenCalledWith({
        manifestEntries: expect.arrayContaining([
          expect.objectContaining({
            artist: 'Test Artist',
            item_name: 'Test Album'
          })
        ])
      });
      
      // Should also export JSONL file
      expect(mockDownloads.download).toHaveBeenCalled();
    });

    it('should initialize before first append', async () => {
      expect(manifestManager.isInitialized).toBe(false);
      
      await manifestManager.appendEntry(
        'Test Artist',
        'Test Album',
        '2025-10-09T12:00:00.000Z',
        'TrailMix/Test Artist/Test Album/file.zip'
      );
      
      expect(manifestManager.isInitialized).toBe(true);
    });

    it('should not throw on write errors', async () => {
      mockStorage.set.mockRejectedValue(new Error('Storage write failed'));
      
      // Should not throw
      await expect(manifestManager.appendEntry(
        'Test Artist',
        'Test Album',
        '2025-10-09T12:00:00.000Z',
        'TrailMix/Test Artist/Test Album/file.zip'
      )).resolves.not.toThrow();
      
      // Entry should still be added
      expect(manifestManager.entries).toHaveLength(1);
    });

    it('should warn when approaching storage limit', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mark as initialized so appendEntry doesn't reset entries
      manifestManager.isInitialized = true;
      
      // Create many large entries to exceed 9 MB
      const largeEntry = {
        artist: 'A'.repeat(2000),
        item_name: 'B'.repeat(2000),
        timestamp: '2025-10-09T12:00:00.000Z',
        filePath: 'C'.repeat(2000)
      };
      
      // Add enough entries to exceed 9 MB (9 * 1024 * 1024 = 9,437,184 bytes)
      // Each entry is about 6000+ bytes, so we need about 1600 entries
      for (let i = 0; i < 1600; i++) {
        manifestManager.entries.push({ ...largeEntry, filePath: `${largeEntry.filePath}-${i}` });
      }
      
      await manifestManager.appendEntry(
        'Test Artist',
        'Test Album',
        '2025-10-09T12:00:00.000Z',
        'TrailMix/Test Artist/Test Album/file.zip'
      );
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Storage usage is')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('approaching 10 MB limit')
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('writeManifest', () => {
    beforeEach(() => {
      mockDownloads.download.mockResolvedValue(123);
    });

    it('should save to storage and generate JSONL export', async () => {
      manifestManager.entries = [
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:00:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file1.zip'
        },
        {
          artist: 'Artist 2',
          item_name: 'Album 2',
          timestamp: '2025-01-02T00:00:00.000Z',
          filePath: 'TrailMix/Artist 2/Album 2/file2.zip'
        }
      ];
      
      await manifestManager.writeManifest();
      
      // First should save to storage
      expect(mockStorage.set).toHaveBeenCalledWith({
        manifestEntries: manifestManager.entries
      });
      
      // Then should export JSONL file
      expect(global.btoa).toHaveBeenCalled();
      expect(mockDownloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringMatching(/^data:application\/jsonl;base64,/),
          filename: 'TrailMix.json'
        })
      );
    });

    it('should set manifest metadata marker', async () => {
      manifestManager.entries = [
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:00:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file1.zip'
        }
      ];
      
      await manifestManager.writeManifest();
      
      // Find the data URL that was used
      const dataUrlKeys = Array.from(global.downloadMetadata.keys());
      const dataUrl = dataUrlKeys.find(key => key.startsWith('data:application/jsonl'));
      
      expect(dataUrl).toBeTruthy();
      expect(global.downloadMetadata.get(dataUrl)).toEqual({
        isManifest: true,
        artist: null,
        title: null
      });
    });

    it('should download with correct filename and options', async () => {
      manifestManager.entries = [
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:00:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file1.zip'
        }
      ];
      
      await manifestManager.writeManifest();
      
      expect(mockDownloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringMatching(/^data:application\/jsonl;base64,/),
          filename: 'TrailMix.json',
          saveAs: false,
          conflictAction: 'overwrite'
        })
      );
    });

    it('should skip write if already pending', async () => {
      manifestManager.isPending = true;
      
      await manifestManager.writeManifest();
      
      expect(mockStorage.set).not.toHaveBeenCalled();
      expect(mockDownloads.download).not.toHaveBeenCalled();
    });

    it('should not throw on storage errors', async () => {
      mockStorage.set.mockRejectedValue(new Error('Storage failed'));
      
      manifestManager.entries = [
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:00:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file1.zip'
        }
      ];
      
      await expect(manifestManager.writeManifest()).resolves.not.toThrow();
    });
  });

  describe('finalize', () => {
    beforeEach(() => {
      mockDownloads.download.mockResolvedValue(123);
      manifestManager.isInitialized = true;
    });

    it('should do nothing if no entries', async () => {
      manifestManager.entries = [];
      
      await manifestManager.finalize();
      
      expect(mockDownloads.download).not.toHaveBeenCalled();
    });

    it('should deduplicate entries by filePath', async () => {
      manifestManager.entries = [
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:00:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file.zip'
        },
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:01:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file.zip' // Duplicate
        },
        {
          artist: 'Artist 2',
          item_name: 'Album 2',
          timestamp: '2025-01-02T00:00:00.000Z',
          filePath: 'TrailMix/Artist 2/Album 2/file.zip'
        }
      ];
      
      await manifestManager.finalize();
      
      expect(manifestManager.entries).toHaveLength(2);
      expect(manifestManager.entries[0].filePath).toBe('TrailMix/Artist 1/Album 1/file.zip');
      expect(manifestManager.entries[1].filePath).toBe('TrailMix/Artist 2/Album 2/file.zip');
    });

    it('should write manifest after deduplication', async () => {
      manifestManager.entries = [
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:00:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file.zip'
        }
      ];
      
      await manifestManager.finalize();
      
      expect(mockDownloads.download).toHaveBeenCalled();
    });

    it('should not throw on errors', async () => {
      mockDownloads.download.mockRejectedValue(new Error('Write failed'));
      
      manifestManager.entries = [
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:00:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file.zip'
        }
      ];
      
      await expect(manifestManager.finalize()).resolves.not.toThrow();
    });
  });

  describe('getManifestPath', () => {
    it('should return path of latest manifest', async () => {
      mockDownloads.search.mockResolvedValue([
        { id: 1, filename: '/path/to/Downloads/TrailMix/TrailMix.json' }
      ]);
      
      const path = await manifestManager.getManifestPath();
      
      expect(path).toBe('/path/to/Downloads/TrailMix/TrailMix.json');
      expect(mockDownloads.search).toHaveBeenCalledWith({
        query: ['TrailMix.json'],
        orderBy: ['-startTime'],
        limit: 1
      });
    });

    it('should return null if no manifest found', async () => {
      mockDownloads.search.mockResolvedValue([]);
      
      const path = await manifestManager.getManifestPath();
      
      expect(path).toBeNull();
    });

    it('should return null on errors', async () => {
      mockDownloads.search.mockRejectedValue(new Error('Search failed'));
      
      const path = await manifestManager.getManifestPath();
      
      expect(path).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      manifestManager.entries = [{ artist: 'Test' }];
      manifestManager.isPending = true;
      manifestManager.isInitialized = true;
      
      manifestManager.reset();
      
      expect(manifestManager.entries).toEqual([]);
      expect(manifestManager.isPending).toBe(false);
      expect(manifestManager.isInitialized).toBe(false);
    });
  });
});

