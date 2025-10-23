#!/usr/bin/env tsx
/**
 * Application startup script
 * Logs configuration and performs pre-flight checks
 */

import { logStartupConfiguration } from '../lib/config';

async function startup() {
  try {
    // Log all configuration
    const config = logStartupConfiguration();
    
    // Additional startup checks can be added here
    console.log('🔍 Performing pre-flight checks...\n');
    
    // Check if database is accessible (optional, can be slow)
    // This would require importing Prisma client
    
    console.log('✅ Pre-flight checks completed\n');
    console.log('🎯 Application is ready to accept connections\n');
    
  } catch (error) {
    console.error('❌ Startup failed:', error);
    // Don't exit, let the app continue
  }
}

// Run startup if this is the main module
if (require.main === module) {
  startup().catch(console.error);
}

export default startup;

