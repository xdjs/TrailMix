/**
 * Tests for downloads.onDeterminingFilename listener
 */

const chromeMock = require('../mocks/chrome-mock');

describe('Downloads filename listener', () => {
  beforeAll(() => {
    // Set up mocks once before all tests
    global.chrome = chromeMock;

    // Mock importScripts and required classes
    global.importScripts = jest.fn();
    global.DownloadManager = jest.fn();
    global.DownloadQueue = jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      remove: jest.fn(),
      getNext: jest.fn(),
      size: jest.fn().mockReturnValue(0),
      clear: jest.fn(),
      toJSON: jest.fn().mockReturnValue({ items: [] }),
      pause: jest.fn(),
      resume: jest.fn(),
      isPaused: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }));
    global.DownloadJob = jest.fn();

    // Load service worker once to register listener
    require('../../background/service-worker.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function getListener() {
    const calls = chrome.downloads.onDeterminingFilename.addListener.mock.calls;
    return calls.length ? calls[0][0] : null;
  }

  test('prefixes bcbits downloads with TrailMix/', () => {
    const listener = getListener();
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

    // Simulate download manager providing artist/album structure
    listener({
      url: 'https://p4.bcbits.com/download/album.zip',
      filename: 'TrailMix/Pink Floyd/The Dark Side of the Moon/'
    }, suggest);

    expect(suggest).toHaveBeenCalled();
    const arg = suggest.mock.calls[0][0];
    expect(arg.filename).toMatch(/^TrailMix\/Pink Floyd\/The Dark Side of the Moon\/.+/);
  });

  test('creates proper folder structure for artist and album', () => {
    const listener = getListener();
    const suggest = jest.fn();

    // When metadata path is provided with trailing slash
    listener({
      url: 'https://p4.bcbits.com/download/track123.mp3',
      filename: 'TrailMix/Artist Name/Album Title/'
    }, suggest);

    expect(suggest).toHaveBeenCalled();
    const arg = suggest.mock.calls[0][0];
    // Should append the filename from URL
    expect(arg.filename).toBe('TrailMix/Artist Name/Album Title/track123.mp3');
  });
});

