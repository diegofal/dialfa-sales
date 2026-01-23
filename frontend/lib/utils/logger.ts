/**
 * Structured logging utility for SPISA
 *
 * Features:
 * - Environment-aware (suppresses debug/info in production)
 * - Structured format with timestamps
 * - Type-safe metadata
 * - Easy to extend with remote logging (Sentry, DataDog, etc.)
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/utils/logger';
 *
 * logger.debug('Processing request', { userId: 123 });
 * logger.info('User created successfully', { userId: user.id });
 * logger.warn('Rate limit approaching', { current: 95, max: 100 });
 * logger.error('Failed to save data', { error, userId });
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  stack?: string;
}

class Logger {
  /**
   * Check if running in development
   */
  private get isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Check if running in test environment
   */
  private get isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  /**
   * Format log entry for output
   */
  private format(entry: LogEntry): string {
    const parts: string[] = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(JSON.stringify(entry.context));
    }

    if (entry.stack) {
      parts.push(`\n${entry.stack}`);
    }

    return parts.join(' ');
  }

  /**
   * Create log entry with timestamp
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack: error?.stack,
    };
  }

  /**
   * Should log based on environment and level
   */
  private shouldLog(level: LogLevel): boolean {
    // Always suppress logs in test environment
    if (this.isTest) return false;

    // In production, only log warn and error
    if (!this.isDevelopment && (level === 'debug' || level === 'info')) {
      return false;
    }

    return true;
  }

  /**
   * Debug level - detailed information for debugging
   * Suppressed in production
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;

    const entry = this.createEntry('debug', message, context);
    console.debug(this.format(entry));
  }

  /**
   * Info level - general informational messages
   * Suppressed in production
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;

    const entry = this.createEntry('info', message, context);
    console.info(this.format(entry));
  }

  /**
   * Warn level - warning messages that don't prevent operation
   * Logged in all environments
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;

    const entry = this.createEntry('warn', message, context);
    console.warn(this.format(entry));
  }

  /**
   * Error level - error messages that prevent normal operation
   * Logged in all environments
   *
   * Optionally accepts an Error object for stack trace
   */
  error(message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog('error')) return;

    const entry = this.createEntry('error', message, context, error);
    console.error(this.format(entry));

    // In production, send to remote logging service
    if (!this.isDevelopment) {
      this.sendToRemoteLogger(entry);
    }
  }

  /**
   * Send log to remote logging service (Sentry, DataDog, etc.)
   * Override this method to integrate with your logging service
   */
  private sendToRemoteLogger(entry: LogEntry): void {
    // TODO: Integrate with remote logging service
    // Example: Sentry.captureException(entry);
    // For now, this is a no-op placeholder
  }

  /**
   * Log HTTP request
   */
  http(method: string, url: string, status: number, duration?: number, context?: LogContext): void {
    const message = `${method} ${url} ${status}`;
    const fullContext = {
      ...context,
      method,
      url,
      status,
      duration: duration ? `${duration}ms` : undefined,
    };

    if (status >= 500) {
      this.error(message, fullContext);
    } else if (status >= 400) {
      this.warn(message, fullContext);
    } else {
      this.debug(message, fullContext);
    }
  }

  /**
   * Log database query
   */
  query(operation: string, table: string, duration?: number, context?: LogContext): void {
    const message = `DB: ${operation} ${table}`;
    const fullContext = {
      ...context,
      operation,
      table,
      duration: duration ? `${duration}ms` : undefined,
    };

    this.debug(message, fullContext);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for convenience
export type { LogLevel, LogContext };
