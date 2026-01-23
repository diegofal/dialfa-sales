import { logger } from '../logger';

describe('Logger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Spy on console methods
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Save original NODE_ENV
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore spies
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Restore NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  describe('in test environment', () => {
    it('should suppress all logs in test environment', () => {
      process.env.NODE_ENV = 'test';

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('in development environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should log debug messages', () => {
      logger.debug('test debug');

      expect(consoleDebugSpy).toHaveBeenCalled();
      const output = consoleDebugSpy.mock.calls[0][0];
      expect(output).toContain('[DEBUG]');
      expect(output).toContain('test debug');
    });

    it('should log info messages', () => {
      logger.info('test info');

      expect(consoleInfoSpy).toHaveBeenCalled();
      const output = consoleInfoSpy.mock.calls[0][0];
      expect(output).toContain('[INFO]');
      expect(output).toContain('test info');
    });

    it('should log warn messages', () => {
      logger.warn('test warn');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = consoleWarnSpy.mock.calls[0][0];
      expect(output).toContain('[WARN]');
      expect(output).toContain('test warn');
    });

    it('should log error messages', () => {
      logger.error('test error');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('[ERROR]');
      expect(output).toContain('test error');
    });

    it('should include context in log output', () => {
      logger.info('test message', { userId: 123, action: 'create' });

      const output = consoleInfoSpy.mock.calls[0][0];
      expect(output).toContain('test message');
      expect(output).toContain('"userId":123');
      expect(output).toContain('"action":"create"');
    });

    it('should include stack trace for errors', () => {
      const error = new Error('Test error');
      logger.error('test error', {}, error);

      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('[ERROR]');
      expect(output).toContain('test error');
      expect(output).toContain('Error: Test error');
    });

    it('should include timestamp in log output', () => {
      logger.info('test message');

      const output = consoleInfoSpy.mock.calls[0][0];
      // Check for ISO timestamp pattern
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });
  });

  describe('in production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should suppress debug messages in production', () => {
      logger.debug('test debug');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should suppress info messages in production', () => {
      logger.info('test info');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('should log warn messages in production', () => {
      logger.warn('test warn');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = consoleWarnSpy.mock.calls[0][0];
      expect(output).toContain('[WARN]');
      expect(output).toContain('test warn');
    });

    it('should log error messages in production', () => {
      logger.error('test error');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('[ERROR]');
      expect(output).toContain('test error');
    });
  });

  describe('HTTP logging', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should log successful HTTP requests as debug', () => {
      logger.http('GET', '/api/users', 200, 150);

      expect(consoleDebugSpy).toHaveBeenCalled();
      const output = consoleDebugSpy.mock.calls[0][0];
      expect(output).toContain('GET /api/users 200');
      expect(output).toContain('"duration":"150ms"');
    });

    it('should log client errors as warn', () => {
      logger.http('POST', '/api/users', 400);

      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = consoleWarnSpy.mock.calls[0][0];
      expect(output).toContain('POST /api/users 400');
    });

    it('should log server errors as error', () => {
      logger.http('GET', '/api/users', 500);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('GET /api/users 500');
    });
  });

  describe('Query logging', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should log database queries as debug', () => {
      logger.query('SELECT', 'users', 25, { count: 10 });

      expect(consoleDebugSpy).toHaveBeenCalled();
      const output = consoleDebugSpy.mock.calls[0][0];
      expect(output).toContain('DB: SELECT users');
      expect(output).toContain('"duration":"25ms"');
      expect(output).toContain('"count":10');
    });
  });
});
