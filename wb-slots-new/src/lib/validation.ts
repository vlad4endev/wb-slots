import { z } from 'zod';

// User validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  timezone: z.string().default('Europe/Moscow'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  timezone: z.string().optional(),
});

// Token validation schemas
export const createTokenSchema = z.object({
  category: z.enum(['STATISTICS', 'SUPPLIES', 'MARKETPLACE', 'CONTENT', 'PROMOTION', 'ANALYTICS', 'FINANCE']),
  token: z.string().min(1, 'Token is required'),
});

export const updateTokenSchema = z.object({
  token: z.string().min(1, 'Token is required').optional(),
  isActive: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return undefined; // optional field
  }).optional(),
});

// Warehouse preferences validation
export const warehousePrefSchema = z.object({
  warehouseId: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num) || num <= 0) {
      throw new Error('Warehouse ID must be a positive number');
    }
    return num;
  }),
  warehouseName: z.string().min(1, 'Warehouse name is required'),
  enabled: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return true; // default
  }).default(true),
  boxAllowed: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return true; // default
  }).default(true),
  monopalletAllowed: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return true; // default
  }).default(true),
  supersafeAllowed: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return true; // default
  }).default(true),
});

// Task validation schemas
export const taskFiltersSchema = z.object({
  coefficientMin: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num) || num < 0 || num > 20) {
      throw new Error('Coefficient must be a number between 0 and 20');
    }
    return num;
  }).default(0),
  coefficientMax: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num) || num < 0 || num > 20) {
      throw new Error('Coefficient must be a number between 0 and 20');
    }
    return num;
  }).default(20),
  allowUnload: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    throw new Error('Allow unload must be a boolean value');
  }).default(true),
  dates: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  boxTypeIds: z.array(
    z.union([z.string(), z.number()]).transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      if (isNaN(num) || num <= 0) {
        throw new Error('Box type ID must be a positive number');
      }
      return num;
    })
  ).default([2, 5]), // По умолчанию: Короба и Монопаллеты
  warehouseIds: z.array(
    z.union([z.string(), z.number()]).transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      if (isNaN(num) || num <= 0) {
        throw new Error('Warehouse ID must be a positive number');
      }
      return num;
    })
  ).min(1, 'At least one warehouse must be selected'),
});

export const retryPolicySchema = z.object({
  maxRetries: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num) || num < 0 || num > 10) {
      throw new Error('Max retries must be a number between 0 and 10');
    }
    return num;
  }).default(3),
  backoffMs: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num) || num < 1000 || num > 60000) {
      throw new Error('Backoff must be a number between 1000 and 60000');
    }
    return num;
  }).default(5000),
});

export const createTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  description: z.string().optional(),
  enabled: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return true; // default
  }).default(true),
  scheduleCron: z.string().optional(),
  autoBook: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return false; // default
  }).default(false),
  autoBookSupplyId: z.string().optional(),
  filters: taskFiltersSchema,
  retryPolicy: retryPolicySchema,
  priority: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num) || num < 0 || num > 10) {
      throw new Error('Priority must be a number between 0 and 10');
    }
    return num;
  }).default(0),
});

export const updateTaskSchema = createTaskSchema.partial();

// Notification channel validation
export const emailNotificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const telegramNotificationSchema = z.object({
  chatId: z.string().min(1, 'Chat ID is required'),
});

export const webhookNotificationSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  secret: z.string().optional(),
});

export const notificationChannelSchema = z.object({
  type: z.enum(['EMAIL', 'TELEGRAM', 'WEBHOOK']),
  config: z.union([emailNotificationSchema, telegramNotificationSchema, webhookNotificationSchema]),
  enabled: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return true; // default
  }).default(true),
});

// API response schemas
export const apiResponseSchema = z.object({
  success: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return false; // default
  }),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num) || num < 1) {
      throw new Error('Page must be a positive number');
    }
    return num;
  }).default(1),
  limit: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num) || num < 1 || num > 100) {
      throw new Error('Limit must be a number between 1 and 100');
    }
    return num;
  }).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Search schemas
export const searchSchema = z.object({
  query: z.string().optional(),
  filters: z.record(z.any()).optional(),
  ...paginationSchema.shape,
});

// WB API specific schemas
export const wbCoefficientSchema = z.object({
  date: z.string(),
  warehouseId: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num)) {
      throw new Error('Warehouse ID must be a number');
    }
    return num;
  }),
  allowUnload: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return false; // default
  }),
  coefficient: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num) || num < 0 || num > 1) {
      throw new Error('Coefficient must be a number between 0 and 1');
    }
    return num;
  }),
});

export const wbWarehouseSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num)) {
      throw new Error('Warehouse ID must be a number');
    }
    return num;
  }),
  name: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
});

export const wbSupplySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  warehouseId: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num)) {
      throw new Error('Warehouse ID must be a number');
    }
    return num;
  }),
  boxTypeId: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num)) {
      throw new Error('Box type ID must be a number');
    }
    return num;
  }),
  supplyDate: z.string().optional(),
  factDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
