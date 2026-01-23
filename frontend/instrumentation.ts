/**
 * Next.js Instrumentation
 * This file runs once when the Next.js server starts
 * Perfect for logging configuration and initialization
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Log configuration when server starts
    console.log('\n' + '='.repeat(80));
    console.log('🚀 NEXT.JS SERVER STARTING');
    console.log('='.repeat(80));

    console.log('\n📋 ENVIRONMENT CONFIGURATION:');

    // Environment
    console.log('\n🌍 Environment:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  NEXT_RUNTIME: ${process.env.NEXT_RUNTIME || 'unknown'}`);

    // Server Configuration
    console.log('\n🖥️  Server:');
    console.log(`  PORT: ${process.env.PORT || '3000'}`);
    console.log(`  HOSTNAME: ${process.env.HOSTNAME || '0.0.0.0'}`);

    // Database
    console.log('\n🗄️  Database:');
    if (process.env.DATABASE_URL) {
      console.log(`  DATABASE_URL: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
    } else {
      console.log('  DATABASE_URL: ⚠️  NOT SET');
    }

    // API Configuration
    console.log('\n🔌 API:');
    if (process.env.NEXT_PUBLIC_API_URL) {
      console.log(`  NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL}`);
    } else {
      console.log('  NEXT_PUBLIC_API_URL: ⚠️  NOT SET');
    }

    // Next.js Configuration
    console.log('\n⚙️  Next.js:');
    console.log(
      `  NEXT_TELEMETRY_DISABLED: ${process.env.NEXT_TELEMETRY_DISABLED === '1' ? 'Yes' : 'No'}`
    );

    // JWT (if needed for middleware)
    console.log('\n🔐 Authentication:');
    if (process.env.JWT_SECRET) {
      console.log(`  JWT_SECRET: ${'*'.repeat(20)} (${process.env.JWT_SECRET.length} chars)`);
    } else {
      console.log('  JWT_SECRET: ⚠️  NOT SET');
    }

    // Validation
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required');
    } else if (process.env.DATABASE_URL.includes('placeholder')) {
      errors.push('DATABASE_URL contains placeholder value');
    }

    if (!process.env.NEXT_PUBLIC_API_URL) {
      warnings.push('NEXT_PUBLIC_API_URL is not set');
    }

    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      errors.push('JWT_SECRET is required in production');
    }

    // Display validation results
    if (errors.length > 0) {
      console.log('\n❌ CONFIGURATION ERRORS:');
      errors.forEach((error) => console.log(`   - ${error}`));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  CONFIGURATION WARNINGS:');
      warnings.forEach((warning) => console.log(`   - ${warning}`));
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log('\n✅ Configuration validated successfully');
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(
      `🏠 Server URL: http://${process.env.HOSTNAME || '0.0.0.0'}:${process.env.PORT || '3000'}`
    );
    console.log('='.repeat(80) + '\n');

    // Critical errors should prevent startup
    if (errors.length > 0 && process.env.NODE_ENV === 'production') {
      console.error('\n💥 CRITICAL: Cannot start server with configuration errors in production\n');
      // In production, we might want to throw an error here
      // throw new Error('Invalid configuration');
    }
  }
}

/**
 * Masks database URL password
 */
function maskDatabaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const username = urlObj.username || 'unknown';
    const hostname = urlObj.hostname || 'unknown';
    const port = urlObj.port || '5432';
    const pathname = urlObj.pathname || '/db';

    return `postgresql://${username}:***@${hostname}:${port}${pathname}`;
  } catch {
    return '*** (invalid URL format)';
  }
}
