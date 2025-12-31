"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiGateway = exports.AIGateway = void 0;
exports.generateAIResponse = generateAIResponse;
const p_limit_1 = __importDefault(require("p-limit"));
const geminiPool_1 = require("./geminiPool");
const providerFallback_1 = require("./providerFallback");
/**
 * Production-grade AI Gateway with Gemini key pool and provider fallback
 */
class AIGateway {
    constructor() {
        this.concurrencyLimit = (0, p_limit_1.default)(2); // Max 2 concurrent Gemini requests
        this.stats = {
            totalRequests: 0,
            geminiRequests: 0,
            fallbackRequests: 0,
            rateLimitEvents: 0,
            totalResponseTime: 0
        };
    }
    /**
     * Generate AI response with automatic failover and fallback
     */
    async generateResponse(prompt) {
        const requestId = this.generateRequestId();
        const startTime = Date.now();
        this.stats.totalRequests++;
        console.log(`🚀 AI Gateway request ${requestId} started`);
        try {
            // First, try Gemini with concurrency control
            const geminiResponse = await this.concurrencyLimit(() => this.tryGeminiRequest(prompt, requestId));
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
                provider: fallbackResponse.provider,
                fallbackUsed: true,
                requestId,
                processingTimeMs: processingTime
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ AI Gateway request ${requestId} failed after ${processingTime}ms:`, error);
            throw new Error(`AI Gateway failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Try Gemini request with key rotation and error handling
     */
    async tryGeminiRequest(prompt, requestId) {
        const maxRetries = 3;
        let attempt = 0;
        while (attempt < maxRetries) {
            attempt++;
            // Get available key
            const keyMeta = geminiPool_1.geminiPool.getAvailableKey();
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
                geminiPool_1.geminiPool.markKeySuccess(keyMeta);
                console.log(`✅ Request ${requestId} successful with Gemini key ${keyMeta.key}`);
                return {
                    response: text.trim(),
                    keyUsed: keyMeta.key
                };
            }
            catch (error) {
                console.error(`❌ Request ${requestId} failed with Gemini key ${keyMeta.key}:`, error.message);
                // Handle rate limiting (HTTP 429)
                if (this.isRateLimitError(error)) {
                    console.warn(`🚫 Rate limit hit for key ${keyMeta.key} on request ${requestId}`);
                    geminiPool_1.geminiPool.markKeyRateLimited(keyMeta);
                    this.stats.rateLimitEvents++;
                    // Continue to next attempt with different key
                    continue;
                }
                // Handle other errors
                geminiPool_1.geminiPool.markKeyError(keyMeta);
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
    async tryFallbackProviders(prompt, requestId) {
        if (!providerFallback_1.providerFallback.hasAvailableProviders()) {
            throw new Error('No fallback providers available');
        }
        console.log(`🔄 Request ${requestId} attempting fallback providers`);
        try {
            const fallbackResponse = await providerFallback_1.providerFallback.generateFallbackResponse(prompt);
            console.log(`✅ Request ${requestId} successful with fallback provider ${fallbackResponse.provider}`);
            return fallbackResponse;
        }
        catch (error) {
            console.error(`❌ All fallback providers failed for request ${requestId}:`, error);
            throw new Error(`All AI providers failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Check if error is a rate limit error (HTTP 429)
     */
    isRateLimitError(error) {
        // Check for various rate limit indicators
        const errorMessage = error.message?.toLowerCase() || '';
        const errorCode = error.code || error.status || 0;
        return (errorCode === 429 ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('quota exceeded') ||
            errorMessage.includes('too many requests') ||
            errorMessage.includes('429'));
    }
    /**
     * Generate unique request ID for tracking
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    /**
     * Sleep utility for backoff delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get comprehensive gateway statistics
     */
    getStats() {
        const averageResponseTime = this.stats.totalRequests > 0
            ? Math.round(this.stats.totalResponseTime / this.stats.totalRequests)
            : 0;
        return {
            totalRequests: this.stats.totalRequests,
            geminiRequests: this.stats.geminiRequests,
            fallbackRequests: this.stats.fallbackRequests,
            rateLimitEvents: this.stats.rateLimitEvents,
            averageResponseTime,
            keyPoolStatus: geminiPool_1.geminiPool.getPoolStatus(),
            fallbackStats: providerFallback_1.providerFallback.getFallbackStats()
        };
    }
    /**
     * Reset all statistics (for testing or monitoring reset)
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            geminiRequests: 0,
            fallbackRequests: 0,
            rateLimitEvents: 0,
            totalResponseTime: 0
        };
        geminiPool_1.geminiPool.resetAllKeys();
        providerFallback_1.providerFallback.resetStats();
        console.log('🔄 AI Gateway statistics reset');
    }
    /**
     * Health check for the AI Gateway
     */
    async healthCheck() {
        const keyPoolStatus = geminiPool_1.geminiPool.getPoolStatus();
        const fallbackStats = providerFallback_1.providerFallback.getFallbackStats();
        const geminiAvailable = keyPoolStatus.availableKeys > 0;
        const fallbackAvailable = fallbackStats.availableProviders.length > 0;
        let status;
        if (geminiAvailable) {
            status = 'healthy';
        }
        else if (fallbackAvailable) {
            status = 'degraded';
        }
        else {
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
exports.AIGateway = AIGateway;
// Export singleton instance
exports.aiGateway = new AIGateway();
// Export the main function for easy integration
async function generateAIResponse(prompt) {
    const response = await exports.aiGateway.generateResponse(prompt);
    return response.response;
}
