/**
 * Script de prueba antes de migración completa
 *
 * Prueba:
 * - Conexión a Supabase
 * - Conexión a PostgreSQL
 * - Acceso a carpeta de certificados
 * - Upload de 1 archivo de prueba
 *
 * Uso:
 *   npx tsx scripts/test-migration.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { uploadCertificateFile, isAllowedFileType } from '../lib/storage/supabase';

const CERTIFICATES_SOURCE_DIR = 'G:\\Shared drives\\Dialfa\\CERTIFICADOS DIALFA';
const prisma = new PrismaClient();

async function testConnections() {
  console.log('🧪 Prueba de conexiones\n');

  // 1. Test Prisma/PostgreSQL
  console.log('1️⃣  Testeando PostgreSQL...');
  try {
    await prisma.$connect();
    const count = await prisma.certificates.count();
    console.log(`   ✅ Conectado. Certificados actuales: ${count}\n`);
  } catch (error) {
    console.error('   ❌ Error conectando a PostgreSQL:', error);
    process.exit(1);
  }

  // 2. Test Supabase
  console.log('2️⃣  Testeando Supabase Storage...');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('   ❌ Faltan variables de entorno: SUPABASE_URL o SUPABASE_SERVICE_KEY');
    process.exit(1);
  }
  console.log(`   ✅ Variables configuradas\n`);

  // 3. Test acceso a carpeta
  console.log('3️⃣  Testeando acceso a carpeta de certificados...');
  try {
    await fs.access(CERTIFICATES_SOURCE_DIR);
    const entries = await fs.readdir(CERTIFICATES_SOURCE_DIR);
    console.log(`   ✅ Carpeta accesible. Subcarpetas: ${entries.length}\n`);
  } catch (error) {
    console.error(`   ❌ No se puede acceder a ${CERTIFICATES_SOURCE_DIR}`);
    console.error('   ', error);
    process.exit(1);
  }

  // 4. Test upload de un archivo
  console.log('4️⃣  Testeando upload de archivo de prueba...');
  try {
    // Buscar primer archivo válido
    const testFile = await findFirstValidFile(CERTIFICATES_SOURCE_DIR);

    if (!testFile) {
      console.log('   ⚠️  No se encontró ningún archivo válido para probar');
      return;
    }

    console.log(`   📄 Archivo de prueba: ${path.basename(testFile)}`);

    const fileBuffer = await fs.readFile(testFile);
    const fileName = path.basename(testFile);

    // Upload
    const { storagePath } = await uploadCertificateFile(fileBuffer, fileName, 'ACCESORIOS');

    console.log(`   ✅ Upload exitoso: ${storagePath}`);

    // Registrar en DB
    const certificate = await prisma.certificates.create({
      data: {
        file_name: fileName,
        storage_path: storagePath,
        original_path: testFile,
        file_type: fileName.split('.').pop()?.toLowerCase() || 'unknown',
        file_size_bytes: BigInt(fileBuffer.length),
        category: 'ACCESORIOS',
        notes: 'Archivo de prueba - migración',
      },
    });

    console.log(`   💾 Registrado en DB: ID ${certificate.id}\n`);
  } catch (error) {
    console.error('   ❌ Error en upload de prueba:', error);
    process.exit(1);
  }

  console.log('✅ Todas las pruebas pasaron. El sistema está listo para migración completa.\n');
  console.log('Para ejecutar la migración completa:');
  console.log('  npx tsx scripts/migrate-certificates.ts\n');
}

async function findFirstValidFile(dir: string): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && isAllowedFileType(entry.name)) {
      return fullPath;
    }

    if (entry.isDirectory()) {
      const found = await findFirstValidFile(fullPath);
      if (found) return found;
    }
  }

  return null;
}

testConnections()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
