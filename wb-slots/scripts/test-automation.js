#!/usr/bin/env node

// ===== TEST AUTOMATION SCRIPTS =====

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestAutomation {
  constructor() {
    this.projectRoot = process.cwd();
    this.testResults = {
      unit: { passed: 0, failed: 0, total: 0 },
      integration: { passed: 0, failed: 0, total: 0 },
      e2e: { passed: 0, failed: 0, total: 0 },
      coverage: { percentage: 0, threshold: 80 },
    };
  }

  // ===== MAIN TEST RUNNER =====

  async runAllTests(options = {}) {
    console.log('🚀 Starting comprehensive test suite...\n');

    const {
      unit = true,
      integration = true,
      e2e = true,
      coverage = true,
      watch = false,
      parallel = true,
      verbose = false,
    } = options;

    try {
      // Run tests in sequence for better error handling
      if (unit) {
        await this.runUnitTests({ watch, verbose });
      }

      if (integration) {
        await this.runIntegrationTests({ watch, verbose });
      }

      if (e2e) {
        await this.runE2ETests({ parallel, verbose });
      }

      if (coverage) {
        await this.generateCoverageReport();
      }

      this.printTestSummary();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  // ===== UNIT TESTS =====

  async runUnitTests(options = {}) {
    console.log('🧪 Running unit tests...');
    
    const { watch = false, verbose = false } = options;
    
    try {
      const command = watch 
        ? 'npm run test:unit:watch'
        : 'npm run test:unit';
      
      const result = this.executeCommand(command, { verbose });
      
      if (result.success) {
        console.log('✅ Unit tests passed');
        this.testResults.unit.passed++;
      } else {
        console.log('❌ Unit tests failed');
        this.testResults.unit.failed++;
      }
      
      this.testResults.unit.total++;
    } catch (error) {
      console.error('❌ Unit tests error:', error.message);
      this.testResults.unit.failed++;
      this.testResults.unit.total++;
    }
  }

  // ===== INTEGRATION TESTS =====

  async runIntegrationTests(options = {}) {
    console.log('🔗 Running integration tests...');
    
    const { watch = false, verbose = false } = options;
    
    try {
      const command = watch 
        ? 'npm run test:integration:watch'
        : 'npm run test:integration';
      
      const result = this.executeCommand(command, { verbose });
      
      if (result.success) {
        console.log('✅ Integration tests passed');
        this.testResults.integration.passed++;
      } else {
        console.log('❌ Integration tests failed');
        this.testResults.integration.failed++;
      }
      
      this.testResults.integration.total++;
    } catch (error) {
      console.error('❌ Integration tests error:', error.message);
      this.testResults.integration.failed++;
      this.testResults.integration.total++;
    }
  }

  // ===== E2E TESTS =====

  async runE2ETests(options = {}) {
    console.log('🌐 Running E2E tests...');
    
    const { parallel = true, verbose = false } = options;
    
    try {
      // Start the application for E2E tests
      console.log('🚀 Starting application for E2E tests...');
      const appProcess = this.startApplication();
      
      // Wait for application to be ready
      await this.waitForApplication();
      
      // Run E2E tests
      const command = parallel 
        ? 'npm run test:e2e:parallel'
        : 'npm run test:e2e';
      
      const result = this.executeCommand(command, { verbose });
      
      // Stop the application
      appProcess.kill();
      
      if (result.success) {
        console.log('✅ E2E tests passed');
        this.testResults.e2e.passed++;
      } else {
        console.log('❌ E2E tests failed');
        this.testResults.e2e.failed++;
      }
      
      this.testResults.e2e.total++;
    } catch (error) {
      console.error('❌ E2E tests error:', error.message);
      this.testResults.e2e.failed++;
      this.testResults.e2e.total++;
    }
  }

  // ===== COVERAGE REPORT =====

  async generateCoverageReport() {
    console.log('📊 Generating coverage report...');
    
    try {
      const result = this.executeCommand('npm run test:coverage');
      
      if (result.success) {
        const coverage = this.parseCoverageReport();
        this.testResults.coverage = coverage;
        console.log(`✅ Coverage: ${coverage.percentage}% (threshold: ${coverage.threshold}%)`);
        
        if (coverage.percentage < coverage.threshold) {
          console.log('⚠️  Coverage below threshold!');
        }
      } else {
        console.log('❌ Coverage report generation failed');
      }
    } catch (error) {
      console.error('❌ Coverage error:', error.message);
    }
  }

  // ===== PERFORMANCE TESTS =====

  async runPerformanceTests() {
    console.log('⚡ Running performance tests...');
    
    try {
      const result = this.executeCommand('npm run test:performance');
      
      if (result.success) {
        console.log('✅ Performance tests passed');
      } else {
        console.log('❌ Performance tests failed');
      }
    } catch (error) {
      console.error('❌ Performance tests error:', error.message);
    }
  }

  // ===== LOAD TESTS =====

  async runLoadTests() {
    console.log('🔥 Running load tests...');
    
    try {
      const result = this.executeCommand('npm run test:load');
      
      if (result.success) {
        console.log('✅ Load tests passed');
      } else {
        console.log('❌ Load tests failed');
      }
    } catch (error) {
      console.error('❌ Load tests error:', error.message);
    }
  }

  // ===== SECURITY TESTS =====

  async runSecurityTests() {
    console.log('🔒 Running security tests...');
    
    try {
      const result = this.executeCommand('npm run test:security');
      
      if (result.success) {
        console.log('✅ Security tests passed');
      } else {
        console.log('❌ Security tests failed');
      }
    } catch (error) {
      console.error('❌ Security tests error:', error.message);
    }
  }

  // ===== UTILITY METHODS =====

  executeCommand(command, options = {}) {
    const { verbose = false } = options;
    
    try {
      const output = execSync(command, {
        cwd: this.projectRoot,
        stdio: verbose ? 'inherit' : 'pipe',
        encoding: 'utf8',
      });
      
      return { success: true, output };
    } catch (error) {
      if (verbose) {
        console.error('Command failed:', error.message);
      }
      return { success: false, error: error.message };
    }
  }

  startApplication() {
    return spawn('npm', ['run', 'dev'], {
      cwd: this.projectRoot,
      stdio: 'pipe',
    });
  }

  async waitForApplication(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch('http://localhost:3000/api/health');
        if (response.ok) {
          console.log('✅ Application is ready');
          return;
        }
      } catch (error) {
        // Application not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Application failed to start within timeout');
  }

  parseCoverageReport() {
    try {
      const coveragePath = path.join(this.projectRoot, 'coverage', 'coverage-summary.json');
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      
      const total = coverageData.total;
      const percentage = Math.round(
        (total.lines.pct + total.functions.pct + total.branches.pct + total.statements.pct) / 4
      );
      
      return {
        percentage,
        threshold: 80,
        details: total,
      };
    } catch (error) {
      return { percentage: 0, threshold: 80 };
    }
  }

  printTestSummary() {
    console.log('\n📋 Test Summary:');
    console.log('================');
    
    const { unit, integration, e2e, coverage } = this.testResults;
    
    console.log(`🧪 Unit Tests: ${unit.passed}/${unit.total} passed`);
    console.log(`🔗 Integration Tests: ${integration.passed}/${integration.total} passed`);
    console.log(`🌐 E2E Tests: ${e2e.passed}/${e2e.total} passed`);
    console.log(`📊 Coverage: ${coverage.percentage}% (threshold: ${coverage.threshold}%)`);
    
    const totalPassed = unit.passed + integration.passed + e2e.passed;
    const totalTests = unit.total + integration.total + e2e.total;
    
    console.log(`\n🎯 Overall: ${totalPassed}/${totalTests} test suites passed`);
    
    if (totalPassed === totalTests && coverage.percentage >= coverage.threshold) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('❌ Some tests failed or coverage below threshold');
      process.exit(1);
    }
  }

  // ===== TEST DATA SETUP =====

  async setupTestData() {
    console.log('🔧 Setting up test data...');
    
    try {
      // Create test database
      await this.executeCommand('npm run db:test:setup');
      
      // Seed test data
      await this.executeCommand('npm run db:test:seed');
      
      console.log('✅ Test data setup complete');
    } catch (error) {
      console.error('❌ Test data setup failed:', error.message);
      throw error;
    }
  }

  async cleanupTestData() {
    console.log('🧹 Cleaning up test data...');
    
    try {
      // Clean test database
      await this.executeCommand('npm run db:test:cleanup');
      
      console.log('✅ Test data cleanup complete');
    } catch (error) {
      console.error('❌ Test data cleanup failed:', error.message);
    }
  }

  // ===== CONTINUOUS TESTING =====

  async runContinuousTests() {
    console.log('🔄 Starting continuous testing...');
    
    const testFiles = this.getTestFiles();
    
    for (const file of testFiles) {
      console.log(`🧪 Running tests for ${file}...`);
      
      try {
        const result = this.executeCommand(`npm run test:file ${file}`);
        
        if (result.success) {
          console.log(`✅ ${file} passed`);
        } else {
          console.log(`❌ ${file} failed`);
        }
      } catch (error) {
        console.error(`❌ ${file} error:`, error.message);
      }
    }
  }

  getTestFiles() {
    const testDir = path.join(this.projectRoot, 'src', '__tests__');
    const files = [];
    
    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (item.endsWith('.test.ts') || item.endsWith('.spec.ts')) {
          files.push(fullPath);
        }
      }
    };
    
    walkDir(testDir);
    return files;
  }
}

