export interface AutoBookingConfig {
  // Browser settings
  headless: boolean;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  
  // Proxy settings
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  
  // Timeouts and delays
  timeouts: {
    pageLoad: number;
    elementWait: number;
    actionDelay: number;
    screenshotDelay: number;
  };
  
  // Selectors for WB interface
  selectors: {
    // Login page
    login: {
      emailInput: string;
      passwordInput: string;
      loginButton: string;
      captchaIframe?: string;
    };
    
    // Main navigation
    navigation: {
      suppliesMenu: string;
      suppliesLink: string;
    };
    
    // Supplies page
    supplies: {
      supplyRow: string;
      supplyId: string;
      supplyStatus: string;
      selectButton: string;
    };
    
    // Slot selection
    slots: {
      slotRow: string;
      slotDate: string;
      slotTime: string;
      slotCoefficient: string;
      slotButton: string;
    };
    
    // Booking confirmation
    booking: {
      confirmButton: string;
      successMessage: string;
      errorMessage: string;
    };
  };
  
  // Screenshot settings
  screenshots: {
    enabled: boolean;
    path: string;
    onError: boolean;
    onSuccess: boolean;
    onStep: boolean;
  };
  
  // Logging settings
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    console: boolean;
    file: boolean;
    filePath: string;
  };
  
  // Dry run mode
  dryRun: boolean;
}

export const DEFAULT_CONFIG: AutoBookingConfig = {
  headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: {
    width: 1920,
    height: 1080,
  },
  
  timeouts: {
    pageLoad: 30000,
    elementWait: 10000,
    actionDelay: 1000,
    screenshotDelay: 500,
  },
  
  selectors: {
    login: {
      emailInput: 'input[name="email"], input[type="email"]',
      passwordInput: 'input[name="password"], input[type="password"]',
      loginButton: 'button[type="submit"], .login-button, [data-testid="login-button"]',
      captchaIframe: 'iframe[src*="captcha"]',
    },
    
    navigation: {
      suppliesMenu: '.menu-item, .nav-item, [data-testid="supplies-menu"]',
      suppliesLink: 'a[href*="supplies"], a[href*="поставки"]',
    },
    
    supplies: {
      supplyRow: '.supply-row, .table-row, [data-testid="supply-row"]',
      supplyId: '.supply-id, .supply-number, [data-testid="supply-id"]',
      supplyStatus: '.supply-status, .status, [data-testid="supply-status"]',
      selectButton: '.select-supply, .btn-select, [data-testid="select-supply"]',
    },
    
    slots: {
      slotRow: '.slot-row, .time-slot, [data-testid="slot-row"]',
      slotDate: '.slot-date, .date, [data-testid="slot-date"]',
      slotTime: '.slot-time, .time, [data-testid="slot-time"]',
      slotCoefficient: '.coefficient, .coef, [data-testid="coefficient"]',
      slotButton: '.book-slot, .btn-book, [data-testid="book-slot"]',
    },
    
    booking: {
      confirmButton: '.confirm-booking, .btn-confirm, [data-testid="confirm-booking"]',
      successMessage: '.success-message, .booking-success, [data-testid="booking-success"]',
      errorMessage: '.error-message, .booking-error, [data-testid="booking-error"]',
    },
  },
  
  screenshots: {
    enabled: true,
    path: './screenshots',
    onError: true,
    onSuccess: true,
    onStep: false,
  },
  
  logging: {
    level: 'info',
    console: true,
    file: true,
    filePath: './logs/auto-booking.log',
  },
  
  dryRun: false,
};

export interface BookingParams {
  supplyId: string;
  slotFilters: {
    warehouseIds: number[];
    boxTypeIds: number[];
    coefficientMin: number;
    coefficientMax: number;
    dateFrom: string;
    dateTo: string;
  };
  credentials?: {
    email: string;
    password: string;
  };
  cookies?: any[];
}
