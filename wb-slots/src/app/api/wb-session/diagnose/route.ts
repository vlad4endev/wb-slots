import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { chromium } from 'playwright';
import { WBSessionManager, getUnifiedSessionManager } from '@/lib/session';
import { Logger } from '@/lib/logging/logger';

const logger = new Logger('INFO', { service: 'WBSessionDiagnoseAPI' });

/**
 * API для детальной диагностики сессий WB
 */

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { userId } = body;
    const targetUserId = userId || user.id;

    if (!process.env.ENCRYPTION_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Encryption key not configured'
      }, { status: 500 });
    }

    logger.info('🔍 Starting session diagnosis', { userId: targetUserId });

    const sessionManager = getUnifiedSessionManager();
    const diagnosis = await diagnoseSession(targetUserId, sessionManager);

    return NextResponse.json({
      success: true,
      data: diagnosis
    });

  } catch (error) {
    logger.error('WBSession Diagnose API error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Детальная диагностика сессии
 */
async function diagnoseSession(userId: string, sessionManager: WBSessionManager): Promise<any> {
  const diagnosis = {
    userId,
    timestamp: new Date().toISOString(),
    steps: [] as any[],
    summary: {
      overall: 'unknown',
      issues: [] as string[],
      recommendations: [] as string[]
    }
  };

  // Шаг 1: Проверяем наличие в БД
  diagnosis.steps.push({ step: 'database_check', status: 'running' });
  
  const dbSession = await prisma.wBSession.findUnique({
    where: { userId }
  });

  if (!dbSession) {
    diagnosis.steps.push({ 
      step: 'database_check', 
      status: 'failed', 
      message: 'No session found in database' 
    });
    diagnosis.summary.overall = 'failed';
    diagnosis.summary.issues.push('No session found in database');
    diagnosis.summary.recommendations.push('Create new session through authentication');
    return diagnosis;
  }

  diagnosis.steps.push({ 
    step: 'database_check', 
    status: 'success', 
    message: 'Session found in database',
    data: {
      isActive: dbSession.isActive,
      createdAt: dbSession.createdAt,
      lastValidated: dbSession.lastValidated,
      lastUsed: dbSession.lastUsedAt
    }
  });

  // Шаг 2: Проверяем расшифровку
  diagnosis.steps.push({ step: 'decryption_check', status: 'running' });
  
  try {
    const decrypted = sessionManager['decrypt'](dbSession.sessionData);
    const sessionData = JSON.parse(decrypted);
    
    diagnosis.steps.push({ 
      step: 'decryption_check', 
      status: 'success', 
      message: 'Session data decrypted successfully',
      data: {
        cookiesCount: sessionData.cookies.length,
        localStorageKeys: Object.keys(sessionData.localStorage).length,
        sessionStorageKeys: Object.keys(sessionData.sessionStorage).length,
        userAgent: sessionData.userAgent?.substring(0, 50) + '...',
        fingerprint: sessionData.metadata.fingerprint?.substring(0, 8) + '...'
      }
    });
  } catch (error) {
    diagnosis.steps.push({ 
      step: 'decryption_check', 
      status: 'failed', 
      message: `Decryption failed: ${error.message}` 
    });
    diagnosis.summary.overall = 'failed';
    diagnosis.summary.issues.push('Session data corrupted or encryption key mismatch');
    diagnosis.summary.recommendations.push('Check encryption key configuration');
    diagnosis.summary.recommendations.push('Create new session through authentication');
    return diagnosis;
  }

  // Шаг 3: Проверяем восстановление в браузере
  diagnosis.steps.push({ step: 'browser_restoration', status: 'running' });
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-field-trial-config',
      '--disable-back-forward-cache',
      '--disable-ipc-flooding-protection',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-sync-preferences',
      '--disable-translate',
      '--disable-ipc-flooding-protection',
      '--no-default-browser-check',
      '--no-pings',
      '--password-store=basic',
      '--use-mock-keychain',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=TranslateUI',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);

  try {
    const restoration = await sessionManager.restoreSession(userId, page);
    
    if (restoration.isValid) {
      diagnosis.steps.push({ 
        step: 'browser_restoration', 
        status: 'success', 
        message: 'Session restored successfully in browser',
        data: restoration.details
      });
    } else {
      diagnosis.steps.push({ 
        step: 'browser_restoration', 
        status: 'failed', 
        message: `Session restoration failed: ${restoration.reason}`,
        data: {
          reason: restoration.reason,
          suggestions: restoration.suggestions,
          details: restoration.details
        }
      });
      diagnosis.summary.overall = 'failed';
      diagnosis.summary.issues.push(`Session restoration failed: ${restoration.reason}`);
      diagnosis.summary.recommendations.push(...(restoration.suggestions || []));
    }

    // Шаг 4: Детальная проверка авторизации
    diagnosis.steps.push({ step: 'detailed_validation', status: 'running' });
    
    const detailedChecks = await performDetailedValidation(page, sessionManager);
    diagnosis.steps.push({ 
      step: 'detailed_validation', 
      status: detailedChecks.overallValid ? 'success' : 'failed',
      message: detailedChecks.overallValid ? 'All validation checks passed' : 'Some validation checks failed',
      data: detailedChecks
    });

    if (!detailedChecks.overallValid) {
      diagnosis.summary.overall = 'failed';
      diagnosis.summary.issues.push(...detailedChecks.failedChecks);
      diagnosis.summary.recommendations.push(...detailedChecks.recommendations);
    } else {
      diagnosis.summary.overall = 'success';
    }

  } catch (error) {
    diagnosis.steps.push({ 
      step: 'browser_restoration', 
      status: 'error', 
      message: `Browser restoration error: ${error.message}` 
    });
    diagnosis.summary.overall = 'failed';
    diagnosis.summary.issues.push(`Browser restoration error: ${error.message}`);
    diagnosis.summary.recommendations.push('Check browser configuration and network connectivity');
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  return diagnosis;
}

/**
 * Детальная валидация авторизации
 */
async function performDetailedValidation(page: any, sessionManager: WBSessionManager): Promise<any> {
  const checks = {
    urlCheck: await sessionManager['checkAuthenticationByURL'](page),
    domCheck: await sessionManager['checkAuthenticationByDOM'](page),
    storageCheck: await sessionManager['checkAuthenticationByStorage'](page),
    cookiesCheck: await sessionManager['checkAuthenticationByCookies'](page)
  };

  const passedChecks = Object.values(checks).filter(check => check.isValid).length;
  const overallValid = passedChecks >= 3;

  const failedChecks = Object.entries(checks)
    .filter(([_, check]) => !check.isValid)
    .map(([name, check]) => `${name}: ${check.reason}`);

  const recommendations = [];
  if (!checks.urlCheck.isValid) {
    recommendations.push('Ensure you are not on login or landing page');
  }
  if (!checks.domCheck.isValid) {
    recommendations.push('Check if WB portal has loaded completely');
  }
  if (!checks.storageCheck.isValid) {
    recommendations.push('Verify localStorage and sessionStorage contain authentication data');
  }
  if (!checks.cookiesCheck.isValid) {
    recommendations.push('Check if authentication cookies are present and valid');
  }

  return {
    overallValid,
    passedChecks,
    totalChecks: 4,
    failedChecks,
    recommendations,
    details: {
      urlCheck: checks.urlCheck,
      domCheck: checks.domCheck,
      storageCheck: checks.storageCheck,
      cookiesCheck: checks.cookiesCheck
    }
  };
}
