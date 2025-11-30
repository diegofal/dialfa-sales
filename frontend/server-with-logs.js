#!/usr/bin/env node
/**
 * Server startup wrapper
 * Logs configuration before starting the Next.js server
 * VERSION: 2.1-FIXED - Prisma Binary Execution Fix
 */

console.log('\n🔵 SERVER-WITH-LOGS.JS VERSION 2.1 STARTING 🔵\n');

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
        // Use globally installed prisma (installed in Dockerfile)
        console.log(`🔧 Running: prisma migrate deploy`);
        console.log(`📁 Working directory: ${__dirname}`);
        console.log(`📂 Prisma schema location: ${path.join(__dirname, 'prisma', 'schema.prisma')}`);
        console.log(`🗄️  Database: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
        
        // Check if prisma directory exists
        const prismaDir = path.join(__dirname, 'prisma');
        if (fs.existsSync(prismaDir)) {
          console.log(`✓ Prisma directory found at: ${prismaDir}`);
          const migrationsDir = path.join(prismaDir, 'migrations');
          if (fs.existsSync(migrationsDir)) {
            console.log(`✓ Migrations directory found at: ${migrationsDir}`);
            const migrations = fs.readdirSync(migrationsDir);
            console.log(`📦 Found ${migrations.length} migration(s):`, migrations.join(', '));
          } else {
            console.warn(`⚠️  Migrations directory not found at: ${migrationsDir}`);
          }
        } else {
          console.error(`❌ Prisma directory not found at: ${prismaDir}`);
        }
        
        // Use global prisma command
        console.log(`\n🔄 Executing migration...`);
        try {
          execSync('prisma migrate deploy', { 
            stdio: 'inherit', 
            shell: true,
            cwd: __dirname,
            env: process.env
          });
          console.log('\n✅ Database migrations deployed successfully\n');
        } catch (deployError) {
          // Check if this is the P3005 error (database not empty, needs baseline)
          const errorOutput = deployError.stderr ? deployError.stderr.toString() : deployError.message;
          
          if (errorOutput.includes('P3005') || errorOutput.includes('database schema is not empty')) {
            console.log('\n⚠️  Database is not empty and needs baselining (Error P3005)...');
            console.log('🔧 Using db push to sync schema, then baselining migrations...');
            
            // Use db push to sync the schema (it handles existing tables gracefully)
            console.log('🔄 Running: prisma db push --accept-data-loss');
            execSync('prisma db push --accept-data-loss --skip-generate', {
              stdio: 'inherit',
              shell: true,
              cwd: __dirname,
              env: process.env
            });
            console.log('✅ Schema synchronized with db push');
            
            // Now mark all existing migrations as applied
            const migrationsDir = path.join(__dirname, 'prisma', 'migrations');
            const migrations = fs.readdirSync(migrationsDir)
              .filter(f => f !== 'migration_lock.toml' && !f.startsWith('.'))
              .sort();
            
            if (migrations.length > 0) {
              console.log(`📌 Marking ${migrations.length} migration(s) as applied...`);
              
              for (const migration of migrations) {
                console.log(`  - ${migration}`);
                execSync(`prisma migrate resolve --applied "${migration}"`, {
                  stdio: 'inherit',
                  shell: true,
                  cwd: __dirname,
                  env: process.env
                });
              }
              
              console.log('✅ All migrations baselined successfully');
              console.log('\n✅ Database schema is now in sync\n');
            }
          } else {
            // Re-throw if it's a different error
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
