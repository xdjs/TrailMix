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
          filePath: 'TrailMix/Artist 1/Album 1/file.zip',
          downloadId: 123
        },
        {
          artist: 'Artist 1',
          item_name: 'Album 1',
          timestamp: '2025-01-01T00:01:00.000Z',
          filePath: 'TrailMix/Artist 1/Album 1/file.zip', // Duplicate
          downloadId: 124
        },
        {
          artist: 'Artist 2',
          item_name: 'Album 2',
          timestamp: '2025-01-02T00:00:00.000Z',
          filePath: 'TrailMix/Artist 2/Album 2/file.zip',
          downloadId: 125
        }
      ];
      
      // Mock all downloads as existing
      mockDownloads.search.mockResolvedValue([{ exists: true }]);
      
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
          filePath: 'TrailMix/Artist 1/Album 1/file.zip',
          downloadId: 123
        }
      ];
      
      // Mock download as existing
      mockDownloads.search.mockResolvedValue([{ exists: true }]);
      
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
          filePath: 'TrailMix/Artist 1/Album 1/file.zip',
          downloadId: 123
        }
      ];
      
      // Mock download as existing
      mockDownloads.search.mockResolvedValue([{ exists: true }]);
      
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

  describe('isAlreadyDownloaded', () => {
    beforeEach(() => {
      manifestManager.isInitialized = true;
    });

    it('should match by artist and title', () => {
      manifestManager.entries = [
        { 
          artist: 'Pink Floyd', 
          item_name: 'The Wall', 
          filePath: 'TrailMix/Pink Floyd/The Wall/album.zip',
          timestamp: '2025-10-09T10:00:00.000Z'
        }
      ];
      
      expect(manifestManager.isAlreadyDownloaded({
        artist: 'Pink Floyd',
        title: 'The Wall'
      })).toBe(true);
    });
    
    it('should return false for new items', () => {
      manifestManager.entries = [
        { artist: 'Pink Floyd', item_name: 'The Wall', filePath: 'path.zip' }
      ];
      
      expect(manifestManager.isAlreadyDownloaded({
        artist: 'Pink Floyd',
        title: 'Dark Side of the Moon'
      })).toBe(false);
    });
    
    it('should return false when artist matches but title differs', () => {
      manifestManager.entries = [
        { artist: 'AC/DC', item_name: 'Back in Black', filePath: 'path.zip' }
      ];
      
      expect(manifestManager.isAlreadyDownloaded({
        artist: 'AC/DC',
        title: 'Highway to Hell'
      })).toBe(false);
    });
    
    it('should return false when title matches but artist differs', () => {
      manifestManager.entries = [
        { artist: 'The Beatles', item_name: 'Abbey Road', filePath: 'path.zip' }
      ];
      
      expect(manifestManager.isAlreadyDownloaded({
        artist: 'Pink Floyd',
        title: 'Abbey Road'
      })).toBe(false);
    });
    
    it('should handle missing purchase data gracefully', () => {
      manifestManager.entries = [
        { artist: 'Test', item_name: 'Album', filePath: 'path.zip' }
      ];
      
      expect(manifestManager.isAlreadyDownloaded(null)).toBe(false);
      expect(manifestManager.isAlreadyDownloaded({})).toBe(false);
      expect(manifestManager.isAlreadyDownloaded({ artist: 'Test' })).toBe(false);
      expect(manifestManager.isAlreadyDownloaded({ title: 'Album' })).toBe(false);
    });
    
    it('should match with multiple entries in manifest', () => {
      manifestManager.entries = [
        { artist: 'Artist 1', item_name: 'Album 1', filePath: 'path1.zip' },
        { artist: 'Artist 2', item_name: 'Album 2', filePath: 'path2.zip' },
        { artist: 'Artist 3', item_name: 'Album 3', filePath: 'path3.zip' }
      ];
      
      expect(manifestManager.isAlreadyDownloaded({
        artist: 'Artist 2',
        title: 'Album 2'
      })).toBe(true);
    });

    it('should match case-insensitively', () => {
      manifestManager.entries = [
        { 
          artist: 'Moe Shop', 
          item_name: 'Identity (w/ SEIJ)', 
          filePath: 'TrailMix/Moe Shop/Identity/file.m4a',
          timestamp: '2025-10-09T10:00:00.000Z'
        }
      ];
      
      // Should match even with different casing
      expect(manifestManager.isAlreadyDownloaded({
        artist: 'moe shop',
        title: 'identity (w/ seij)'
      })).toBe(true);
      
      expect(manifestManager.isAlreadyDownloaded({
        artist: 'MOE SHOP',
        title: 'IDENTITY (W/ SEIJ)'
      })).toBe(true);
      
      expect(manifestManager.isAlreadyDownloaded({
        artist: 'Moe Shop',
        title: 'Identity (w/ SEIJ)'
      })).toBe(true);
    });
  });

  describe('validateEntries', () => {
    beforeEach(() => {
      manifestManager.isInitialized = true;
      mockDownloads.search = jest.fn();
    });

    it('should keep entries with valid downloadId and exists=true', async () => {
      manifestManager.entries = [
        { 
          artist: 'Artist 1', 
          item_name: 'Album 1', 
          filePath: 'path1.zip',
          downloadId: 123
        }
      ];
      
      mockDownloads.search.mockResolvedValue([
        { id: 123, exists: true, filename: 'path1.zip' }
      ]);
      
      const removed = await manifestManager.validateEntries();
      
      expect(removed).toBe(0);
      expect(manifestManager.entries).toHaveLength(1);
      expect(mockDownloads.search).toHaveBeenCalledWith({ id: 123 });
    });
    
    it('should remove entries where file no longer exists', async () => {
      manifestManager.entries = [
        { artist: 'Artist 1', item_name: 'Album 1', filePath: 'path1.zip', downloadId: 123 },
        { artist: 'Artist 2', item_name: 'Album 2', filePath: 'path2.zip', downloadId: 456 }
      ];
      
      mockDownloads.search
        .mockResolvedValueOnce([{ id: 123, exists: false }])  // File deleted
        .mockResolvedValueOnce([{ id: 456, exists: true }]);   // File exists
      
      const removed = await manifestManager.validateEntries();
      
      expect(removed).toBe(1);
      expect(manifestManager.entries).toHaveLength(1);
      expect(manifestManager.entries[0].artist).toBe('Artist 2');
    });
    
    it('should remove entries where download record is gone', async () => {
      manifestManager.entries = [
        { artist: 'Artist 1', item_name: 'Album 1', filePath: 'path1.zip', downloadId: 999 }
      ];
      
      mockDownloads.search.mockResolvedValue([]);  // No record found
      
      const removed = await manifestManager.validateEntries();
      
      expect(removed).toBe(1);
      expect(manifestManager.entries).toHaveLength(0);
    });
    
    it('should remove entries without downloadId (pre-validation entries)', async () => {
      manifestManager.entries = [
        { artist: 'Artist 1', item_name: 'Album 1', filePath: 'path1.zip' }  // No downloadId
      ];
      
      const removed = await manifestManager.validateEntries();
      
      expect(removed).toBe(1);
      expect(manifestManager.entries).toHaveLength(0);
      expect(mockDownloads.search).not.toHaveBeenCalled();
    });
    
    it('should save cleaned entries to storage', async () => {
      manifestManager.entries = [
        { artist: 'Artist 1', item_name: 'Album 1', downloadId: 123 }
      ];
      
      mockDownloads.search.mockResolvedValue([{ exists: false }]);
      
      await manifestManager.validateEntries();
      
      expect(mockStorage.set).toHaveBeenCalledWith({
        manifestEntries: []
      });
    });

    it('should return 0 for empty entries', async () => {
      manifestManager.entries = [];
      
      const removed = await manifestManager.validateEntries();
      
      expect(removed).toBe(0);
      expect(mockDownloads.search).not.toHaveBeenCalled();
    });
  });
});

