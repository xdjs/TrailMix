/**
 * Tests for downloads.onDeterminingFilename listener
 */

const chromeMock = require('../mocks/chrome-mock');

describe('Downloads filename listener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome = chromeMock;
    // Load service worker fresh to register listener
    delete require.cache[require.resolve('../../background/service-worker.js')];
    require('../../background/service-worker.js');
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
});

