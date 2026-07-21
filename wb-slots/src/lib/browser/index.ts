// ===== BROWSER AUTOMATION SYSTEM EXPORTS =====

// Main browser manager
export {
  RobustBrowserManager,
  robustBrowserManager,
  type BrowserConfig,
  type TimeoutConfig,
  type RetryConfig,
  type BrowserInstance
} from './robust-browser-manager';

// Adaptive selector manager
export {
  AdaptiveSelectorManager,
  adaptiveSelectorManager,
  type SelectorStrategy,
  type SelectorResult,
  type SelectorConfig
} from './adaptive-selector-manager';

// Adaptive timeout manager
export {
  AdaptiveTimeoutManager,
  adaptiveTimeoutManager,
  type TimeoutMetrics,
  type AdaptiveTimeoutConfig,
  type TimeoutProfile
} from './adaptive-timeout-manager';

// Antibot protection
export {
  AntibotProtection,
  antibotProtection,
  type AntibotConfig,
  type HumanBehaviorProfile,
  type DetectionResult
} from './antibot-protection';

// Universal browser service
export {
  UniversalBrowserService,
  createBrowserService,
  createSelectorStrategies,
  createMultipleStrategies,
  type BrowserServiceConfig,
  type OperationResult,
  type NavigationOptions,
  type ElementInteractionOptions
} from './universal-browser-service';

// Default exports
export { default as RobustBrowserManager } from './robust-browser-manager';
export { default as AdaptiveSelectorManager } from './adaptive-selector-manager';
export { default as AdaptiveTimeoutManager } from './adaptive-timeout-manager';
export { default as AntibotProtection } from './antibot-protection';
export { default as UniversalBrowserService } from './universal-browser-service';
