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
      
      global.document.createElement.mockReturnValue(mockDiv);
      
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
      // Simulate browser environment
      delete global.module;
      global.window = {};
      
      // Re-require the module
      delete require.cache[require.resolve('../../lib/utils.js')];
      require('../../lib/utils.js');
      
      expect(global.window.TrailMixUtils).toBeDefined();
      expect(global.window.TrailMixUtils.Logger).toBeDefined();
      expect(global.window.TrailMixUtils.StringUtils).toBeDefined();
    });
  });
});

