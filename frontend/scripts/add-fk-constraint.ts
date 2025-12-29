import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Verificando y agregando foreign key constraint...');
  
  try {
    // Intenta agregar el constraint (si ya existe, fallará silenciosamente)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE articles 
      ADD CONSTRAINT "f_k_articles__suppliers_supplier_id" 
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON UPDATE NO ACTION
    `);
    console.log('✓ Foreign key constraint agregado');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('⚠ Constraint ya existe, continuando...');
    } else {
      console.error('Error al agregar constraint:', error.message);
    }
  }
  
  console.log('✓ Migración completada');
}

main()
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





