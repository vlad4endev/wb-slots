import { z } from 'zod';

/**
 * Схема валидации для warehouse ID
 * Принимает как строку, так и число, и преобразует в число
 */
export const warehouseIdSchema = z.union([z.string(), z.number()]).transform((val) => {
  const num = typeof val === 'string' ? parseInt(val, 10) : val;
  if (isNaN(num)) {
    throw new Error('warehouseId must be a valid number');
  }
  if (num <= 0) {
    throw new Error('warehouseId must be a positive number');
  }
  return num;
});

/**
 * Схема валидации для warehouse ID (опциональная)
 */
export const optionalWarehouseIdSchema = z.union([z.string(), z.number()]).transform((val) => {
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  const num = typeof val === 'string' ? parseInt(val, 10) : val;
  if (isNaN(num)) {
    throw new Error('warehouseId must be a valid number');
  }
  if (num <= 0) {
    throw new Error('warehouseId must be a positive number');
  }
  return num;
}).optional();

/**
 * Схема валидации для одного склада
 */
export const warehouseSchema = z.object({
  warehouseId: warehouseIdSchema,
  warehouseName: z.string().min(1, 'Warehouse name is required'),
  enabled: z.boolean().default(true),
  boxAllowed: z.boolean().default(true),
  monopalletAllowed: z.boolean().default(true),
  supersafeAllowed: z.boolean().default(true),
});

/**
 * Схема валидации для создания складов (один или несколько)
 */
export const createWarehousesSchema = z.object({
  warehouses: z.array(warehouseSchema).optional(),
  warehouseId: optionalWarehouseIdSchema,
  warehouseName: z.string().min(1, 'Warehouse name is required').optional(),
  enabled: z.boolean().optional(),
  boxAllowed: z.boolean().optional(),
  monopalletAllowed: z.boolean().optional(),
  supersafeAllowed: z.boolean().optional(),
});

/**
 * Схема валидации для обновления склада
 */
export const updateWarehouseSchema = z.object({
  warehouseId: warehouseIdSchema,
  enabled: z.boolean(),
});

/**
 * Схема валидации для удаления склада
 */
export const deleteWarehouseSchema = z.object({
  warehouseId: warehouseIdSchema,
});

/**
 * Утилита для преобразования warehouse ID в число
 */
export function parseWarehouseId(value: unknown): number {
  if (typeof value === 'number') {
    if (isNaN(value) || value <= 0) {
      throw new Error('Invalid warehouse ID: must be a positive number');
    }
    return value;
  }
  
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      throw new Error('Invalid warehouse ID: must be a valid positive number');
    }
    return num;
  }
  
  throw new Error('Invalid warehouse ID: must be a string or number');
}

/**
 * Утилита для валидации массива warehouse ID
 */
export function parseWarehouseIds(values: unknown[]): number[] {
  return values.map((value, index) => {
    try {
      return parseWarehouseId(value);
    } catch (error) {
      throw new Error(`Invalid warehouse ID at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Утилита для проверки, является ли значение валидным warehouse ID
 */
export function isValidWarehouseId(value: unknown): value is number {
  try {
    parseWarehouseId(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Утилита для нормализации warehouse данных
 */
export function normalizeWarehouseData(data: any) {
  return {
    warehouseId: parseWarehouseId(data.warehouseId),
    warehouseName: String(data.warehouseName || '').trim(),
    enabled: Boolean(data.enabled ?? true),
    boxAllowed: Boolean(data.boxAllowed ?? true),
    monopalletAllowed: Boolean(data.monopalletAllowed ?? true),
    supersafeAllowed: Boolean(data.supersafeAllowed ?? true),
  };
}

/**
 * Утилита для валидации и нормализации массива warehouse данных
 */
export function normalizeWarehousesData(data: any[]) {
  return data.map((item, index) => {
    try {
      return normalizeWarehouseData(item);
    } catch (error) {
      throw new Error(`Invalid warehouse data at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}
