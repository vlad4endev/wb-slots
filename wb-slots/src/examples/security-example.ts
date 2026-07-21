// ===== SECURITY SERVICES USAGE EXAMPLE =====

import { 
  AdvancedEncryptionService,
  TwoFactorAuthService,
  SecurityAuditService,
  AdvancedInputValidationService,
  SecurityMiddleware,
  createSecurityServices
} from '@/lib/security';

// ===== ENCRYPTION EXAMPLE =====

async function encryptionExample() {
  console.log('🔐 Encryption Example');
  
  const encryptionService = AdvancedEncryptionService.getInstance();
  
  // Encrypt sensitive data
  const sensitiveData = 'WB API Token: wb_1234567890abcdef';
  const encrypted = await encryptionService.encrypt(sensitiveData);
  
  console.log('Encrypted data:', encrypted);
  
  // Decrypt data
  const decrypted = await encryptionService.decrypt(encrypted);
  console.log('Decrypted data:', decrypted);
  
  // Check key strength
  const keyValidation = await encryptionService.validateKeyStrength('my-strong-password-123!');
  console.log('Key validation:', keyValidation);
  
  // Generate secure password
  const securePassword = encryptionService.generateSecurePassword(16);
  console.log('Secure password:', securePassword);
}

// ===== TWO-FACTOR AUTHENTICATION EXAMPLE =====

async function twoFactorExample() {
  console.log('🔐 Two-Factor Authentication Example');
  
  const twoFactorService = TwoFactorAuthService.getInstance();
  const userId = 'user123';
  
  // Setup 2FA for user
  const setup = await twoFactorService.setupTwoFactor(userId);
  console.log('2FA Setup:', {
    qrCodeUrl: setup.qrCodeUrl,
    backupCodes: setup.backupCodes,
    manualEntryKey: setup.manualEntryKey
  });
  
  // Enable 2FA (after user scans QR code and provides verification token)
  const verificationToken = '123456'; // This would come from user's authenticator app
  const enabled = await twoFactorService.enableTwoFactor(userId, verificationToken);
  console.log('2FA Enabled:', enabled);
  
  // Verify 2FA token
  const token = '654321'; // This would come from user's authenticator app
  const verification = await twoFactorService.verifyTwoFactor(userId, token);
  console.log('2FA Verification:', verification);
  
  // Check 2FA status
  const status = twoFactorService.getTwoFactorStatus(userId);
  console.log('2FA Status:', status);
}

// ===== SECURITY AUDIT EXAMPLE =====

async function securityAuditExample() {
  console.log('🛡️ Security Audit Example');
  
  const auditService = SecurityAuditService.getInstance();
  
  // Log security events
  await auditService.logEvent({
    type: 'LOGIN_SUCCESS',
    severity: 'LOW',
    userId: 'user123',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    resource: '/api/auth/login',
    action: 'POST',
    details: { loginMethod: 'password' }
  });
  
  await auditService.logEvent({
    type: 'LOGIN_FAILED',
    severity: 'MEDIUM',
    userId: 'user123',
    ipAddress: '192.168.1.100',
    resource: '/api/auth/login',
    action: 'POST',
    details: { reason: 'Invalid password', attemptCount: 3 }
  });
  
  // Get security metrics
  const metrics = auditService.getSecurityMetrics({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date()
  });
  console.log('Security Metrics:', metrics);
  
  // Check for blocked IPs
  const isBlocked = auditService.isIPBlocked('192.168.1.100');
  console.log('IP Blocked:', isBlocked);
  
  // Check for locked users
  const isLocked = auditService.isUserLocked('user123');
  console.log('User Locked:', isLocked);
}

// ===== INPUT VALIDATION EXAMPLE =====

async function inputValidationExample() {
  console.log('✅ Input Validation Example');
  
  const validationService = AdvancedInputValidationService.getInstance();
  
  // Define validation rules
  const rules = {
    email: {
      type: 'email' as const,
      required: true,
      sanitize: true
    },
    password: {
      type: 'password' as const,
      required: true,
      minLength: 8,
      maxLength: 128
    },
    age: {
      type: 'number' as const,
      required: true,
      customValidator: (value: any) => {
        const num = Number(value);
        if (num < 18 || num > 120) {
          return 'Age must be between 18 and 120';
        }
        return true;
      }
    },
    website: {
      type: 'url' as const,
      required: false,
      sanitize: true
    },
    phone: {
      type: 'phone' as const,
      required: false
    }
  };
  
  // Test data
  const testData = {
    email: 'user@example.com',
    password: 'MySecurePassword123!',
    age: 25,
    website: 'https://example.com',
    phone: '+1234567890'
  };
  
  // Validate input
  const result = await validationService.validateInput(testData, rules);
  
  console.log('Validation Result:', {
    isValid: result.isValid,
    errors: result.errors,
    sanitizedValue: result.sanitizedValue,
    warnings: result.warnings
  });
  
  // Test malicious input
  const maliciousData = {
    email: 'user@example.com<script>alert("xss")</script>',
    password: 'weak',
    age: 15,
    website: 'javascript:alert("xss")',
    phone: '123'
  };
  
  const maliciousResult = await validationService.validateInput(maliciousData, rules);
  console.log('Malicious Input Result:', {
    isValid: maliciousResult.isValid,
    errors: maliciousResult.errors
  });
}

