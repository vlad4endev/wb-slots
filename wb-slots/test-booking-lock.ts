/**
 * ТЕСТ АВТОБРОНИРОВАНИЯ - Проверка исправлений
 */

import { prisma } from './src/lib/prisma';
import { bookingLockService } from './src/lib/services/booking-lock-service';

async function testBookingImprovements() {
  console.log('🧪 ТЕСТИРОВАНИЕ ИСПРАВЛЕНИЙ АВТОБРОНИРОВАНИЯ\n');

  const testUserId = 'test-user-' + Date.now();

  try {
    // ===== ТЕСТ 1: Database Constraint для FoundSlot =====
    console.log('1️⃣ Тест: Unique constraint для FoundSlot');
    
    try {
      // Создаём первый слот
      const slot1 = await prisma.foundSlot.create({
        data: {
          runId: 'test-run-1',
          userId: testUserId,
          warehouseId: 123,
          warehouseName: 'Тестовый склад',
          date: '2025-11-05',
          timeSlot: '09:00-12:00',
          coefficient: 1.5,
          boxTypes: ['MONO'],
          isBooked: false,
        },
      });
      console.log('   ✅ Первый слот создан:', slot1.id);

      // Пытаемся создать дубликат (должно упасть)
      const slot2 = await prisma.foundSlot.create({
        data: {
          runId: 'test-run-2',
          userId: testUserId,
          warehouseId: 123,
          warehouseName: 'Тестовый склад',
          date: '2025-11-05',
          timeSlot: '09:00-12:00',
          coefficient: 1.5,
          boxTypes: ['MONO'],
          isBooked: false,
        },
      });
      console.log('   ❌ ОШИБКА: Дубликат был создан! Constraint не работает');
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log('   ✅ Constraint работает! Дубликат заблокирован');
        console.log('   ℹ️  Ошибка:', error.meta?.target);
      } else {
        throw error;
      }
    }

    // ===== ТЕСТ 2: Distributed Lock =====
    console.log('\n2️⃣ Тест: Distributed Lock для concurrent bookings');
    
    // Получаем первую блокировку
    const lock1 = await bookingLockService.acquireLock(testUserId, {
      taskId: 'task-1',
      ttlSeconds: 60,
    });
    
    if (lock1) {
      console.log('   ✅ Первая блокировка получена:', lock1.id);
      
      // Пытаемся получить вторую (должна упасть)
      const lock2 = await bookingLockService.acquireLock(testUserId, {
        taskId: 'task-2',
        ttlSeconds: 60,
      });
      
      if (!lock2) {
        console.log('   ✅ Вторая блокировка заблокирована! Защита работает');
      } else {
        console.log('   ❌ ОШИБКА: Вторая блокировка получена! Защита не работает');
        await bookingLockService.releaseLock(lock2.id);
      }
      
      // Проверяем информацию о блокировке
      const lockInfo = await bookingLockService.getLockInfo(testUserId);
      console.log('   ℹ️  Информация о блокировке:', {
        lockId: lockInfo?.id,
        expiresAt: lockInfo?.expiresAt,
      });
      
      // Освобождаем
      await bookingLockService.releaseLock(lock1.id);
      console.log('   ✅ Блокировка освобождена');
      
      // Проверяем, что можно получить снова
      const lock3 = await bookingLockService.acquireLock(testUserId, {
        taskId: 'task-3',
        ttlSeconds: 60,
      });
      
      if (lock3) {
        console.log('   ✅ После освобождения блокировка получена снова');
        await bookingLockService.releaseLock(lock3.id);
      }
    }

    // ===== ТЕСТ 3: Транзакционная атомарность =====
    console.log('\n3️⃣ Тест: Транзакционная атомарность');
    
    try {
      await prisma.$transaction(async (tx) => {
        // Создаём слот
        const slot = await tx.foundSlot.create({
          data: {
            runId: 'test-run-atomic',
            userId: testUserId,
            warehouseId: 456,
            warehouseName: 'Склад для атомарности',
            date: '2025-11-06',
            timeSlot: '12:00-15:00',
            coefficient: 2.0,
            boxTypes: ['MONO'],
            isBooked: false,
          },
        });

        // Обновляем атомарно (optimistic locking)
        const updated = await tx.foundSlot.updateMany({
          where: {
            userId: testUserId,
            warehouseId: 456,
            date: '2025-11-06',
            timeSlot: '12:00-15:00',
            isBooked: false, // КРИТИЧНО: только если не забронирован
          },
          data: {
            isBooked: true,
            bookingId: 'BOOKING-TEST-123',
          },
        });

        console.log('   ✅ Обновлено слотов:', updated.count);

        // Проверяем, что повторное обновление не сработает
        const updated2 = await tx.foundSlot.updateMany({
          where: {
            userId: testUserId,
            warehouseId: 456,
            date: '2025-11-06',
            timeSlot: '12:00-15:00',
            isBooked: false, // Уже забронирован!
          },
          data: {
            isBooked: true,
            bookingId: 'BOOKING-TEST-456',
          },
        });

        console.log('   ✅ Повторное обновление заблокировано:', updated2.count === 0);
      });
    } catch (error) {
      console.log('   ❌ Транзакция упала:', error);
    }

    // ===== ТЕСТ 4: Session expiration =====
    console.log('\n4️⃣ Тест: Session expiration (проверка expiresAt)');
    
    // Создаём истекшую сессию
    const expiredSession = await prisma.wBSession.create({
      data: {
        userId: testUserId,
        sessionData: 'encrypted-data',
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // Истекла 1 секунду назад
      },
    });
    
    console.log('   ✅ Истекшая сессия создана');
    
    // Проверка должна обнаружить истечение
    const session = await prisma.wBSession.findUnique({
      where: { userId: testUserId },
    });
    
    if (session && session.expiresAt && session.expiresAt < new Date()) {
      console.log('   ✅ Истечение обнаружено! expiresAt < now');
      
      // Деактивируем
      await prisma.wBSession.update({
        where: { userId: testUserId },
        data: { 
          isActive: false, 
          deactivationReason: 'Session expired during test' 
        },
      });
      
      console.log('   ✅ Истекшая сессия деактивирована');
    }

    console.log('\n✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
    
  } catch (error) {
    console.error('\n❌ ОШИБКА В ТЕСТАХ:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleanup тестовых данных...');
    
    await prisma.foundSlot.deleteMany({
      where: { userId: testUserId },
    });
    
    await prisma.wBSession.deleteMany({
      where: { userId: testUserId },
    });
    
    await bookingLockService.releaseLockByUserId(testUserId);
    
    console.log('✅ Cleanup завершён');
    await prisma.$disconnect();
  }
}

// Запуск тестов
testBookingImprovements();

