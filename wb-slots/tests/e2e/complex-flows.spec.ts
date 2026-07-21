import { test, expect, Page } from '@playwright/test';

// ===== COMPLEX E2E TESTS FOR WB SLOTS SYSTEM =====

test.describe('Complex User Flows', () => {
  let testUser: { email: string; password: string; name: string };

  test.beforeAll(async () => {
    // Setup test user
    testUser = {
      email: `test-${Date.now()}@wb-slots.com`,
      password: 'TestPassword123!',
      name: 'Test User'
    };
  });

  test.describe('Complete Auto-Booking Flow', () => {
    test('should complete full auto-booking workflow', async ({ page }) => {
      // 1. Register new user
      await page.goto('/auth/register');
      await page.fill('input[name="name"]', testUser.name);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.fill('input[name="confirmPassword"]', testUser.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard');

      // 2. Setup WB session
      await page.goto('/wb-session/setup');
      await expect(page.locator('text=Настройка сессии WB')).toBeVisible();
      
      // Start session creation
      await page.click('button:has-text("Создать сессию")');
      await expect(page.locator('text=Откройте браузер для авторизации')).toBeVisible();

      // 3. Create auto-booking task
      await page.goto('/tasks/new');
      await page.fill('input[name="name"]', 'E2E Test Task');
      await page.fill('textarea[name="description"]', 'End-to-end test task');
      
      // Select warehouses
      await page.check('input[type="checkbox"][value="117501"]'); // Moscow warehouse
      await page.check('input[type="checkbox"][value="130744"]'); // SPB warehouse
      
      // Set filters
      await page.selectOption('select[name="boxTypeId"]', '2');
      await page.fill('input[name="maxCoefficient"]', '1.5');
      
      // Set schedule
      await page.fill('input[name="scheduleCron"]', '*/30 * * * *');
      
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard');

      // 4. Verify task creation
      await expect(page.locator('text=E2E Test Task')).toBeVisible();
      await expect(page.locator('text=Активна')).toBeVisible();

      // 5. Run task manually
      const runButton = page.locator('button:has-text("Запустить")').first();
      await runButton.click();
      
      // Wait for task execution
      await expect(page.locator('text=Выполняется')).toBeVisible({ timeout: 10000 });
      
      // Wait for completion or timeout
      await page.waitForTimeout(5000);
      
      // Check for results
      const hasResults = await page.locator('text=Найдено слотов').isVisible();
      const hasError = await page.locator('text=Ошибка').isVisible();
      
      expect(hasResults || hasError).toBe(true);
    });

    test('should handle session expiration during booking', async ({ page }) => {
      // Login with existing user
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard');

      // Create task
      await page.goto('/tasks/new');
      await page.fill('input[name="name"]', 'Session Expiry Test');
      await page.check('input[type="checkbox"][value="117501"]');
      await page.click('button[type="submit"]');

      // Simulate session expiry by clearing cookies
      await page.context().clearCookies();
      
      // Try to run task
      await page.goto('/dashboard');
      const runButton = page.locator('button:has-text("Запустить")').first();
      await runButton.click();

      // Should show session error
      await expect(page.locator('text=Сессия истекла')).toBeVisible();
      await expect(page.locator('text=Обновить сессию')).toBeVisible();
    });
  });

  test.describe('Slot Search Integration', () => {
    test('should perform continuous slot search', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');

      // Navigate to slot search
      await page.goto('/slot-search');
      
      // Configure search
      await page.selectOption('select[name="warehouseId"]', '117501');
      await page.selectOption('select[name="boxTypeId"]', '2');
      await page.fill('input[name="maxCoefficient"]', '2.0');
      await page.fill('input[name="searchInterval"]', '30');
      
      // Start continuous search
      await page.click('button:has-text("Начать поиск")');
      
      // Wait for search to start
      await expect(page.locator('text=Поиск активен')).toBeVisible();
      
      // Wait for some results
      await page.waitForTimeout(10000);
      
      // Check for results or status
      const hasResults = await page.locator('.slot-result').count() > 0;
      const isSearching = await page.locator('text=Поиск активен').isVisible();
      
      expect(hasResults || isSearching).toBe(true);
      
      // Stop search
      await page.click('button:has-text("Остановить")');
      await expect(page.locator('text=Поиск остановлен')).toBeVisible();
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');

      // Simulate network issues by blocking requests
      await page.route('**/api/**', route => {
        if (Math.random() < 0.5) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      // Try to create task
      await page.goto('/tasks/new');
      await page.fill('input[name="name"]', 'Network Error Test');
      await page.check('input[type="checkbox"][value="117501"]');
      await page.click('button[type="submit"]');

      // Should handle errors gracefully
      const hasError = await page.locator('text=Ошибка сети').isVisible();
      const hasRetry = await page.locator('button:has-text("Повторить")').isVisible();
      
      expect(hasError || hasRetry).toBe(true);
    });

    test('should recover from browser crashes', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');

      // Start a task
      await page.goto('/tasks/new');
      await page.fill('input[name="name"]', 'Crash Recovery Test');
      await page.check('input[type="checkbox"][value="117501"]');
      await page.click('button[type="submit"]');

      // Simulate browser crash by closing page
      await page.close();
      
      // Reopen and check recovery
      const newPage = await page.context().newPage();
      await newPage.goto('/auth/login');
      await newPage.fill('input[name="email"]', testUser.email);
      await newPage.fill('input[name="password"]', testUser.password);
      await newPage.click('button[type="submit"]');
      
      await newPage.goto('/dashboard');
      
      // Should show recovery options
      const hasRecovery = await newPage.locator('text=Восстановить задачу').isVisible();
      expect(hasRecovery).toBe(true);
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle multiple concurrent tasks', async ({ page }) => {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');

      // Create multiple tasks
      const taskNames = ['Task 1', 'Task 2', 'Task 3'];
      
      for (const taskName of taskNames) {
        await page.goto('/tasks/new');
        await page.fill('input[name="name"]', taskName);
        await page.check('input[type="checkbox"][value="117501"]');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);
      }

      // Verify all tasks created
      await page.goto('/dashboard');
      for (const taskName of taskNames) {
        await expect(page.locator(`text=${taskName}`)).toBeVisible();
      }

      // Start all tasks
      const runButtons = page.locator('button:has-text("Запустить")');
      const count = await runButtons.count();
      
      for (let i = 0; i < count; i++) {
        await runButtons.nth(i).click();
        await page.waitForTimeout(500);
      }

      // Check system performance
      await page.waitForTimeout(5000);
      
      // Should handle load gracefully
      const hasErrors = await page.locator('text=Система перегружена').isVisible();
      expect(hasErrors).toBe(false);
    });
  });

  test.describe('Data Persistence and State Management', () => {
    test('should persist task state across sessions', async ({ page }) => {
      // Create task
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');

      await page.goto('/tasks/new');
      await page.fill('input[name="name"]', 'Persistence Test');
      await page.check('input[type="checkbox"][value="117501"]');
      await page.click('button[type="submit"]');

      // Close browser
      await page.context().close();
      
      // Reopen browser
      const newContext = await page.context().browser()?.newContext();
      const newPage = await newContext?.newPage();
      
      if (newPage) {
        await newPage.goto('/auth/login');
        await newPage.fill('input[name="email"]', testUser.email);
        await newPage.fill('input[name="password"]', testUser.password);
        await newPage.click('button[type="submit"]');
        
        await newPage.goto('/dashboard');
        
        // Task should still exist
        await expect(newPage.locator('text=Persistence Test')).toBeVisible();
      }
    });
  });
});
