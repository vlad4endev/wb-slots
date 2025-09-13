// ===== VITEST CONFIGURATION =====

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test patterns
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'src/__tests__/**/*.{js,ts}',
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'coverage',
      'src/__tests__/e2e/**/*',
    ],
    
    // Global setup
    globalSetup: './src/__tests__/setup/global-setup.ts',
    
    // Setup files
    setupFiles: [
      './src/__tests__/setup/test-setup.ts',
    ],
    
    // Test timeout
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{js,ts}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{js,ts}',
        'src/**/*.spec.{js,ts}',
        'src/__tests__/**/*',
        'src/**/index.ts',
        'src/**/types.ts',
        'src/**/constants.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Stricter thresholds for critical files
        'src/lib/services/**/*.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/lib/errors/**/*.ts': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html',
    },
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    
    // Test file patterns
    globals: true,
    
    // Mock configuration
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    
    // TypeScript configuration
    typecheck: {
      tsconfig: './tsconfig.json',
    },
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/app': path.resolve(__dirname, './src/app'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
  
  // Define configuration
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.DATABASE_URL': '"postgresql://test:test@localhost:5432/wb_slots_test"',
    'process.env.REDIS_URL': '"redis://localhost:6379/1"',
    'process.env.JWT_SECRET': '"test-jwt-secret"',
    'process.env.ENCRYPTION_KEY': '"test-encryption-key-32-chars-long"',
  },
});
