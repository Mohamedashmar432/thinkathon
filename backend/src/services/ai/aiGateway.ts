import pLimit from 'p-limit';
import { geminiPool, GeminiKeyMetadata } from './geminiPool';
import { providerFallback, FallbackResponse } from './providerFallback';

export interface AIGatewayResponse {
  response: string;
  provider: 'Gemini' | 'Groq' | 'OpenAI';
  fallbackUsed: boolean;
  keyUsed?: string;
  requestId: string;
  processingTimeMs: number;
}

export interface AIGatewayStats {
  totalRequests: number;
  geminiRequests: number;
  fallbackRequests: number;
  rateLimitEvents: number;
  averageResponseTime: number;
  keyPoolStatus: any;
  fallbackStats: any;
}

/**
 * Production-grade AI Gateway with Gemini key pool and provider fallback
 */
export class AIGateway {
  private readonly concurrencyLimit = pLimit(2); // Max 2 concurrent Gemini requests
  private stats = {
    totalRequests: 0,
    geminiRequests: 0,
    fallbackRequests: 0,
    rateLimitEvents: 0,
    totalResponseTime: 0
  };

  /**
   * Generate AI response with automatic failover and fallback
   */
  async generateResponse(prompt: string): Promise<AIGatewayResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    this.stats.totalRequests++;
    
    console.log(`🚀 AI Gateway request ${requestId} started`);
    
    try {
      // First, try Gemini with concurrency control
      const geminiResponse = await this.concurrencyLimit(() => 
        this.tryGeminiRequest(prompt, requestId)
      );
      
      if (geminiResponse) {
        this.stats.geminiRequests++;
        const processingTime = Date.now() - startTime;
        this.stats.totalResponseTime += processingTime;
        
        console.log(`✅ AI Gateway request ${requestId} completed with Gemini (${processingTime}ms)`);
        
        return {
          response: geminiResponse.response,
          provider: 'Gemini',
          fallbackUsed: false,
          keyUsed: geminiResponse.keyUsed,
          requestId,
          processingTimeMs: processingTime
        };
      }
      
      // If Gemini failed, try fallback providers
      console.log(`🔄 AI Gateway request ${requestId} falling back to secondary providers`);
      const fallbackResponse = await this.tryFallbackProviders(prompt, requestId);
      
      this.stats.fallbackRequests++;
      const processingTime = Date.now() - startTime;
      this.stats.totalResponseTime += processingTime;
      
      console.log(`✅ AI Gateway request ${requestId} completed with ${fallbackResponse.provider} (${processingTime}ms)`);
      
      return {
        response: fallbackResponse.response,
        provider: fallbackResponse.provider as 'Groq' | 'OpenAI',
        fallbackUsed: true,
        requestId,
        processingTimeMs: processingTime
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ AI Gateway request ${requestId} failed after ${processingTime}ms:`, error);
      
      throw new Error(`AI Gateway failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Try Gemini request with key rotation and error handling
   */
  private async tryGeminiRequest(prompt: string, requestId: string): Promise<{ response: string; keyUsed: string } | null> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      attempt++;
      
      // Get available key
      const keyMeta = geminiPool.getAvailableKey();
      if (!keyMeta) {
        console.warn(`⚠️ No available Gemini keys for request ${requestId} (attempt ${attempt})`);
        
        if (attempt === maxRetries) {
          console.error(`❌ All Gemini keys exhausted for request ${requestId}`);
          return null;
        }
        
        // Wait a bit before retrying
        await this.sleep(1000 * attempt);
        continue;
      }
      
      try {
        console.log(`🔑 Request ${requestId} using Gemini key ${keyMeta.key} (attempt ${attempt})`);
        
        // Make Gemini API call
        const model = keyMeta.client.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from Gemini');
        }
        
        // Mark key as successful
        geminiPool.markKeySuccess(keyMeta);
        
        console.log(`✅ Request ${requestId} successful with Gemini key ${keyMeta.key}`);
        
        return {
          response: text.trim(),
          keyUsed: keyMeta.key
        };
        
      } catch (error: any) {
        console.error(`❌ Request ${requestId} failed with Gemini key ${keyMeta.key}:`, error.message);
        
        // Handle rate limiting (HTTP 429)
        if (this.isRateLimitError(error)) {
          console.warn(`🚫 Rate limit hit for key ${keyMeta.key} on request ${requestId}`);
          geminiPool.markKeyRateLimited(keyMeta);
          this.stats.rateLimitEvents++;
          
          // Continue to next attempt with different key
          continue;
        }
        
        // Handle other errors
        geminiPool.markKeyError(keyMeta);
        
        // For non-rate-limit errors, wait before retry
        if (attempt < maxRetries) {
          await this.sleep(2000 * attempt);
        }
      }
    }
    
