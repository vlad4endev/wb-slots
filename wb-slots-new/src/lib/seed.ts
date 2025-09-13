import { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth';
import { encrypt } from './encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create demo users
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@wb-slots.com' },
    update: {},
    create: {
      email: 'demo@wb-slots.com',
      passwordHash: await hashPassword('demo123'),
      name: 'Demo User',
      timezone: 'Europe/Moscow',
      role: 'USER',
      isActive: true,
      emailVerified: new Date(),
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@wb-slots.com' },
    update: {},
    create: {
      email: 'admin@wb-slots.com',
      passwordHash: await hashPassword('admin123'),
      name: 'Admin User',
      timezone: 'Europe/Moscow',
      role: 'ADMIN',
      isActive: true,
      emailVerified: new Date(),
    },
  });

  console.log('✅ Created users');

  // Create demo tokens (encrypted dummy tokens)
  const demoSuppliesToken = await prisma.userToken.upsert({
    where: { 
      userId_category: {
        userId: demoUser.id,
        category: 'SUPPLIES',
      }
    },
    update: {},
    create: {
      userId: demoUser.id,
      category: 'SUPPLIES',
      tokenEncrypted: encrypt('demo-supplies-token-12345'),
      isActive: true,
    },
  });

  const demoMarketplaceToken = await prisma.userToken.upsert({
    where: { 
      userId_category: {
        userId: demoUser.id,
        category: 'MARKETPLACE',
      }
    },
    update: {},
    create: {
      userId: demoUser.id,
      category: 'MARKETPLACE',
      tokenEncrypted: encrypt('demo-marketplace-token-67890'),
      isActive: true,
    },
  });

  console.log('✅ Created demo tokens');

  // Create warehouse preferences
  const warehouses = [
    { id: 1, name: 'Склад WB Москва (Тула)' },
    { id: 2, name: 'Склад WB Санкт-Петербург (Пулково)' },
    { id: 3, name: 'Склад WB Екатеринбург' },
    { id: 4, name: 'Склад WB Новосибирск' },
    { id: 5, name: 'Склад WB Казань' },
  ];

  for (const warehouse of warehouses) {
    await prisma.warehousePref.upsert({
      where: {
        userId_warehouseId: {
          userId: demoUser.id,
          warehouseId: warehouse.id,
        }
      },
      update: {},
      create: {
        userId: demoUser.id,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        enabled: true,
        boxAllowed: true,
        monopalletAllowed: true,
        supersafeAllowed: true,
      },
    });
  }

  console.log('✅ Created warehouse preferences');

  // Create demo tasks
  const task1 = await prisma.task.create({
    data: {
      userId: demoUser.id,
      name: 'Поиск слотов Москва',
      description: 'Автоматический поиск доступных слотов на складе в Москве',
      enabled: true,
      scheduleCron: '*/15 * * * *', // Every 15 minutes
      autoBook: false,
      filters: {
        coefficientAllowed: [0, 1],
        allowUnload: true,
        dates: {
          from: new Date().toISOString(),
          to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        boxTypeIds: [5, 6],
        warehouseIds: [1, 2],
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 5000,
      },
      priority: 5,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      userId: demoUser.id,
      name: 'Поиск слотов СПб',
      description: 'Поиск слотов в Санкт-Петербурге с автобронированием',
      enabled: true,
      scheduleCron: '0 */2 * * *', // Every 2 hours
      autoBook: true,
      filters: {
        coefficientAllowed: [1],
        allowUnload: true,
        dates: {
          from: new Date().toISOString(),
          to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        boxTypeIds: [5],
        warehouseIds: [2],
      },
      retryPolicy: {
        maxRetries: 5,
        backoffMs: 3000,
      },
      priority: 8,
    },
  });

  console.log('✅ Created demo tasks');

  // Create demo runs
  const run1 = await prisma.run.create({
    data: {
      taskId: task1.id,
      userId: demoUser.id,
      status: 'SUCCESS',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      finishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30 * 1000),
      summary: {
        foundSlots: 3,
        slots: [
          {
            warehouseId: 1,
            date: '2024-12-15',
            coefficient: 1,
            allowUnload: true,
          },
          {
            warehouseId: 1,
            date: '2024-12-16',
            coefficient: 0.5,
            allowUnload: true,
          },
          {
            warehouseId: 2,
            date: '2024-12-17',
            coefficient: 1,
            allowUnload: true,
          },
        ],
        scannedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    },
  });

  const run2 = await prisma.run.create({
    data: {
      taskId: task2.id,
      userId: demoUser.id,
      status: 'RUNNING',
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      summary: {
        scannedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    },
  });

  console.log('✅ Created demo runs');

  // Create demo run logs
  await prisma.runLog.createMany({
    data: [
      {
        runId: run1.id,
        level: 'INFO',
        message: 'Starting slot scan for task: Поиск слотов Москва',
        meta: { taskId: task1.id },
      },
      {
        runId: run1.id,
        level: 'INFO',
        message: 'Found 3 available slots',
        meta: { slotsCount: 3 },
      },
      {
        runId: run1.id,
        level: 'INFO',
        message: 'Slot scan completed successfully',
        meta: { duration: '30s' },
      },
      {
        runId: run2.id,
        level: 'INFO',
        message: 'Starting slot scan for task: Поиск слотов СПб',
        meta: { taskId: task2.id },
      },
      {
        runId: run2.id,
        level: 'INFO',
        message: 'Scanning warehouses: [2]',
        meta: { warehouseIds: [2] },
      },
    ],
  });

  console.log('✅ Created demo run logs');

  // Create demo supply snapshots
  await prisma.supplySnapshot.createMany({
    data: [
      {
        userId: demoUser.id,
        preorderId: 'PO-2024-001',
        supplyId: 'SUP-2024-001',
        warehouseId: 1,
        boxTypeId: 5,
        statusName: 'В пути',
        supplyDate: new Date('2024-12-20'),
        factDate: null,
        updatedDate: new Date(),
        raw: {
          id: 'SUP-2024-001',
          name: 'Поставка #1',
          status: 'in_transit',
          warehouse: 'Москва (Тула)',
          boxType: 'Box',
        },
      },
      {
        userId: demoUser.id,
        preorderId: 'PO-2024-002',
        supplyId: 'SUP-2024-002',
        warehouseId: 2,
        boxTypeId: 6,
        statusName: 'Принято',
        supplyDate: new Date('2024-12-18'),
        factDate: new Date('2024-12-18'),
        updatedDate: new Date(),
        raw: {
          id: 'SUP-2024-002',
          name: 'Поставка #2',
          status: 'accepted',
          warehouse: 'Санкт-Петербург (Пулково)',
          boxType: 'Monopallet',
        },
      },
    ],
  });

  console.log('✅ Created demo supply snapshots');

  // Create notification channels
  await prisma.notificationChannel.create({
    data: {
      userId: demoUser.id,
      type: 'EMAIL',
      config: {
        email: 'demo@wb-slots.com',
      },
      enabled: true,
    },
  });

  console.log('✅ Created notification channels');

  // Create audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: demoUser.id,
        action: 'TASK_CREATED',
        target: 'task',
        meta: { taskId: task1.id, taskName: task1.name },
      },
      {
        userId: demoUser.id,
        action: 'TASK_CREATED',
        target: 'task',
        meta: { taskId: task2.id, taskName: task2.name },
      },
      {
        userId: demoUser.id,
        action: 'TOKEN_CREATED',
        target: 'token',
        meta: { category: 'SUPPLIES' },
      },
    ],
  });

  console.log('✅ Created audit logs');

  console.log('🎉 Database seeding completed!');
  console.log('\n📋 Demo accounts:');
  console.log('👤 User: demo@wb-slots.com / demo123');
  console.log('👑 Admin: admin@wb-slots.com / admin123');
  console.log('\n🔗 Login at: http://localhost:3000/auth/login');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
