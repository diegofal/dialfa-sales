#!/usr/bin/env node
/**
 * Server startup wrapper
 * Logs configuration before starting the Next.js server
 */

// Import configuration logging (will be executed immediately)
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration logging function (inline to avoid build issues)
function logConfig() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 SPISA APPLICATION STARTING');
  console.log('='.repeat(80));

  console.log('\n📋 CONFIGURATION:');
  console.log(JSON.stringify({
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      isDevelopment: process.env.NODE_ENV !== 'production',
      isProduction: process.env.NODE_ENV === 'production',
    },
    server: {
      PORT: process.env.PORT || '3000',
      HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
    },
    database: {
      DATABASE_URL: process.env.DATABASE_URL
        ? maskDatabaseUrl(process.env.DATABASE_URL)
        : '(not set)',
    },
    api: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '(not set)',
    },
    nextjs: {
      NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED === '1',
    },
  }, null, 2));

  // Validation
  const errors = [];
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is not set');
  }
  if (!process.env.NEXT_PUBLIC_API_URL) {
    errors.push('NEXT_PUBLIC_API_URL is not set');
  }

  if (errors.length > 0) {
    console.log('\n⚠️  CONFIGURATION WARNINGS:');
    errors.forEach(error => console.log(`   - ${error}`));
  } else {
    console.log('\n✅ Configuration validated successfully');
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🏠 Running on: http://${process.env.HOSTNAME || '0.0.0.0'}:${process.env.PORT || '3000'}`);
  console.log('='.repeat(80) + '\n');
}

function maskDatabaseUrl(url) {
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

function runMigrations() {
  try {
    console.log('🔄 Checking database schema...');
    // Only run if DATABASE_URL is present
    if (process.env.DATABASE_URL) {
      // Use migrate deploy in production, db push in development
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction) {
        // Use local prisma binary to avoid downloading Prisma 7.x
        console.log('Running: node node_modules/.bin/prisma migrate deploy');
        execSync('node node_modules/.bin/prisma migrate deploy', { stdio: 'inherit' });
        console.log('✅ Database migrations deployed successfully');
      } else {
        console.log('Running: node node_modules/.bin/prisma db push --skip-generate');
        execSync('node node_modules/.bin/prisma db push --skip-generate', { stdio: 'inherit' });
        console.log('✅ Database schema synced successfully');
      }
    } else {
      console.log('⚠️ Skipping migrations: DATABASE_URL not set');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('   Full error:', error);
    // We don't exit here to allow the server to try starting anyway, 
    // though it might fail if DB is out of sync.
  }
}

// Log configuration
logConfig();

// Run migrations
runMigrations();

// Start the Next.js server
console.log('🔄 Loading Next.js server...\n');
require('./server.js');
