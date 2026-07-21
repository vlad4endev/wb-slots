/**
 * ГЛОБАЛЬНЫЕ СИНГЛТОНЫ ДЛЯ NEXT.JS
 * 
 * В Next.js dev-режиме модули могут перезагружаться при hot-reload,
 * что приводит к множественной инициализации сервисов.
 * 
 * Используем globalThis для сохранения instance между перезагрузками.
 */

import { ErrorRecoverySystem } from './errors/error-recovery';
import { ErrorTracker } from './errors/error-tracker';
import { AdvancedErrorClassifier } from './errors/advanced-error-classifier';
import { TelegramService } from './services/telegram-service';

// Расширяем globalThis типами
declare global {
  var __errorRecoverySystem: ErrorRecoverySystem | undefined;
  var __errorTracker: ErrorTracker | undefined;
  var __errorClassifier: AdvancedErrorClassifier | undefined;
  var __telegramService: TelegramService | undefined;
}

/**
 * Получить или создать ErrorRecoverySystem singleton
 */
export function getGlobalErrorRecoverySystem(): ErrorRecoverySystem {
  if (!global.__errorRecoverySystem) {
    global.__errorRecoverySystem = ErrorRecoverySystem.getInstance();
  }
  return global.__errorRecoverySystem;
}

/**
 * Получить или создать ErrorTracker singleton
 */
export function getGlobalErrorTracker(): ErrorTracker {
  if (!global.__errorTracker) {
    global.__errorTracker = ErrorTracker.getInstance();
  }
  return global.__errorTracker;
}

/**
 * Получить или создать AdvancedErrorClassifier singleton
 */
export function getGlobalErrorClassifier(): AdvancedErrorClassifier {
  if (!global.__errorClassifier) {
    global.__errorClassifier = AdvancedErrorClassifier.getInstance();
  }
  return global.__errorClassifier;
}

/**
 * Получить или создать TelegramService singleton
 */
export function getGlobalTelegramService(): TelegramService {
  if (!global.__telegramService) {
    global.__telegramService = new TelegramService();
  }
  return global.__telegramService;
}

/**
 * Очистить все глобальные синглтоны (для тестов)
 */
export function clearGlobalSingletons(): void {
  global.__errorRecoverySystem = undefined;
  global.__errorTracker = undefined;
  global.__errorClassifier = undefined;
  global.__telegramService = undefined;
}

