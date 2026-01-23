/**
 * Application Configuration
 * Centralizes all environment variables and configuration settings
 */

export interface AppConfig {
  // Environment
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;

  // Server
  port: number;
  hostname: string;

  // Database
  databaseUrl: string;
  databaseUrlMasked: string;

  // API
  apiUrl: string;

  // Next.js
  nextTelemetry: boolean;

  // Prisma
  prismaLogLevel: string;
}

/**
 * Masks database URL to hide password
 */
function maskDatabaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.password) {
      urlObj.password = '***';
    }
    return urlObj.toString();
  } catch {
    return '*** (invalid URL format)';
  }
}

/**
 * Loads and validates application configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const config: AppConfig = {
    // Environment
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',

    // Server
    port: parseInt(process.env.PORT || '3000', 10),
    hostname: process.env.HOSTNAME || '0.0.0.0',

    // Database
    databaseUrl: process.env.DATABASE_URL || '',
    databaseUrlMasked: process.env.DATABASE_URL
      ? maskDatabaseUrl(process.env.DATABASE_URL)
      : '(not set)',

    // API
    apiUrl: process.env.NEXT_PUBLIC_API_URL || '',

    // Next.js
    nextTelemetry: process.env.NEXT_TELEMETRY_DISABLED !== '1',

    // Prisma
    prismaLogLevel: process.env.PRISMA_LOG_LEVEL || 'warn',
  };

  return config;
}

/**
 * Validates required configuration and returns validation errors
 */
export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is not set');
  }

  if (!config.apiUrl) {
    errors.push('NEXT_PUBLIC_API_URL is not set');
  }

  if (config.isProduction && config.databaseUrl.includes('placeholder')) {
    errors.push('DATABASE_URL contains placeholder value in production');
  }

  return errors;
}

/**
 * Formats configuration for logging
 */
export function formatConfigForLogging(config: AppConfig): Record<string, unknown> {
  return {
    environment: {
      NODE_ENV: config.nodeEnv,
      isDevelopment: config.isDevelopment,
      isProduction: config.isProduction,
    },
    server: {
      PORT: config.port,
      HOSTNAME: config.hostname,
    },
    database: {
      DATABASE_URL: config.databaseUrlMasked,
      PRISMA_LOG_LEVEL: config.prismaLogLevel,
    },
    api: {
      NEXT_PUBLIC_API_URL: config.apiUrl || '(not set)',
    },
    nextjs: {
      NEXT_TELEMETRY_DISABLED: !config.nextTelemetry,
    },
  };
}

/**
 * Logs application configuration at startup
 */
export function logStartupConfiguration(): AppConfig {
  const config = loadConfig();
  const errors = validateConfig(config);

  console.log('\n' + '='.repeat(80));
  console.log('🚀 SPISA APPLICATION STARTING');
  console.log('='.repeat(80));

  console.log('\n📋 CONFIGURATION:');
  console.log(JSON.stringify(formatConfigForLogging(config), null, 2));

  if (errors.length > 0) {
    console.log('\n⚠️  CONFIGURATION WARNINGS:');
    errors.forEach((error) => console.log(`   - ${error}`));
  } else {
    console.log('\n✅ Configuration validated successfully');
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🏠 Running on: http://${config.hostname}:${config.port}`);
  console.log('='.repeat(80) + '\n');

  return config;
}

// Export singleton instance
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}