// ===== SECURITY MIDDLEWARE EXAMPLE =====

async function securityMiddlewareExample() {
  console.log('🛡️ Security Middleware Example');
  
  const securityMiddleware = SecurityMiddleware.getInstance();
  
  // Configure security middleware
  securityMiddleware.updateConfig({
    enableInputValidation: true,
    enableSecurityAudit: true,
    enableTwoFactorCheck: true,
    requireTwoFactor: ['/api/admin', '/api/settings'],
    validationRules: {
      '/api/users': {
        name: { type: 'string', required: true, maxLength: 100 },
        email: { type: 'email', required: true }
      }
    }
  });
  
  // Add custom validation rule
  securityMiddleware.addValidationRule('/api/products', {
    name: { type: 'string', required: true, maxLength: 200 },
    price: { type: 'number', required: true, customValidator: (value: any) => {
      const num = Number(value);
      return num > 0 ? true : 'Price must be greater than 0';
    }},
    description: { type: 'string', required: false, maxLength: 1000, sanitize: true }
  });
  
  console.log('Security middleware configured');
}

// ===== COMPREHENSIVE SECURITY EXAMPLE =====

async function comprehensiveSecurityExample() {
  console.log('🔐 Comprehensive Security Example');
  
  // Create all security services
  const services = createSecurityServices();
  
  // 1. Setup user with 2FA
  const userId = 'user456';
  const twoFactorSetup = await services.twoFactor.setupTwoFactor(userId);
  console.log('2FA Setup completed');
  
  // 2. Encrypt user data
  const userData = {
    apiKey: 'wb_api_key_123456',
    personalInfo: 'John Doe, 123 Main St'
  };
  
  const encryptedApiKey = await services.encryption.encrypt(userData.apiKey);
  const encryptedPersonalInfo = await services.encryption.encrypt(userData.personalInfo);
  
  console.log('User data encrypted');
  
  // 3. Validate user input
  const inputRules = {
    name: { type: 'string', required: true, maxLength: 100, sanitize: true },
    email: { type: 'email', required: true },
    apiKey: { type: 'string', required: true, minLength: 20 }
  };
  
  const userInput = {
    name: 'John Doe',
    email: 'john@example.com',
    apiKey: 'wb_api_key_123456'
  };
  
  const validationResult = await services.validation.validateInput(userInput, inputRules);
  console.log('Input validation result:', validationResult.isValid);
  
  // 4. Log security events
  await services.audit.logEvent({
    type: 'TWO_FACTOR_ENABLED',
    severity: 'MEDIUM',
    userId,
    ipAddress: '192.168.1.200',
    resource: '/api/security/2fa',
    action: 'ENABLE',
    details: { method: 'TOTP' }
  });
  
  await services.audit.logEvent({
    type: 'DATA_ACCESS',
    severity: 'LOW',
    userId,
    ipAddress: '192.168.1.200',
    resource: '/api/user/profile',
    action: 'READ',
    details: { dataType: 'personal_info' }
  });
  
  console.log('Security events logged');
  
  // 5. Get security metrics
  const metrics = services.audit.getSecurityMetrics({
    start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
    end: new Date()
  });
  
  console.log('Security metrics:', {
    totalEvents: metrics.totalEvents,
    eventsBySeverity: metrics.eventsBySeverity,
    topUsers: metrics.topUsers.slice(0, 3)
  });
}

// ===== MAIN EXECUTION =====

async function runSecurityExamples() {
  try {
    console.log('🚀 Starting Security Services Examples\n');
    
    await encryptionExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await twoFactorExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await securityAuditExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await inputValidationExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await securityMiddlewareExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await comprehensiveSecurityExample();
    
    console.log('\n✅ All security examples completed successfully!');
  } catch (error) {
    console.error('❌ Security examples failed:', error);
  }
}

// Export for use in other modules
export {
  encryptionExample,
  twoFactorExample,
  securityAuditExample,
  inputValidationExample,
  securityMiddlewareExample,
  comprehensiveSecurityExample,
  runSecurityExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runSecurityExamples();
}
