import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Check if user already exists
    const existing = await prisma.users.findUnique({
      where: { username: 'admin' }
    });

    if (existing) {
      console.log('User "admin" already exists!');
      console.log('User details:', {
        id: existing.id,
        username: existing.username,
        email: existing.email,
        role: existing.role,
        isActive: existing.is_active
      });
      return;
    }

    // Create test user with hashed password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const user = await prisma.users.create({
      data: {
        username: 'admin',
        email: 'admin@spisa.com',
        password_hash: hashedPassword,
        full_name: 'Administrator',
        role: 'admin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      }
    });

    console.log('✅ Test user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('User ID:', user.id);
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();


