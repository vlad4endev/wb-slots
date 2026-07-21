// ===== ADVANCED INPUT VALIDATION SERVICE =====

import { Logger } from '../logging/logger';
// Note: These packages need to be installed
// npm install validator xss isomorphic-dompurify
// npm install --save-dev @types/validator

// For now, we'll use basic implementations
const validator = {
  isEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  isURL: (url: string) => {
    try { new URL(url); return true; } catch { return false; }
  },
  isMobilePhone: (phone: string) => /^\+?[\d\s\-\(\)]+$/.test(phone),
  isISO8601: (date: string) => !isNaN(Date.parse(date)),
  isUUID: (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid),
  isIP: (ip: string) => /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip),
  isCreditCard: (card: string) => /^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/.test(card.replace(/\s/g, '')),
  isNumeric: (str: string) => /^\d+$/.test(str)
};

const xss = (str: string, options?: any) => {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

const DOMPurify = {
  sanitize: (str: string, options?: any) => {
    if (options?.ALLOWED_TAGS?.length > 0) {
      // Basic HTML tag filtering
      return str.replace(/<(?!(?:b|i|em|strong|p|br)\b)[^>]*>/gi, '');
    }
    return xss(str);
  }
};

// ===== INTERFACES =====

export interface ValidationRule {
  type: ValidationType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
  sanitize?: boolean;
  allowHtml?: boolean;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  allowedValues?: any[];
  transform?: (value: any) => any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedValue?: any;
  warnings: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface SecurityValidationConfig {
  enableXSSProtection: boolean;
  enableSQLInjectionProtection: boolean;
  enableCSRFProtection: boolean;
  enableFileUploadValidation: boolean;
  enableInputSanitization: boolean;
  maxInputLength: number;
  allowedHtmlTags: string[];
  blockedPatterns: RegExp[];
  customValidators: Map<string, (value: any) => boolean | string>;
}

export type ValidationType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'email'
  | 'url'
  | 'phone'
  | 'date'
  | 'uuid'
  | 'json'
  | 'array'
  | 'object'
  | 'file'
  | 'password'
  | 'creditCard'
  | 'ip'
  | 'mac'
  | 'base64'
  | 'hex'
  | 'alphanumeric'
  | 'numeric'
  | 'alpha'
  | 'custom';

// ===== ADVANCED INPUT VALIDATION SERVICE =====

export class AdvancedInputValidationService {
  private static instance: AdvancedInputValidationService;
  private logger: Logger;
  private config: SecurityValidationConfig;
  private xssOptions: any;
  private blockedPatterns: RegExp[] = [];

  private constructor() {
    this.logger = new Logger('INFO', { context: 'AdvancedInputValidationService' });
    
    this.config = {
      enableXSSProtection: true,
      enableSQLInjectionProtection: true,
      enableCSRFProtection: true,
      enableFileUploadValidation: true,
      enableInputSanitization: true,
      maxInputLength: 10000,
      allowedHtmlTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
      blockedPatterns: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe\b[^>]*>/gi,
        /<object\b[^>]*>/gi,
        /<embed\b[^>]*>/gi,
        /<link\b[^>]*>/gi,
        /<meta\b[^>]*>/gi,
        /<style\b[^>]*>/gi,
        /expression\s*\(/gi,
        /url\s*\(/gi,
        /@import/gi
      ],
      customValidators: new Map()
    };

    this.xssOptions = {
      allowList: {
        b: [],
        i: [],
        em: [],
        strong: [],
        p: [],
        br: []
      },
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style']
    };

    this.initializeBlockedPatterns();
  }

  public static getInstance(): AdvancedInputValidationService {
    if (!AdvancedInputValidationService.instance) {
      AdvancedInputValidationService.instance = new AdvancedInputValidationService();
    }
    return AdvancedInputValidationService.instance;
  }

  // ===== MAIN VALIDATION METHOD =====

  async validateInput(
    data: Record<string, any>,
    rules: Record<string, ValidationRule>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const sanitizedData: Record<string, any> = {};

    try {
      for (const [field, value] of Object.entries(data)) {
        const rule = rules[field];
        if (!rule) {
          warnings.push(`No validation rule defined for field: ${field}`);
          sanitizedData[field] = value;
          continue;
        }

        const fieldResult = await this.validateField(field, value, rule);
        
        if (!fieldResult.isValid) {
          errors.push(...fieldResult.errors);
        }
        
        warnings.push(...fieldResult.warnings);
        sanitizedData[field] = fieldResult.sanitizedValue !== undefined 
          ? fieldResult.sanitizedValue 
          : value;
      }

      // Additional security checks
      if (this.config.enableXSSProtection) {
        const xssResult = this.checkForXSS(data);
        if (!xssResult.isValid) {
          errors.push(...xssResult.errors);
        }
      }

      if (this.config.enableSQLInjectionProtection) {
        const sqlResult = this.checkForSQLInjection(data);
        if (!sqlResult.isValid) {
          errors.push(...sqlResult.errors);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedValue: sanitizedData,
        warnings
      };
    } catch (error) {
      this.logger.error('❌ Validation failed', { error });
      return {
        isValid: false,
        errors: [{
          field: 'system',
          message: 'Validation system error',
          code: 'VALIDATION_ERROR'
        }],
        warnings
      };
    }
  }

  // ===== FIELD VALIDATION =====

  private async validateField(
    field: string,
    value: any,
    rule: ValidationRule
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let sanitizedValue = value;

    try {
      // Required check
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED',
          value
        });
        return { isValid: false, errors, warnings };
      }

      // Skip validation if value is empty and not required
      if (!rule.required && (value === undefined || value === null || value === '')) {
        return { isValid: true, errors, warnings, sanitizedValue };
      }

      // Type validation
      const typeResult = this.validateType(field, value, rule.type);
      if (!typeResult.isValid) {
        errors.push(...typeResult.errors);
        return { isValid: false, errors, warnings };
      }

      // Sanitization
      if (rule.sanitize && typeof value === 'string') {
        sanitizedValue = this.sanitizeValue(value, rule);
      }

      // Length validation
      if (typeof sanitizedValue === 'string') {
        if (rule.minLength && sanitizedValue.length < rule.minLength) {
          errors.push({
            field,
            message: `${field} must be at least ${rule.minLength} characters`,
            code: 'MIN_LENGTH',
            value: sanitizedValue
          });
        }

        if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
          errors.push({
            field,
            message: `${field} must be no more than ${rule.maxLength} characters`,
            code: 'MAX_LENGTH',
            value: sanitizedValue
          });
        }
      }

      // Pattern validation
      if (rule.pattern && typeof sanitizedValue === 'string') {
        if (!rule.pattern.test(sanitizedValue)) {
          errors.push({
            field,
            message: `${field} format is invalid`,
            code: 'PATTERN_MISMATCH',
            value: sanitizedValue
          });
        }
      }

      // Allowed values validation
      if (rule.allowedValues && !rule.allowedValues.includes(sanitizedValue)) {
        errors.push({
          field,
          message: `${field} must be one of: ${rule.allowedValues.join(', ')}`,
          code: 'INVALID_VALUE',
          value: sanitizedValue
        });
      }

      // Custom validation
      if (rule.customValidator) {
        const customResult = rule.customValidator(sanitizedValue);
        if (customResult !== true) {
          errors.push({
            field,
            message: typeof customResult === 'string' ? customResult : `${field} validation failed`,
            code: 'CUSTOM_VALIDATION',
            value: sanitizedValue
          });
        }
      }

      // Transform value
      if (rule.transform) {
        sanitizedValue = rule.transform(sanitizedValue);
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedValue,
        warnings
      };
    } catch (error) {
      this.logger.error('❌ Field validation failed', { error, field, value });
      return {
        isValid: false,
        errors: [{
          field,
          message: 'Field validation error',
          code: 'VALIDATION_ERROR',
          value
        }],
        warnings
      };
    }
  }

  // ===== TYPE VALIDATION =====

  private validateType(field: string, value: any, type: ValidationType): ValidationResult {
    const errors: ValidationError[] = [];

    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({
            field,
            message: `${field} must be a string`,
            code: 'INVALID_TYPE',
            value
          });
        }
        break;

      case 'number':
        if (typeof value !== 'number' && !validator.isNumeric(String(value))) {
          errors.push({
            field,
            message: `${field} must be a number`,
            code: 'INVALID_TYPE',
            value
          });
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push({
            field,
            message: `${field} must be a boolean`,
            code: 'INVALID_TYPE',
            value
          });
        }
        break;

      case 'email':
        if (!validator.isEmail(String(value))) {
          errors.push({
            field,
            message: `${field} must be a valid email address`,
            code: 'INVALID_EMAIL',
            value
          });
        }
        break;

      case 'url':
        if (!validator.isURL(String(value))) {
          errors.push({
            field,
            message: `${field} must be a valid URL`,
            code: 'INVALID_URL',
            value
          });
        }
        break;

      case 'phone':
        if (!validator.isMobilePhone(String(value))) {
          errors.push({
            field,
            message: `${field} must be a valid phone number`,
            code: 'INVALID_PHONE',
            value
          });
        }
        break;

      case 'date':
        if (!validator.isISO8601(String(value)) && !(value instanceof Date)) {
          errors.push({
            field,
            message: `${field} must be a valid date`,
            code: 'INVALID_DATE',
            value
          });
        }
        break;

      case 'uuid':
        if (!validator.isUUID(String(value))) {
          errors.push({
            field,
            message: `${field} must be a valid UUID`,
            code: 'INVALID_UUID',
            value
          });
        }
        break;

      case 'json':
        try {
          JSON.parse(String(value));
        } catch {
          errors.push({
            field,
            message: `${field} must be valid JSON`,
            code: 'INVALID_JSON',
            value
          });
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push({
            field,
            message: `${field} must be an array`,
            code: 'INVALID_TYPE',
            value
          });
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          errors.push({
            field,
            message: `${field} must be an object`,
            code: 'INVALID_TYPE',
            value
          });
        }
        break;

      case 'password':
        if (!this.isStrongPassword(String(value))) {
          errors.push({
            field,
            message: `${field} must be a strong password (min 8 chars, uppercase, lowercase, number, special char)`,
            code: 'WEAK_PASSWORD',
            value
          });
        }
        break;

      case 'ip':
        if (!validator.isIP(String(value))) {
          errors.push({
            field,
            message: `${field} must be a valid IP address`,
            code: 'INVALID_IP',
            value
          });
        }
        break;

      case 'creditCard':
        if (!validator.isCreditCard(String(value))) {
          errors.push({
            field,
            message: `${field} must be a valid credit card number`,
            code: 'INVALID_CREDIT_CARD',
            value
          });
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: value,
      warnings: []
    };
  }

  // ===== SANITIZATION =====

  private sanitizeValue(value: string, rule: ValidationRule): string {
    let sanitized = value;

    // XSS protection
    if (this.config.enableXSSProtection) {
      if (rule.allowHtml) {
        sanitized = DOMPurify.sanitize(sanitized, {
          ALLOWED_TAGS: rule.allowHtml ? this.config.allowedHtmlTags : [],
          ALLOWED_ATTR: []
        });
      } else {
        sanitized = xss(sanitized, this.xssOptions);
      }
    }

    // Trim whitespace
    sanitized = sanitized.trim();

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Normalize unicode
    sanitized = sanitized.normalize('NFC');

    return sanitized;
  }

  // ===== SECURITY CHECKS =====

  private checkForXSS(data: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];

    for (const [field, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        for (const pattern of this.blockedPatterns) {
          if (pattern.test(value)) {
            errors.push({
              field,
              message: `Potential XSS attack detected in ${field}`,
              code: 'XSS_DETECTED',
              value
            });
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  private checkForSQLInjection(data: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|\#|\/\*|\*\/)/g,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
      /(\b(OR|AND)\s+['"]\s*=\s*['"])/gi,
      /(\bUNION\s+SELECT\b)/gi,
      /(\bDROP\s+TABLE\b)/gi,
      /(\bINSERT\s+INTO\b)/gi,
      /(\bDELETE\s+FROM\b)/gi
    ];

    for (const [field, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        for (const pattern of sqlPatterns) {
          if (pattern.test(value)) {
            errors.push({
              field,
              message: `Potential SQL injection detected in ${field}`,
              code: 'SQL_INJECTION_DETECTED',
              value
            });
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  // ===== UTILITY METHODS =====

  private isStrongPassword(password: string): boolean {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return password.length >= minLength && 
           hasUpperCase && 
           hasLowerCase && 
           hasNumbers && 
           hasSpecialChar;
  }

  private initializeBlockedPatterns(): void {
    this.blockedPatterns = [
      ...this.config.blockedPatterns,
      // Additional security patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript\s*:/gi,
      /vbscript\s*:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /<link[^>]*>/gi,
      /<meta[^>]*>/gi,
      /<style[^>]*>/gi,
      /expression\s*\(/gi,
      /url\s*\(/gi,
      /@import/gi,
      /eval\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /Function\s*\(/gi,
      /document\./gi,
      /window\./gi,
      /location\./gi,
      /history\./gi
    ];
  }

  // ===== CONFIGURATION =====

  addCustomValidator(name: string, validator: (value: any) => boolean | string): void {
    this.config.customValidators.set(name, validator);
  }

  removeCustomValidator(name: string): void {
    this.config.customValidators.delete(name);
  }

  addBlockedPattern(pattern: RegExp): void {
    this.blockedPatterns.push(pattern);
  }

  removeBlockedPattern(pattern: RegExp): void {
    const index = this.blockedPatterns.indexOf(pattern);
    if (index > -1) {
      this.blockedPatterns.splice(index, 1);
    }
  }

  // ===== CLEANUP =====

  cleanup(): void {
    this.config.customValidators.clear();
    this.blockedPatterns = [];
    this.logger.info('🧹 Advanced input validation service cleaned up');
  }
}
