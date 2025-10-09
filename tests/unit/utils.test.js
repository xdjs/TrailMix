/**
 * Unit tests for utility functions
 * Tests Task 1.6: Create Core Library Modules
 */

// Import utilities
const {
  Logger,
  ErrorHandler,
  StringUtils,
  PathUtils,
  AsyncUtils,
  ValidationUtils
} = require('../../lib/utils.js');

describe('Utility Functions', () => {
  
  describe('Logger', () => {
    let originalConsole;
    
    beforeEach(() => {
      originalConsole = global.console;
      global.console = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
    });
    
    afterEach(() => {
      global.console = originalConsole;
    });
    
    test('should log at appropriate levels', () => {
      Logger.currentLevel = Logger.levels.DEBUG;
      
      Logger.error('Error message');
      Logger.warn('Warning message');
      Logger.info('Info message');
      Logger.debug('Debug message');
      
      expect(console.log).toHaveBeenCalledTimes(4);
    });
    
    test('should respect log level filtering', () => {
      Logger.currentLevel = Logger.levels.WARN;
      
      Logger.error('Error message');
      Logger.warn('Warning message');
      Logger.info('Info message');
      Logger.debug('Debug message');
      
      expect(console.log).toHaveBeenCalledTimes(2); // Only error and warn
    });
    
    test('should include timestamp and level in log output', () => {
      Logger.error('Test error');
      
      const logCall = console.log.mock.calls[0][0];
      expect(logCall).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      expect(logCall).toContain('[ERROR]');
      expect(logCall).toContain('Test error');
    });
    
    test('should handle additional arguments', () => {
      const obj = { test: 'data' };
      Logger.info('Message with data', obj, 'extra');
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Message with data'),
        obj,
        'extra'
      );
    });
  });
  
  describe('ErrorHandler', () => {
    test('should create standardized error objects', () => {
      const error = ErrorHandler.createError('TestError', 'Test message', { detail: 'test' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe('TestError');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
    
    test('should handle errors consistently', () => {
      const error = new Error('Test error');
      error.type = 'TestType';
      
      const result = ErrorHandler.handleError(error, 'TestContext');
      
      expect(result.success).toBe(false);
      expect(result.error.type).toBe('TestType');
      expect(result.error.message).toBe('Test error');
      expect(result.error.context).toBe('TestContext');
    });
    
    test('should wrap async functions with error handling', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const errorFn = jest.fn().mockRejectedValue(new Error('async error'));
      
      const successResult = await ErrorHandler.wrapAsync(successFn, 'SuccessContext');
      const errorResult = await ErrorHandler.wrapAsync(errorFn, 'ErrorContext');
      
      expect(successResult).toBe('success');
      expect(errorResult.success).toBe(false);
      expect(errorResult.error.message).toBe('async error');
    });
  });
  
  describe('StringUtils', () => {
    test('should sanitize filenames correctly', () => {
      const testCases = [
        { input: 'normal filename.mp3', expected: 'normal filename.mp3' },
        { input: 'file<with>invalid:chars', expected: 'file_with_invalid_chars' },
        { input: 'file/with\\slashes', expected: 'file_with_slashes' },
        { input: '  spaced  file  ', expected: 'spaced file' },
        { input: '...dotted', expected: 'dotted' },
        { input: '', expected: 'untitled' },
        { input: '   ', expected: 'untitled' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(StringUtils.sanitizeFilename(input)).toBe(expected);
      });
    });

    test('should handle control characters', () => {
      expect(StringUtils.sanitizeFilename('file\x00name')).toBe('file_name');
      expect(StringUtils.sanitizeFilename('file\x01\x02\x03name')).toBe('file___name');
      expect(StringUtils.sanitizeFilename('file\nnew\rline\ttab')).toBe('file_new_line_tab');
    });

    test('should handle Windows reserved names', () => {
      expect(StringUtils.sanitizeFilename('CON')).toBe('_CON');
      expect(StringUtils.sanitizeFilename('con')).toBe('_con');
      expect(StringUtils.sanitizeFilename('PRN.txt')).toBe('_PRN.txt');
      expect(StringUtils.sanitizeFilename('AUX')).toBe('_AUX');
      expect(StringUtils.sanitizeFilename('NUL')).toBe('_NUL');
      expect(StringUtils.sanitizeFilename('COM1')).toBe('_COM1');
      expect(StringUtils.sanitizeFilename('COM9')).toBe('_COM9');
      expect(StringUtils.sanitizeFilename('LPT1')).toBe('_LPT1');
      expect(StringUtils.sanitizeFilename('LPT9')).toBe('_LPT9');
      // Non-reserved names should pass through
      expect(StringUtils.sanitizeFilename('CON2')).toBe('CON2');
      expect(StringUtils.sanitizeFilename('ACON')).toBe('ACON');
    });

    test('should strip trailing dots, spaces, and tildes', () => {
      expect(StringUtils.sanitizeFilename('filename.')).toBe('filename');
      expect(StringUtils.sanitizeFilename('filename..')).toBe('filename');
      expect(StringUtils.sanitizeFilename('filename ')).toBe('filename');
      expect(StringUtils.sanitizeFilename('filename  ')).toBe('filename');
      expect(StringUtils.sanitizeFilename('filename. ')).toBe('filename');
      expect(StringUtils.sanitizeFilename('filename . .')).toBe('filename');
      // Trailing tildes (Chrome compatibility)
      expect(StringUtils.sanitizeFilename('filename~')).toBe('filename');
      expect(StringUtils.sanitizeFilename('filename~~')).toBe('filename');
      expect(StringUtils.sanitizeFilename('filename ~')).toBe('filename');
      expect(StringUtils.sanitizeFilename('filename~ ')).toBe('filename');
      // Real-world case: Japanese album title with trailing tilde
      expect(StringUtils.sanitizeFilename('夢の続き ~ Dreams Of Light ~')).toBe('夢の続き ~ Dreams Of Light');
      // Tildes in the middle should be preserved
      expect(StringUtils.sanitizeFilename('Track~1')).toBe('Track~1');
      expect(StringUtils.sanitizeFilename('Album ~ Title')).toBe('Album ~ Title');
    });

    test('should enforce maximum length', () => {
      const longName = 'a'.repeat(300);
      expect(StringUtils.sanitizeFilename(longName, 200)).toHaveLength(200);
      expect(StringUtils.sanitizeFilename(longName, 50)).toHaveLength(50);
    });

    test('should handle edge cases', () => {
      expect(StringUtils.sanitizeFilename(null)).toBe('untitled');
      expect(StringUtils.sanitizeFilename(undefined)).toBe('untitled');
      expect(StringUtils.sanitizeFilename(123)).toBe('untitled');
      expect(StringUtils.sanitizeFilename('.')).toBe('untitled');
      expect(StringUtils.sanitizeFilename('..')).toBe('untitled');
      expect(StringUtils.sanitizeFilename('...')).toBe('untitled');
    });

    test('should sanitize paths while preserving structure', () => {
      expect(StringUtils.sanitizePath('Artist/Album/Track')).toBe('Artist/Album/Track');
      // Note: "AC/DC" becomes "AC/DC" because "/" is a path separator, not part of the name
      // For artist names with slashes, the slash should be in the original metadata string
      expect(StringUtils.sanitizePath('AC-DC/Album')).toBe('AC-DC/Album');
      expect(StringUtils.sanitizePath('Artist:Name/Album:Title/Track')).toBe('Artist_Name/Album_Title/Track');
      expect(StringUtils.sanitizePath('Artist/.../Album')).toBe('Artist/Album');
      expect(StringUtils.sanitizePath('CON/PRN/file')).toBe('_CON/_PRN/file');
      expect(StringUtils.sanitizePath('')).toBe('');
      expect(StringUtils.sanitizePath(null)).toBe('');
      // Test that invalid chars in path components are sanitized
      expect(StringUtils.sanitizePath('Artist<>/Album*/Track?')).toBe('Artist__/Album_/Track_');
    });

    test('should remove zero-width characters', () => {
      // Zero-width space (U+200B)
      expect(StringUtils.sanitizeFilename('file\u200Bname')).toBe('filename');
      // Zero-width non-joiner (U+200C)
      expect(StringUtils.sanitizeFilename('file\u200Cname')).toBe('filename');
      // Zero-width joiner (U+200D)
      expect(StringUtils.sanitizeFilename('file\u200Dname')).toBe('filename');
      // BOM / Zero-width no-break space (U+FEFF)
      expect(StringUtils.sanitizeFilename('\uFEFFfilename')).toBe('filename');
      // Word joiner (U+2060)
      expect(StringUtils.sanitizeFilename('file\u2060name')).toBe('filename');
      // Real-world example from logs: (​(​( 1 )​)​) contains U+200B
      expect(StringUtils.sanitizeFilename('(\u200B(\u200B( 1 )\u200B)\u200B)')).toBe('((( 1 )))');
    });

    test('should preserve valid Unicode characters', () => {
      // Japanese
      expect(StringUtils.sanitizeFilename('夢の続き')).toBe('夢の続き');
      // With tilde in the middle (common in album names)
      expect(StringUtils.sanitizeFilename('夢の続き ~ Dreams Of Light')).toBe('夢の続き ~ Dreams Of Light');
      // Cyrillic
      expect(StringUtils.sanitizeFilename('Привет')).toBe('Привет');
      // Arabic
      expect(StringUtils.sanitizeFilename('مرحبا')).toBe('مرحبا');
      // Emoji
      expect(StringUtils.sanitizeFilename('Song 🎵 Title')).toBe('Song 🎵 Title');
      // Accented characters
      expect(StringUtils.sanitizeFilename('Café Münchën')).toBe('Café Münchën');
    });

    test('should normalize Unicode to NFC form', () => {
      // é can be represented as single char (U+00E9) or e + combining acute (U+0065 U+0301)
      const nfc = 'café'; // NFC form (composed)
      const nfd = 'café'; // NFD form (decomposed) - e\u0301
      // Both should normalize to the same string
      const result1 = StringUtils.sanitizeFilename(nfc);
      const result2 = StringUtils.sanitizeFilename(nfd);
      expect(result1).toBe(result2);
      expect(result1).toBe('café');
    });
    
    test('should clean text from DOM', () => {
      const testCases = [
        { input: 'normal text', expected: 'normal text' },
        { input: '  multiple   spaces  ', expected: 'multiple spaces' },
        { input: 'text\nwith\r\nbreaks\t', expected: 'text with breaks' },
        { input: '\t\r\n  ', expected: '' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        expect(StringUtils.cleanText(input)).toBe(expected);
      });
    });
    
    test('should truncate strings correctly', () => {
      expect(StringUtils.truncate('short', 10)).toBe('short');
      expect(StringUtils.truncate('this is a long string', 10)).toBe('this is...');
      expect(StringUtils.truncate('exactly ten', 10)).toBe('exactly...');
      expect(StringUtils.truncate('long string', 15, '…')).toBe('long string');
    });
    
    test('should escape HTML correctly', () => {
      // Mock DOM environment for HTML escaping
      global.document = {
        createElement: jest.fn(() => ({
          textContent: '',
          innerHTML: ''
        }))
      };
      
      const mockDiv = {
        textContent: '',
        innerHTML: ''
      };
      
      Object.defineProperty(mockDiv, 'textContent', {
        set: function(value) { this.innerHTML = value.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
      });
      
      global.document.createElement = jest.fn().mockReturnValue(mockDiv);
      
      const result = StringUtils.escapeHtml('<script>alert("xss")</script>');
      expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });
  });
  
  describe('PathUtils', () => {
    test('should join path components correctly', () => {
      expect(PathUtils.join('a', 'b', 'c')).toBe('a/b/c');
      expect(PathUtils.join('/a/', '/b/', '/c/')).toBe('a/b/c');
      expect(PathUtils.join('', 'b', '', 'c')).toBe('b/c');
      expect(PathUtils.join()).toBe('');
    });
    
    test('should get file extensions correctly', () => {
      expect(PathUtils.getExtension('file.mp3')).toBe('mp3');
      expect(PathUtils.getExtension('file.name.jpg')).toBe('jpg');
      expect(PathUtils.getExtension('noextension')).toBe('');
      expect(PathUtils.getExtension('.hidden')).toBe('');
      expect(PathUtils.getExtension('file.')).toBe('');
    });
    
    test('should get basenames correctly', () => {
      expect(PathUtils.getBasename('file.mp3')).toBe('file');
      expect(PathUtils.getBasename('file.name.jpg')).toBe('file.name');
      expect(PathUtils.getBasename('noextension')).toBe('noextension');
      expect(PathUtils.getBasename('.hidden')).toBe('.hidden');
    });
    
    test('should create safe file paths', () => {
      const path = PathUtils.createSafeFilePath('Artist Name', 'Album Title', 1, 'Track Name');
      expect(path).toBe('Artist Name/Album Title/01 - Track Name.mp3');
      
      const pathWithSpecialChars = PathUtils.createSafeFilePath('Art<ist', 'Al>bum', 12, 'Tr/ack');
      expect(pathWithSpecialChars).toBe('Art_ist/Al_bum/12 - Tr_ack.mp3');
    });
    
    test('should handle duplicate filenames', () => {
      expect(PathUtils.handleDuplicate('file.mp3', 1)).toBe('file (1).mp3');
      expect(PathUtils.handleDuplicate('file.mp3', 5)).toBe('file (5).mp3');
      expect(PathUtils.handleDuplicate('noextension', 2)).toBe('noextension (2)');
    });
  });
  
  describe('AsyncUtils', () => {
    test('should implement sleep function', async () => {
      const start = Date.now();
      await AsyncUtils.sleep(50);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow for some timing variance
    });
    
    test('should retry functions with exponential backoff', async () => {
      let attempts = 0;
      const failingFunction = jest.fn(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return 'success';
      });
      
      const result = await AsyncUtils.retry(failingFunction, 3, 10);
      
      expect(result).toBe('success');
      expect(failingFunction).toHaveBeenCalledTimes(3);
    });
    
    test('should throw error after max attempts', async () => {
      const alwaysFailingFunction = jest.fn(() => {
        throw new Error('Always fails');
      });
      
      await expect(AsyncUtils.retry(alwaysFailingFunction, 2, 10))
        .rejects.toThrow('Always fails');
      
      expect(alwaysFailingFunction).toHaveBeenCalledTimes(2);
    });
    
    test('should run tasks with concurrency limit', async () => {
      let running = 0;
      let maxConcurrent = 0;
      
      const createTask = (delay) => async () => {
        running++;
        maxConcurrent = Math.max(maxConcurrent, running);
        await AsyncUtils.sleep(delay);
        running--;
        return delay;
      };
      
      const tasks = [
        createTask(50),
        createTask(30),
        createTask(40),
        createTask(20),
        createTask(60)
      ];
      
      const results = await AsyncUtils.runWithConcurrency(tasks, 2);
      
      expect(results).toEqual([50, 30, 40, 20, 60]);
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });
  
  describe('ValidationUtils', () => {
    test('should validate URLs correctly', () => {
      expect(ValidationUtils.isValidUrl('https://example.com')).toBe(true);
      expect(ValidationUtils.isValidUrl('http://test.org/path')).toBe(true);
      expect(ValidationUtils.isValidUrl('ftp://files.example.com')).toBe(true);
      expect(ValidationUtils.isValidUrl('not-a-url')).toBe(false);
      expect(ValidationUtils.isValidUrl('')).toBe(false);
      expect(ValidationUtils.isValidUrl('just-text')).toBe(false);
    });
    
    test('should validate emails correctly', () => {
      expect(ValidationUtils.isValidEmail('test@example.com')).toBe(true);
      expect(ValidationUtils.isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(ValidationUtils.isValidEmail('invalid-email')).toBe(false);
      expect(ValidationUtils.isValidEmail('missing@domain')).toBe(false);
      expect(ValidationUtils.isValidEmail('@domain.com')).toBe(false);
      expect(ValidationUtils.isValidEmail('')).toBe(false);
    });
    
    test('should check for empty strings', () => {
      expect(ValidationUtils.isEmpty('')).toBe(true);
      expect(ValidationUtils.isEmpty('   ')).toBe(true);
      expect(ValidationUtils.isEmpty('\t\n')).toBe(true);
      expect(ValidationUtils.isEmpty('text')).toBe(false);
      expect(ValidationUtils.isEmpty('  text  ')).toBe(false);
      expect(ValidationUtils.isEmpty(null)).toBe(true);
      expect(ValidationUtils.isEmpty(undefined)).toBe(true);
    });
    
    test('should validate track numbers', () => {
      expect(ValidationUtils.isValidTrackNumber(1)).toBe(true);
      expect(ValidationUtils.isValidTrackNumber('5')).toBe(true);
      expect(ValidationUtils.isValidTrackNumber('99')).toBe(true);
      expect(ValidationUtils.isValidTrackNumber(999)).toBe(true);
      expect(ValidationUtils.isValidTrackNumber(0)).toBe(false);
      expect(ValidationUtils.isValidTrackNumber(-1)).toBe(false);
      expect(ValidationUtils.isValidTrackNumber(1000)).toBe(false);
      expect(ValidationUtils.isValidTrackNumber('abc')).toBe(false);
      expect(ValidationUtils.isValidTrackNumber('')).toBe(false);
    });
  });
  
  describe('Module Export', () => {
    test('should export utilities in browser environment', () => {
      // Simulate browser environment by temporarily hiding module
      const originalModule = global.module;
      global.module = undefined;
      global.window = {};

      // Re-require the module
      delete require.cache[require.resolve('../../lib/utils.js')];
      require('../../lib/utils.js');

      expect(global.window.TrailMixUtils).toBeDefined();
      expect(global.window.TrailMixUtils.Logger).toBeDefined();
      expect(global.window.TrailMixUtils.StringUtils).toBeDefined();

      // Restore module
      global.module = originalModule;
    });
  });
});

