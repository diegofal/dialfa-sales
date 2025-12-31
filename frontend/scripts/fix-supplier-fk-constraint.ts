import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando referencias inválidas de supplier_id...\n');
  
  // Check for invalid supplier_id references
  const invalidRefs = await prisma.$queryRaw<Array<{ id: bigint; code: string; description: string; supplier_id: number }>>`
    SELECT id, code, description, supplier_id
    FROM articles 
    WHERE supplier_id IS NOT NULL 
      AND supplier_id NOT IN (SELECT id FROM suppliers)
  `;
  
  if (invalidRefs.length === 0) {
    console.log('✓ No se encontraron referencias inválidas de supplier_id');
    console.log('✓ Los datos están limpios, la migración debería funcionar\n');
    return;
  }
  
  console.log(`⚠ Se encontraron ${invalidRefs.length} artículos con supplier_id inválido:`);
  invalidRefs.forEach((article) => {
    console.log(`  - ID: ${article.id}, Code: ${article.code}, Supplier ID: ${article.supplier_id}`);
  });
  
  console.log('\n🔧 Limpiando supplier_id inválidos...');
  
  try {
    const result = await prisma.$executeRaw`
      UPDATE articles 
      SET supplier_id = NULL 
      WHERE supplier_id IS NOT NULL 
        AND supplier_id NOT IN (SELECT id FROM suppliers)
    `;
    console.log(`✓ Se limpiaron ${result} registros\n`);
  } catch (error: any) {
    console.error('✗ Error al limpiar:', error.message);
    throw error;
  }
  
  // Verify the fix
  console.log('🔍 Verificando la limpieza...');
  const remainingInvalid = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM articles 
    WHERE supplier_id IS NOT NULL 
      AND supplier_id NOT IN (SELECT id FROM suppliers)
  `;
  
  const count = Number(remainingInvalid[0].count);
  if (count === 0) {
    console.log('✓ Todos los supplier_id son ahora válidos o NULL\n');
  } else {
    console.error(`✗ Todavía hay ${count} referencias inválidas\n`);
    throw new Error('Limpieza incompleta');
  }
  
  // Show summary
  const summary = await prisma.$queryRaw<Array<{ total: bigint; with_supplier: bigint; without_supplier: bigint }>>`
    SELECT 
      COUNT(*) as total,
      COUNT(supplier_id) as with_supplier,
      COUNT(*) - COUNT(supplier_id) as without_supplier
    FROM articles
    WHERE deleted_at IS NULL
  `;
  
  console.log('📊 Resumen de artículos:');
  console.log(`  - Total de artículos: ${summary[0].total}`);
  console.log(`  - Con proveedor: ${summary[0].with_supplier}`);
  console.log(`  - Sin proveedor: ${summary[0].without_supplier}\n`);
  
  console.log('✓ Limpieza completada exitosamente');
  console.log('✓ Ahora puedes ejecutar: npx prisma db push\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Error fatal:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

