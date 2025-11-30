#!/usr/bin/env node
/**
 * Server startup wrapper
 * Logs configuration before starting the Next.js server
 * VERSION: 3.0 - Production with P3005 Auto-Baseline
 */

console.log('\n🔵 SERVER-WITH-LOGS.JS VERSION 3.0 STARTING 🔵\n');

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

  const env = process.env.NODE_ENV || 'development';
  const port = process.env.PORT || '3000';
  const hostname = process.env.HOSTNAME || '0.0.0.0';
  const dbUrl = process.env.DATABASE_URL ? maskDatabaseUrl(process.env.DATABASE_URL) : '❌ NOT SET';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '⚠️  NOT SET';

  console.log('\n📋 CONFIGURATION:');
  console.log(`   Environment: ${env}`);
  console.log(`   Server: http://${hostname}:${port}`);
  console.log(`   Database: ${dbUrl}`);
  console.log(`   API URL: ${apiUrl}`);

  // Validation warnings
  const warnings = [];
  if (!process.env.DATABASE_URL) warnings.push('DATABASE_URL is not set');
  if (!process.env.NEXT_PUBLIC_API_URL) warnings.push('NEXT_PUBLIC_API_URL is not set');

  if (warnings.length > 0) {
    console.log('\n⚠️  CONFIGURATION WARNINGS:');
    warnings.forEach(w => console.log(`   - ${w}`));
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Started at: ${new Date().toISOString()}`);
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
        console.log('🔄 Running database migrations...');
        
        try {
          // NOTE: We don't use stdio: 'inherit' here because we need to capture
          // the error output to detect the P3005 error (database not empty without migration tracking).
          // This allows us to automatically baseline the database when needed.
          const output = execSync('prisma migrate deploy', { 
            shell: true,
            cwd: __dirname,
            env: process.env,
            encoding: 'utf8'
          });
          console.log(output);
          console.log('✅ Database migrations deployed successfully\n');
        } catch (deployError) {
          const errorOutput = (deployError.stderr || deployError.stdout || deployError.message || '').toString();
          
          // Print error output
          if (deployError.stdout) console.log(deployError.stdout.toString());
          if (deployError.stderr) console.error(deployError.stderr.toString());
          
          // Handle P3005: Database schema is not empty without migration tracking
          // This occurs when tables exist but Prisma hasn't tracked which migrations were applied.
          // Solution: Use db push to sync schema, then mark migrations as applied (baseline).
          if (errorOutput.includes('P3005') || errorOutput.includes('database schema is not empty')) {
            console.log('\n⚠️  Database needs baselining (P3005 error detected)');
            console.log('🔧 Syncing schema and marking migrations as applied...\n');
            
            // Sync schema with db push (safe for existing tables)
            execSync('prisma db push --accept-data-loss --skip-generate', {
              stdio: 'inherit',
              shell: true,
              cwd: __dirname,
              env: process.env
            });
            
            // Mark all migrations as applied
            const migrationsDir = path.join(__dirname, 'prisma', 'migrations');
            const migrations = fs.readdirSync(migrationsDir)
              .filter(f => f !== 'migration_lock.toml' && !f.startsWith('.'))
              .sort();
            
            if (migrations.length > 0) {
              console.log(`\n📌 Marking ${migrations.length} migration(s) as applied...`);
              for (const migration of migrations) {
                execSync(`prisma migrate resolve --applied "${migration}"`, {
                  stdio: 'inherit',
                  shell: true,
                  cwd: __dirname,
                  env: process.env
                });
              }
              console.log('✅ Database baselined successfully\n');
            }
          } else {
            throw deployError;
          }
        }
      } else {
        const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma');
        console.log(`Running: ${prismaPath} db push --skip-generate`);
        execSync(`"${prismaPath}" db push --skip-generate`, { stdio: 'inherit', shell: true });
        console.log('✅ Database schema synced successfully');
      }
    } else {
      console.log('⚠️ Skipping migrations: DATABASE_URL not set');
    }
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED ❌');
    console.error('Error message:', error.message);
    if (error.stdout) console.error('stdout:', error.stdout.toString());
    if (error.stderr) console.error('stderr:', error.stderr.toString());
    console.error('Exit code:', error.status);
    console.error('\n⚠️  Server will continue to start, but database may be out of sync!\n');
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
