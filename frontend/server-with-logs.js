#!/usr/bin/env node
/**
 * Server startup wrapper
 * Logs configuration before starting the Next.js server
 */

// Import configuration logging (will be executed immediately)
/* eslint-disable @typescript-eslint/no-require-imports */
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

// Log configuration
logConfig();

// Start the Next.js server
console.log('🔄 Loading Next.js server...\n');
require('./server.js');

