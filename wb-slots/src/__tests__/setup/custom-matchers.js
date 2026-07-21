// ===== CUSTOM JEST MATCHERS =====

import { expect } from '@jest/globals';

// Custom matcher for checking if a value is a valid UUID
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a date is within a range
expect.extend({
  toBeWithinDateRange(received, startDate, endDate) {
    const receivedDate = new Date(received);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const pass = receivedDate >= start && receivedDate <= end;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be within date range ${startDate} - ${endDate}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within date range ${startDate} - ${endDate}`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a number is within a percentage range
expect.extend({
  toBeWithinPercentage(received, expected, tolerance = 5) {
    const percentage = Math.abs((received - expected) / expected) * 100;
    const pass = percentage <= tolerance;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be within ${tolerance}% of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within ${tolerance}% of ${expected} (actual difference: ${percentage.toFixed(2)}%)`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if an array contains objects with specific properties
expect.extend({
  toContainObjectsWithProperties(received, properties) {
    if (!Array.isArray(received)) {
      return {
        message: () => `expected ${received} to be an array`,
        pass: false,
      };
    }
    
    const pass = received.every(item => 
      Object.keys(properties).every(key => 
        item.hasOwnProperty(key) && item[key] === properties[key]
      )
    );
    
    if (pass) {
      return {
        message: () => `expected array not to contain objects with properties ${JSON.stringify(properties)}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected array to contain objects with properties ${JSON.stringify(properties)}`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a string is a valid email
expect.extend({
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a string is a valid URL
expect.extend({
  toBeValidURL(received) {
    try {
      new URL(received);
      return {
        message: () => `expected ${received} not to be a valid URL`,
        pass: true,
      };
    } catch {
      return {
        message: () => `expected ${received} to be a valid URL`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid coefficient (0-10 range)
expect.extend({
  toBeValidCoefficient(received) {
    const pass = typeof received === 'number' && received >= 0 && received <= 10;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid coefficient (0-10)`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid coefficient (0-10)`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid warehouse ID
expect.extend({
  toBeValidWarehouseId(received) {
    const pass = typeof received === 'number' && received > 0 && received < 1000000;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid warehouse ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid warehouse ID`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid box type ID
expect.extend({
  toBeValidBoxTypeId(received) {
    const validBoxTypes = [1, 2, 3, 4, 5];
    const pass = validBoxTypes.includes(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid box type ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid box type ID (1, 2, 3, 4, or 5)`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid date string
expect.extend({
  toBeValidDateString(received) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && received.match(/^\d{4}-\d{2}-\d{2}$/);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid date string (YYYY-MM-DD)`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid date string (YYYY-MM-DD)`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid time slot
expect.extend({
  toBeValidTimeSlot(received) {
    const timeSlotRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
    const pass = timeSlotRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid time slot (HH:MM-HH:MM)`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid time slot (HH:MM-HH:MM)`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid cron expression
expect.extend({
  toBeValidCronExpression(received) {
    const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([012]?\d|3[01])) (\*|([0]?\d|1[0-2])) (\*|([0-6]))$/;
    const pass = cronRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid cron expression`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid cron expression`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid encrypted string
expect.extend({
  toBeValidEncryptedString(received) {
    const pass = typeof received === 'string' && received.startsWith('encrypted_') && received.length > 20;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid encrypted string`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid encrypted string`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid session ID
expect.extend({
  toBeValidSessionId(received) {
    const pass = typeof received === 'string' && received.length > 10 && received.includes('session');
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid session ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid session ID`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid task status
expect.extend({
  toBeValidTaskStatus(received) {
    const validStatuses = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'];
    const pass = validStatuses.includes(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid task status`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid task status (${validStatuses.join(', ')})`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid log level
expect.extend({
  toBeValidLogLevel(received) {
    const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const pass = validLevels.includes(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid log level`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid log level (${validLevels.join(', ')})`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid API response
expect.extend({
  toBeValidAPIResponse(received) {
    const pass = received && 
                 typeof received === 'object' && 
                 typeof received.success === 'boolean' &&
                 (received.success ? received.data !== undefined : received.error !== undefined);
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid API response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid API response`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid slot object
expect.extend({
  toBeValidSlot(received) {
    const pass = received &&
                 typeof received === 'object' &&
                 typeof received.id === 'string' &&
                 typeof received.warehouseId === 'number' &&
                 typeof received.boxTypeId === 'number' &&
                 typeof received.coefficient === 'number' &&
                 typeof received.date === 'string' &&
                 typeof received.isAvailable === 'boolean';
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid slot object`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid slot object`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid user object
expect.extend({
  toBeValidUser(received) {
    const pass = received &&
                 typeof received === 'object' &&
                 typeof received.id === 'string' &&
                 typeof received.email === 'string' &&
                 typeof received.name === 'string' &&
                 received.email.includes('@');
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid user object`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid user object`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid task object
expect.extend({
  toBeValidTask(received) {
    const pass = received &&
                 typeof received === 'object' &&
                 typeof received.id === 'string' &&
                 typeof received.userId === 'string' &&
                 typeof received.name === 'string' &&
                 typeof received.isActive === 'boolean' &&
                 Array.isArray(received.warehouseIds);
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid task object`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid task object`,
        pass: false,
      };
    }
  },
});

// Custom matcher for checking if a value is a valid session object
expect.extend({
  toBeValidSession(received) {
    const pass = received &&
                 typeof received === 'object' &&
                 typeof received.id === 'string' &&
                 typeof received.userId === 'string' &&
                 typeof received.sessionId === 'string' &&
                 typeof received.isActive === 'boolean' &&
                 received.expiresAt instanceof Date;
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid session object`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid session object`,
        pass: false,
      };
    }
  },
});

// Export all custom matchers
const customMatchers = {
  toBeValidUUID: expect.toBeValidUUID,
  toBeWithinDateRange: expect.toBeWithinDateRange,
  toBeWithinPercentage: expect.toBeWithinPercentage,
  toContainObjectsWithProperties: expect.toContainObjectsWithProperties,
  toBeValidEmail: expect.toBeValidEmail,
  toBeValidURL: expect.toBeValidURL,
  toBeValidCoefficient: expect.toBeValidCoefficient,
  toBeValidWarehouseId: expect.toBeValidWarehouseId,
  toBeValidBoxTypeId: expect.toBeValidBoxTypeId,
  toBeValidDateString: expect.toBeValidDateString,
  toBeValidTimeSlot: expect.toBeValidTimeSlot,
  toBeValidCronExpression: expect.toBeValidCronExpression,
  toBeValidEncryptedString: expect.toBeValidEncryptedString,
  toBeValidSessionId: expect.toBeValidSessionId,
  toBeValidTaskStatus: expect.toBeValidTaskStatus,
  toBeValidLogLevel: expect.toBeValidLogLevel,
  toBeValidAPIResponse: expect.toBeValidAPIResponse,
  toBeValidSlot: expect.toBeValidSlot,
  toBeValidUser: expect.toBeValidUser,
  toBeValidTask: expect.toBeValidTask,
  toBeValidSession: expect.toBeValidSession,
};

export default customMatchers;
