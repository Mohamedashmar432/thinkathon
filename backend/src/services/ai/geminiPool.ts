import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiKeyMetadata {
  key: string;
  client: GoogleGenerativeAI;
  lastUsed: number;
  cooldownUntil: number;
  errorCount: number;
  isAvailable: boolean;
}

export class GeminiKeyPool {
  private keys: GeminiKeyMetadata[] = [];
  private readonly COOLDOWN_DURATION = 60 * 1000; // 60 seconds
  private readonly MAX_ERROR_COUNT = 5;

  constructor() {
    this.initializeKeys();
  }

  /**
   * Initialize Gemini API keys from environment variables
   * Supports GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc.
   */
  private initializeKeys(): void {
    const keyPattern = /^GEMINI_API_KEY_(\d+)$/;
    const envKeys = Object.keys(process.env).filter(key => keyPattern.test(key));
    
    // Also check for primary GEMINI_API_KEY
    if (process.env.GEMINI_API_KEY) {
      this.addKey(process.env.GEMINI_API_KEY);
    }

    // Add numbered keys
    envKeys.forEach(envKey => {
      const apiKey = process.env[envKey];
      if (apiKey) {
        this.addKey(apiKey);
      }
    });

    if (this.keys.length === 0) {
      console.warn('⚠️ No Gemini API keys found in environment variables');
      console.warn('Expected: GEMINI_API_KEY, GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.');
    } else {
      console.log(`✅ Initialized Gemini key pool with ${this.keys.length} keys`);
    }
  }

  /**
   * Add a new API key to the pool
   */
  private addKey(apiKey: string): void {
    try {
      const client = new GoogleGenerativeAI(apiKey);
      const keyMetadata: GeminiKeyMetadata = {
        key: apiKey.substring(0, 8) + '...', // Masked for logging
        client,
        lastUsed: 0,
        cooldownUntil: 0,
        errorCount: 0,
        isAvailable: true
      };
      
      this.keys.push(keyMetadata);
    } catch (error) {
      console.error('❌ Failed to initialize Gemini key:', error);
    }
  }

  /**
   * Get the next available key that is not in cooldown
   * Returns null if no keys are available
   */
  getAvailableKey(): GeminiKeyMetadata | null {
    const now = Date.now();
    
    // Update availability status for all keys
    this.keys.forEach(keyMeta => {
      if (keyMeta.cooldownUntil <= now && keyMeta.errorCount < this.MAX_ERROR_COUNT) {
        keyMeta.isAvailable = true;
      }
    });

    // Find first available key
    const availableKey = this.keys.find(keyMeta => keyMeta.isAvailable);
    
    if (availableKey) {
      availableKey.lastUsed = now;
      console.log(`🔑 Using Gemini key: ${availableKey.key}`);
    } else {
      console.warn('⚠️ No available Gemini keys (all in cooldown or error state)');
    }

    return availableKey || null;
  }

  /**
   * Mark a key as rate-limited and put it in cooldown
   */
  markKeyRateLimited(keyMeta: GeminiKeyMetadata): void {
    const now = Date.now();
    keyMeta.cooldownUntil = now + this.COOLDOWN_DURATION;
    keyMeta.isAvailable = false;
    keyMeta.errorCount++;
    
    console.warn(`🚫 Key ${keyMeta.key} rate-limited, cooldown until ${new Date(keyMeta.cooldownUntil).toISOString()}`);
    
    // If key has too many errors, disable it longer
    if (keyMeta.errorCount >= this.MAX_ERROR_COUNT) {
      keyMeta.cooldownUntil = now + (this.COOLDOWN_DURATION * 5); // 5 minute cooldown
      console.error(`❌ Key ${keyMeta.key} disabled due to excessive errors (${keyMeta.errorCount})`);
    }
  }

  /**
   * Mark a key as having an error (non-rate-limit)
   */
  markKeyError(keyMeta: GeminiKeyMetadata): void {
    keyMeta.errorCount++;
    
    if (keyMeta.errorCount >= this.MAX_ERROR_COUNT) {
      keyMeta.isAvailable = false;
      keyMeta.cooldownUntil = Date.now() + (this.COOLDOWN_DURATION * 2); // 2 minute cooldown
      console.error(`❌ Key ${keyMeta.key} temporarily disabled due to errors (${keyMeta.errorCount})`);
    }
  }

  /**
   * Reset error count for a key after successful use
   */
  markKeySuccess(keyMeta: GeminiKeyMetadata): void {
    keyMeta.errorCount = Math.max(0, keyMeta.errorCount - 1); // Gradually reduce error count
  }

  /**
   * Check if any keys are available
   */
  hasAvailableKeys(): boolean {
    const now = Date.now();
    return this.keys.some(keyMeta => 
      keyMeta.isAvailable && 
      keyMeta.cooldownUntil <= now && 
      keyMeta.errorCount < this.MAX_ERROR_COUNT
    );
  }

  /**
   * Get pool status for monitoring
   */
  getPoolStatus(): {
    totalKeys: number;
    availableKeys: number;
    keysInCooldown: number;
    keysWithErrors: number;
  } {
    const now = Date.now();
    const availableKeys = this.keys.filter(k => k.isAvailable && k.cooldownUntil <= now).length;
    const keysInCooldown = this.keys.filter(k => k.cooldownUntil > now).length;
    const keysWithErrors = this.keys.filter(k => k.errorCount > 0).length;

    return {
      totalKeys: this.keys.length,
      availableKeys,
      keysInCooldown,
      keysWithErrors
    };
  }

  /**
   * Reset all keys (for testing or emergency recovery)
   */
  resetAllKeys(): void {
    this.keys.forEach(keyMeta => {
      keyMeta.cooldownUntil = 0;
      keyMeta.errorCount = 0;
      keyMeta.isAvailable = true;
    });
    console.log('🔄 All Gemini keys reset');
  }
}

// Export singleton instance
export const geminiPool = new GeminiKeyPool();