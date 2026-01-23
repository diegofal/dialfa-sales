/**
 * Script para limpiar completamente Supabase Storage y PostgreSQL
 *
 * ⚠️  ADVERTENCIA: Este script eliminará TODOS los certificados de:
 *   - Supabase Storage (archivos)
 *   - PostgreSQL (registros en DB)
 *
 * Uso:
 *   npm run clean:all
 */

import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';
import { supabase } from '../lib/storage/supabase';

const prisma = new PrismaClient();
const BUCKET_NAME = 'certificates';

/**
 * Pregunta de confirmación
 */
async function confirmClean(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      '\n⚠️  ¿Estás seguro de que querés eliminar TODOS los certificados? (escribe "SI" para confirmar): ',
      (answer) => {
        rl.close();
        resolve(answer.toUpperCase() === 'SI');
      }
    );
  });
}

/**
 * Limpia todos los archivos de Supabase Storage
 */
async function cleanSupabaseStorage(): Promise<number> {
  console.log('\n🗑️  Limpiando Supabase Storage...\n');

  let totalDeleted = 0;

  try {
    // Listar todas las carpetas/categorías
    const { data: folders, error: foldersError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 1000,
      });

    if (foldersError) {
      console.error('❌ Error listando carpetas:', foldersError);
      return 0;
    }

    if (!folders || folders.length === 0) {
      console.log('✅ No hay archivos en Supabase Storage');
      return 0;
    }

    console.log(`📂 Encontradas ${folders.length} carpetas`);

    // Procesar cada carpeta
    for (const folder of folders) {
      if (!folder.name) continue;

      console.log(`\n  📁 Procesando carpeta: ${folder.name}`);

      // Listar archivos en la carpeta
      const { data: files, error: filesError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folder.name, {
          limit: 1000,
        });

      if (filesError) {
        console.error(`  ❌ Error listando archivos en ${folder.name}:`, filesError);
        continue;
      }

      if (!files || files.length === 0) {
        console.log(`  ⏭️  Sin archivos`);
        continue;
      }

      console.log(`  📄 Encontrados ${files.length} archivos`);

      // Eliminar archivos en lotes de 100
      const batchSize = 100;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const pathsToDelete = batch.map((f) => `${folder.name}/${f.name}`);

        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(pathsToDelete);

        if (deleteError) {
          console.error(`  ❌ Error eliminando lote:`, deleteError);
        } else {
          totalDeleted += batch.length;
          console.log(`  ✅ Eliminados ${batch.length} archivos (total: ${totalDeleted})`);
        }
      }
    }

    console.log(`\n✅ Total de archivos eliminados de Supabase: ${totalDeleted}`);
    return totalDeleted;
  } catch (error) {
    console.error('❌ Error limpiando Supabase Storage:', error);
    return totalDeleted;
  }
}

/**
 * Limpia la base de datos PostgreSQL
 */
async function cleanDatabase(): Promise<void> {
  console.log('\n🗑️  Limpiando base de datos PostgreSQL...\n');

  try {
    // Eliminar en orden (respetando foreign keys)
    const deletedColadaCerts = await prisma.certificate_coladas.deleteMany({});
    console.log(`  ✅ Eliminadas ${deletedColadaCerts.count} relaciones certificado-colada`);

    const deletedCerts = await prisma.certificates.deleteMany({});
    console.log(`  ✅ Eliminados ${deletedCerts.count} certificados`);

    const deletedColadas = await prisma.coladas.deleteMany({});
    console.log(`  ✅ Eliminadas ${deletedColadas.count} coladas`);

    console.log('\n✅ Base de datos limpia');
  } catch (error) {
    console.error('❌ Error limpiando la base de datos:', error);
    throw error;
  }
}

/**
 * Script principal
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🧹 LIMPIEZA COMPLETA - Supabase Storage + PostgreSQL     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  console.log('\n⚠️  ADVERTENCIA: Esta operación eliminará:');
  console.log('   • TODOS los archivos de Supabase Storage');
  console.log('   • TODOS los registros de certificados en PostgreSQL');
  console.log('   • TODOS los registros de coladas en PostgreSQL');
  console.log('\n❗ Esta acción NO se puede deshacer');

  // Confirmar
  const confirmed = await confirmClean();

  if (!confirmed) {
    console.log('\n✋ Operación cancelada por el usuario');
    process.exit(0);
  }

  console.log('\n🚀 Iniciando limpieza...');

  try {
    // 1. Limpiar Supabase Storage
    const filesDeleted = await cleanSupabaseStorage();

    // 2. Limpiar base de datos
    await cleanDatabase();

    // Resumen final
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ LIMPIEZA COMPLETADA                                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Archivos eliminados de Supabase: ${filesDeleted}`);
    console.log('📊 Base de datos: limpia\n');
  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
main();
