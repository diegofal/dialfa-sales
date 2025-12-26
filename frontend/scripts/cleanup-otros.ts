/**
 * Script para eliminar certificados con categoría "OTROS"
 * de la base de datos y Supabase Storage
 */

import { PrismaClient } from '@prisma/client';
import { deleteCertificateFile } from '../lib/storage/supabase';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Limpiando certificados OTROS...\n');
  
  try {
    // Obtener todos los certificados OTROS
    const otrosCerts = await prisma.certificates.findMany({
      where: { 
        category: 'OTROS',
        deleted_at: null
      },
      select: {
        id: true,
        file_name: true,
        storage_path: true
      }
    });
    
    if (otrosCerts.length === 0) {
      console.log('✅ No hay certificados OTROS para eliminar');
      return;
    }
    
    console.log(`📄 Encontrados ${otrosCerts.length} certificados OTROS:\n`);
    otrosCerts.forEach(c => console.log(`  • ${c.file_name}`));
    
    console.log('\n🗑️  Eliminando...\n');
    
    let deletedFromStorage = 0;
    let deletedFromDB = 0;
    
    for (const cert of otrosCerts) {
      console.log(`  📄 ${cert.file_name}`);
      
      // Eliminar de Supabase Storage
      try {
        await deleteCertificateFile(cert.storage_path);
        console.log(`    ✅ Eliminado de Storage`);
        deletedFromStorage++;
      } catch (error) {
        console.log(`    ⚠️  Error en Storage (posiblemente ya eliminado)`);
      }
      
      // Soft delete en base de datos
      await prisma.certificates.update({
        where: { id: cert.id },
        data: { deleted_at: new Date() }
      });
      console.log(`    ✅ Eliminado de DB`);
      deletedFromDB++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`✅ Eliminados de Storage: ${deletedFromStorage}/${otrosCerts.length}`);
    console.log(`✅ Eliminados de DB:      ${deletedFromDB}/${otrosCerts.length}`);
    console.log('='.repeat(60));
    console.log('\n✅ Limpieza completada');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();





