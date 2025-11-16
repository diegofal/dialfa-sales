import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating delivery_note_items table...');
  
  try {
    // Create the table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS delivery_note_items (
        id BIGSERIAL PRIMARY KEY,
        delivery_note_id BIGINT NOT NULL,
        sales_order_item_id BIGINT,
        article_id BIGINT NOT NULL,
        article_code VARCHAR(50) NOT NULL,
        article_description VARCHAR(500) NOT NULL,
        quantity INT NOT NULL,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
        CONSTRAINT f_k_delivery_note_items__delivery_notes_delivery_note_id 
          FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE CASCADE,
        CONSTRAINT f_k_delivery_note_items__articles_article_id 
          FOREIGN KEY (article_id) REFERENCES articles(id)
      );
    `);
    console.log('✓ Table created');

    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS ix_delivery_note_items_delivery_note_id 
        ON delivery_note_items(delivery_note_id);
    `);
    console.log('✓ Index ix_delivery_note_items_delivery_note_id created');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS ix_delivery_note_items_article_id 
        ON delivery_note_items(article_id);
    `);
    console.log('✓ Index ix_delivery_note_items_article_id created');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS ix_delivery_note_items_sales_order_item_id 
        ON delivery_note_items(sales_order_item_id);
    `);
    console.log('✓ Index ix_delivery_note_items_sales_order_item_id created');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




