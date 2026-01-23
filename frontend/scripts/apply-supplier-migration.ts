import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sqlPath = path.join(__dirname, '..', 'prisma', 'migrations', 'fixed_supplier_orders.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Split by semicolon and filter out empty statements
  const statements = sqlContent
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  console.log(`Applying ${statements.length} SQL statements...`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`);
    try {
      await prisma.$executeRawUnsafe(statement);
      console.log('✓ Success');
    } catch (error: any) {
      // Ignore already exists errors
      if (error.code === 'P2010' && error.meta?.code === '42P07') {
        console.log('⚠ Already exists, skipping');
      } else if (error.code === 'P2010' && error.meta?.code === '42710') {
        console.log('⚠ Already exists, skipping');
      } else if (error.meta?.message?.includes('already exists')) {
        console.log('⚠ Already exists, skipping');
      } else {
        console.error('✗ Error:', error.meta?.message || error.message);
        // Continue with other statements
      }
    }
  }

  console.log('\n✓ Migration completed');
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
