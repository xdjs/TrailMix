/**
 * Tests for downloads.onDeterminingFilename listener
 */

const chromeMock = require('../mocks/chrome-mock');

describe('Downloads filename listener', () => {
  beforeAll(() => {
    // Set up mocks once before all tests
    global.chrome = chromeMock;

    // Mock TrailMixUtils (imported via importScripts in service-worker.js)
    const { StringUtils } = require('../../lib/utils.js');
    global.TrailMixUtils = {
      StringUtils
    };

    // Mock importScripts and required classes
    global.importScripts = jest.fn();
    global.DownloadManager = jest.fn();

    // Create a proper DownloadQueue constructor that returns an object with the required methods
    global.DownloadQueue = class {
      constructor() {
        this.add = jest.fn();
        this.remove = jest.fn();
        this.getNext = jest.fn();
        this.size = jest.fn().mockReturnValue(0);
        this.clear = jest.fn();
        this.toJSON = jest.fn().mockReturnValue({ items: [] });
        this.pause = jest.fn();
        this.resume = jest.fn();
        this.isPaused = false;
        this.addEventListener = jest.fn();
        this.removeEventListener = jest.fn();
        this.deserialize = jest.fn();
        this.isEmpty = jest.fn().mockReturnValue(true);
        this.getStats = jest.fn().mockReturnValue({ total: 0 });
      }
    };

    global.DownloadJob = jest.fn();

    // Mock downloadMetadata Map
    global.downloadMetadata = new Map();

    // Mock broadcastLogMessage function
    global.broadcastLogMessage = jest.fn();

    // Clear cached service worker module and reload
    delete require.cache[require.resolve('../../background/service-worker.js')];

    // Load service worker once to register listener
    try {
      require('../../background/service-worker.js');
    } catch (e) {
      console.error('Failed to load service worker:', e);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear download metadata between tests
    global.downloadMetadata.clear();
  });

  function getListener() {
    const calls = chrome.downloads.onDeterminingFilename.addListener.mock.calls;
    return calls.length ? calls[0][0] : null;
  }

  test('prefixes bcbits downloads with TrailMix/', () => {
    const listener = getListener();
    // Debug: log the mock calls
    if (!listener) {
      console.log('onDeterminingFilename.addListener calls:', chrome.downloads.onDeterminingFilename.addListener.mock.calls.length);
      console.log('onChanged.addListener calls:', chrome.downloads.onChanged.addListener.mock.calls.length);
    }
    expect(listener).toBeTruthy();
    const suggest = jest.fn();

    listener({
      url: 'https://p4.bcbits.com/download/somefile.mp3',
      filename: 'somefile.mp3'
    }, suggest);

    expect(suggest).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'TrailMix/somefile.mp3'
    }));
  });

  test('does not affect non-bcbits downloads', () => {
    const listener = getListener();
    const suggest = jest.fn();

    listener({
      url: 'https://example.com/file.mp3',
      filename: 'file.mp3'
    }, suggest);

    expect(suggest).not.toHaveBeenCalled();
  });

  test('prevents path traversal and sanitizes segments', () => {
    const listener = getListener();
    const suggest = jest.fn();

    listener({
      url: 'https://p4.bcbits.com/download/track.mp3',
      filename: '/evil/../../trac<>k.mp3'
    }, suggest);

    expect(suggest).toHaveBeenCalled();
    const arg = suggest.mock.calls[0][0];
    expect(arg.filename.startsWith('TrailMix/')).toBe(true);
    expect(arg.filename.includes('..')).toBe(false);
    expect(arg.filename.includes('<')).toBe(false);
    expect(arg.filename.includes('>')).toBe(false);
  });

  test('avoids double prefix when already under TrailMix/', () => {
    const listener = getListener();
    const suggest = jest.fn();

    listener({
      url: 'https://p4.bcbits.com/download/track.mp3',
      filename: 'TrailMix/already.mp3'
    }, suggest);

    expect(suggest).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'TrailMix/already.mp3'
    }));
  });

  test('uses metadata-based folder structure when provided', () => {
    const listener = getListener();
    const suggest = jest.fn();
    const url = 'https://p4.bcbits.com/download/album.zip';

    // Simulate download manager providing metadata
    global.downloadMetadata.set(url, {
      artist: 'Pink Floyd',
      title: 'The Dark Side of the Moon'
    });

    listener({
      url: url,
      filename: 'album.zip'
    }, suggest);

    expect(suggest).toHaveBeenCalled();
    const arg = suggest.mock.calls[0][0];
    expect(arg.filename).toBe('TrailMix/Pink Floyd/The Dark Side of the Moon/album.zip');
  });

  test('creates proper folder structure for artist and album', () => {
    const listener = getListener();
    const suggest = jest.fn();
    const url = 'https://p4.bcbits.com/download/track123.mp3';

    // Provide metadata for download
    global.downloadMetadata.set(url, {
      artist: 'Artist Name',
      title: 'Album Title'
    });

    listener({
      url: url,
      filename: 'track123.mp3'
    }, suggest);

    expect(suggest).toHaveBeenCalled();
    const arg = suggest.mock.calls[0][0];
    expect(arg.filename).toBe('TrailMix/Artist Name/Album Title/track123.mp3');
  });

  test('sanitizes invalid characters in artist and album names', () => {
    const listener = getListener();
    const suggest = jest.fn();
    const url = 'https://p4.bcbits.com/download/track.mp3';

    // Provide metadata with invalid filename characters
    global.downloadMetadata.set(url, {
      artist: 'AC/DC',
      title: 'Album: Title'
    });

    listener({
      url: url,
      filename: 'track.mp3'
    }, suggest);

    expect(suggest).toHaveBeenCalled();
    const arg = suggest.mock.calls[0][0];
    // Slashes and colons should be replaced with underscores
    expect(arg.filename).toBe('TrailMix/AC_DC/Album_ Title/track.mp3');
  });
});