// ===== CLI INTERFACE =====

if (require.main === module) {
  const args = process.argv.slice(2);
  const automation = new TestAutomation();
  
  const command = args[0] || 'all';
  const options = {
    unit: !args.includes('--no-unit'),
    integration: !args.includes('--no-integration'),
    e2e: !args.includes('--no-e2e'),
    coverage: !args.includes('--no-coverage'),
    watch: args.includes('--watch'),
    parallel: !args.includes('--no-parallel'),
    verbose: args.includes('--verbose'),
  };
  
  switch (command) {
    case 'all':
      automation.runAllTests(options);
      break;
    case 'unit':
      automation.runUnitTests(options);
      break;
    case 'integration':
      automation.runIntegrationTests(options);
      break;
    case 'e2e':
      automation.runE2ETests(options);
      break;
    case 'coverage':
      automation.generateCoverageReport();
      break;
    case 'performance':
      automation.runPerformanceTests();
      break;
    case 'load':
      automation.runLoadTests();
      break;
    case 'security':
      automation.runSecurityTests();
      break;
    case 'continuous':
      automation.runContinuousTests();
      break;
    case 'setup':
      automation.setupTestData();
      break;
    case 'cleanup':
      automation.cleanupTestData();
      break;
    default:
      console.log('Usage: node test-automation.js [command] [options]');
      console.log('Commands: all, unit, integration, e2e, coverage, performance, load, security, continuous, setup, cleanup');
      console.log('Options: --no-unit, --no-integration, --no-e2e, --no-coverage, --watch, --no-parallel, --verbose');
      break;
  }
}

module.exports = TestAutomation;
