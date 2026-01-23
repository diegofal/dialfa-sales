import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Verificando tablas creadas...\n');

  // Check suppliers table
  const suppliersCount = await prisma.suppliers.count();
  console.log(`✓ Tabla suppliers: ${suppliersCount} registros`);

  // Check supplier_orders table
  const ordersCount = await prisma.supplier_orders.count();
  console.log(`✓ Tabla supplier_orders: ${ordersCount} registros`);

  // Check supplier_order_items table
  const itemsCount = await prisma.supplier_order_items.count();
  console.log(`✓ Tabla supplier_order_items: ${itemsCount} registros`);

  console.log('\n✅ Todas las tablas están creadas y funcionando correctamente!');
  console.log('\n📦 El módulo de Pedidos a Proveedores está listo para usar.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