    console.error(`❌ All Gemini attempts failed for request ${requestId}`);
    return null;
  }

  /**
   * Try fallback providers when Gemini is unavailable
   */
  private async tryFallbackProviders(prompt: string, requestId: string): Promise<FallbackResponse> {
    if (!providerFallback.hasAvailableProviders()) {
      throw new Error('No fallback providers available');
    }
    
    console.log(`🔄 Request ${requestId} attempting fallback providers`);
    
    try {
      const fallbackResponse = await providerFallback.generateFallbackResponse(prompt);
      
      console.log(`✅ Request ${requestId} successful with fallback provider ${fallbackResponse.provider}`);
      
      return fallbackResponse;
      
    } catch (error) {
      console.error(`❌ All fallback providers failed for request ${requestId}:`, error);
      throw new Error(`All AI providers failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if error is a rate limit error (HTTP 429)
   */
  private isRateLimitError(error: any): boolean {
    // Check for various rate limit indicators
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code || error.status || 0;
    
    return (
      errorCode === 429 ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('quota exceeded') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('429')
    );
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Sleep utility for backoff delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get comprehensive gateway statistics
   */
  getStats(): AIGatewayStats {
    const averageResponseTime = this.stats.totalRequests > 0 
      ? Math.round(this.stats.totalResponseTime / this.stats.totalRequests)
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      geminiRequests: this.stats.geminiRequests,
      fallbackRequests: this.stats.fallbackRequests,
      rateLimitEvents: this.stats.rateLimitEvents,
      averageResponseTime,
      keyPoolStatus: geminiPool.getPoolStatus(),
      fallbackStats: providerFallback.getFallbackStats()
    };
  }

  /**
   * Reset all statistics (for testing or monitoring reset)
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      geminiRequests: 0,
      fallbackRequests: 0,
      rateLimitEvents: 0,
      totalResponseTime: 0
    };
    
    geminiPool.resetAllKeys();
    providerFallback.resetStats();
    
    console.log('🔄 AI Gateway statistics reset');
  }

  /**
   * Health check for the AI Gateway
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    geminiAvailable: boolean;
    fallbackAvailable: boolean;
    details: any;
  }> {
    const keyPoolStatus = geminiPool.getPoolStatus();
    const fallbackStats = providerFallback.getFallbackStats();
    
    const geminiAvailable = keyPoolStatus.availableKeys > 0;
    const fallbackAvailable = fallbackStats.availableProviders.length > 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (geminiAvailable) {
      status = 'healthy';
    } else if (fallbackAvailable) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    return {
      status,
      geminiAvailable,
      fallbackAvailable,
      details: {
        keyPool: keyPoolStatus,
        fallback: fallbackStats,
        stats: this.getStats()
      }
    };
  }
}

// Export singleton instance
export const aiGateway = new AIGateway();

// Export the main function for easy integration
export async function generateAIResponse(prompt: string): Promise<string> {
  const response = await aiGateway.generateResponse(prompt);
  return response.response;
}