/**
 * Unit tests for the logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupCollapsedSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleGroupCollapsedSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debug', () => {
    it('logs debug messages in development', () => {
      logger.debug('test message');
      // In test environment (DEV=true), should call console.log
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('includes DEBUG level in message', () => {
      logger.debug('test');
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toContain('[DEBUG]');
    });

    it('accepts multiple arguments', () => {
      logger.debug('message', { key: 'value' }, 123);
      expect(consoleLogSpy).toHaveBeenCalled();
      const args = consoleLogSpy.mock.calls[0];
      expect(args).toContain('message');
      expect(args).toContainEqual({ key: 'value' });
      expect(args).toContain(123);
    });
  });

  describe('info', () => {
    it('logs info messages', () => {
      logger.info('info message');
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('includes INFO level in message', () => {
      logger.info('test');
      const call = consoleInfoSpy.mock.calls[0];
      expect(call[0]).toContain('[INFO]');
    });
  });

  describe('warn', () => {
    it('logs warning messages', () => {
      logger.warn('warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('includes WARN level in message', () => {
      logger.warn('test');
      const call = consoleWarnSpy.mock.calls[0];
      expect(call[0]).toContain('[WARN]');
    });

    it('accepts multiple arguments', () => {
      logger.warn('warning', 'details');
      expect(consoleWarnSpy).toHaveBeenCalled();
      const args = consoleWarnSpy.mock.calls[0];
      expect(args).toContain('warning');
      expect(args).toContain('details');
    });
  });

  describe('error', () => {
    it('logs error messages', () => {
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('includes ERROR level in message', () => {
      logger.error('test');
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[0]).toContain('[ERROR]');
    });

    it('accepts Error objects', () => {
      const error = new Error('test error');
      logger.error('An error occurred:', error);
      expect(consoleErrorSpy).toHaveBeenCalled();
      const args = consoleErrorSpy.mock.calls[0];
      expect(args).toContainEqual(error);
    });
  });

  describe('scope', () => {
    it('creates a scoped logger', () => {
      const scopedLog = logger.scope('TestContext');
      expect(scopedLog).toHaveProperty('debug');
      expect(scopedLog).toHaveProperty('info');
      expect(scopedLog).toHaveProperty('warn');
      expect(scopedLog).toHaveProperty('error');
    });

    it('includes context in debug messages', () => {
      const scopedLog = logger.scope('MyModule');
      scopedLog.debug('test message');
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toContain('[MyModule]');
    });

    it('includes context in info messages', () => {
      const scopedLog = logger.scope('MyModule');
      scopedLog.info('test');
      const call = consoleInfoSpy.mock.calls[0];
      expect(call[0]).toContain('[MyModule]');
    });

    it('includes context in warn messages', () => {
      const scopedLog = logger.scope('MyModule');
      scopedLog.warn('test');
      const call = consoleWarnSpy.mock.calls[0];
      expect(call[0]).toContain('[MyModule]');
    });

    it('includes context in error messages', () => {
      const scopedLog = logger.scope('MyModule');
      scopedLog.error('test');
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[0]).toContain('[MyModule]');
    });

    it('can create multiple scoped loggers', () => {
      const log1 = logger.scope('Module1');
      const log2 = logger.scope('Module2');

      log1.debug('from module 1');
      log2.debug('from module 2');

      expect(consoleLogSpy.mock.calls[0][0]).toContain('[Module1]');
      expect(consoleLogSpy.mock.calls[1][0]).toContain('[Module2]');
    });
  });

  describe('time', () => {
    it('returns a function', () => {
      const end = logger.time('operation');
      expect(typeof end).toBe('function');
    });

    it('logs timing on end call', () => {
      const end = logger.time('operation');
      // Simulate some time passing (not reliable in tests, so just call it)
      end();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('includes PERF context and label', () => {
      const end = logger.time('fetchData');
      end();
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toContain('[PERF]');
      expect(call[1]).toContain('fetchData');
    });

    it('includes milliseconds in output', () => {
      const end = logger.time('testOp');
      end();
      const call = consoleLogSpy.mock.calls[0];
      expect(call[1]).toMatch(/took \d+ms/);
    });
  });

  describe('group', () => {
    it('creates a console group', () => {
      logger.group('Group Label', () => {
        logger.debug('inside group');
      });

      expect(consoleGroupSpy).toHaveBeenCalledWith('Group Label');
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('executes the callback', () => {
      const callback = vi.fn();
      logger.group('Test', callback);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('groupCollapsed', () => {
    it('creates a collapsed console group', () => {
      logger.groupCollapsed('Collapsed Label', () => {
        logger.debug('inside collapsed');
      });

      expect(consoleGroupCollapsedSpy).toHaveBeenCalledWith('Collapsed Label');
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('executes the callback', () => {
      const callback = vi.fn();
      logger.groupCollapsed('Test', callback);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('timestamp format', () => {
    it('includes timestamp in debug messages', () => {
      logger.debug('test');
      const call = consoleLogSpy.mock.calls[0];
      // Timestamp format should match HH:MM:SS.mmm
      expect(call[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/);
    });
  });
});
