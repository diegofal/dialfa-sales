import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('1. Limpiando supplier_id inválidos en articles...');
  
  try {
    const result = await prisma.$executeRawUnsafe(`
      UPDATE articles SET supplier_id = NULL WHERE supplier_id IS NOT NULL
    `);
    console.log(`✓ Limpiados ${result} registros`);
  } catch (error: any) {
    console.error('Error al limpiar:', error.message);
  }
  
  console.log('\n2. Intentando agregar foreign key constraint...');
  
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE articles 
      ADD CONSTRAINT "f_k_articles__suppliers_supplier_id" 
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE NO ACTION
    `);
    console.log('✓ Foreign key constraint agregado exitosamente');
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.code === '42710') {
      console.log('⚠ Constraint ya existe');
    } else {
      console.error('✗ Error:', error.message);
      throw error;
    }
  }
  
  console.log('\n✓ Migración completada exitosamente');
}

main()
  .catch((e) => {
    console.error('\n❌ Error fatal:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





