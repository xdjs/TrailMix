/**
 * Tests for Manifest Manager
 */

const { ManifestManager } = require('../../lib/manifest-manager.js');

describe('ManifestManager', () => {
  let manifestManager;
  let mockDownloads;

  beforeEach(() => {
    manifestManager = new ManifestManager();
    
    // Mock chrome.downloads API
    mockDownloads = {
      search: jest.fn(),
      download: jest.fn()
    };
    
    global.chrome = {
      downloads: mockDownloads
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

    it('should initialize with no existing manifest', async () => {
      mockDownloads.search.mockResolvedValue([]);
      
      await manifestManager.initialize();
      
      expect(manifestManager.isInitialized).toBe(true);
      expect(manifestManager.entries).toEqual([]);
      expect(mockDownloads.search).toHaveBeenCalledWith({
        query: ['TrailMix.json'],
        orderBy: ['-startTime'],
        limit: 1
      });
    });

    it('should only initialize once', async () => {
      mockDownloads.search.mockResolvedValue([]);
      
      await manifestManager.initialize();
      await manifestManager.initialize();
      
      expect(mockDownloads.search).toHaveBeenCalledTimes(1);
    });
  });

  describe('readExistingManifest', () => {
    it('should handle no existing manifest gracefully', async () => {
      mockDownloads.search.mockResolvedValue([]);
      
      await manifestManager.readExistingManifest();
      
      expect(manifestManager.entries).toEqual([]);
    });

    it('should handle download with no filename', async () => {
      mockDownloads.search.mockResolvedValue([
        { id: 1 } // No filename
      ]);
      
      await manifestManager.readExistingManifest();
      
      expect(manifestManager.entries).toEqual([]);
    });

    it('should handle file read errors gracefully', async () => {
      mockDownloads.search.mockResolvedValue([
        { id: 1, filename: '/path/to/TrailMix.json' }
      ]);
      
      // Mock fetch to fail
      global.fetch = jest.fn().mockRejectedValue(new Error('File not found'));
      
      await manifestManager.readExistingManifest();
      
      expect(manifestManager.entries).toEqual([]);
    });

    it('should parse existing JSONL content', async () => {
      const existingContent = `{"artist":"Artist 1","item_name":"Album 1","timestamp":"2025-01-01T00:00:00.000Z","filePath":"TrailMix/Artist 1/Album 1/file1.zip"}
{"artist":"Artist 2","item_name":"Album 2","timestamp":"2025-01-02T00:00:00.000Z","filePath":"TrailMix/Artist 2/Album 2/file2.zip"}`;
      
      mockDownloads.search.mockResolvedValue([
        { id: 1, filename: '/path/to/TrailMix.json' }
      ]);
      
      global.fetch = jest.fn().mockResolvedValue({
        text: jest.fn().mockResolvedValue(existingContent)
      });
      
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

    it('should skip invalid JSON lines', async () => {
      const existingContent = `{"artist":"Artist 1","item_name":"Album 1","timestamp":"2025-01-01T00:00:00.000Z","filePath":"TrailMix/Artist 1/Album 1/file1.zip"}
invalid json line
{"artist":"Artist 2","item_name":"Album 2","timestamp":"2025-01-02T00:00:00.000Z","filePath":"TrailMix/Artist 2/Album 2/file2.zip"}`;
      
      mockDownloads.search.mockResolvedValue([
        { id: 1, filename: '/path/to/TrailMix.json' }
      ]);
      
      global.fetch = jest.fn().mockResolvedValue({
        text: jest.fn().mockResolvedValue(existingContent)
      });
      
      await manifestManager.readExistingManifest();
      
      expect(manifestManager.entries).toHaveLength(2);
      expect(manifestManager.entries[0].artist).toBe('Artist 1');
      expect(manifestManager.entries[1].artist).toBe('Artist 2');
    });
  });

  describe('appendEntry', () => {
    beforeEach(async () => {
      mockDownloads.search.mockResolvedValue([]);
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
      mockDownloads.download.mockRejectedValue(new Error('Write failed'));
      
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
  });

  describe('writeManifest', () => {
    beforeEach(() => {
      mockDownloads.download.mockResolvedValue(123);
    });

    it('should generate JSONL content correctly', async () => {
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
      
      // Verify btoa was called for base64 encoding
      expect(global.btoa).toHaveBeenCalled();
      
      // Verify download was called with data URL
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
      
      expect(mockDownloads.download).not.toHaveBeenCalled();
    });

    it('should not throw on download errors', async () => {
      mockDownloads.download.mockRejectedValue(new Error('Download failed'));
      
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

