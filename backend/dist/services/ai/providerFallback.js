"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerFallback = exports.ProviderFallback = exports.OpenAIProvider = exports.GroqProvider = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Groq AI Provider (Llama models)
 */
class GroqProvider {
    constructor() {
        this.name = 'Groq';
        this.baseURL = 'https://api.groq.com/openai/v1';
        this.apiKey = process.env.GROQ_API_KEY || '';
    }
    async generateResponse(prompt) {
        if (!this.apiKey) {
            throw new Error('Groq API key not configured');
        }
        try {
            const response = await axios_1.default.post(`${this.baseURL}/chat/completions`, {
                model: 'llama3-8b-8192', // Fast Llama model
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });
            const content = response.data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('No response content from Groq');
            }
            return content.trim();
        }
        catch (error) {
            console.error('❌ Groq API error:', error.response?.data || error.message);
            throw new Error(`Groq API failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }
    isAvailable() {
        return !!this.apiKey;
    }
}
exports.GroqProvider = GroqProvider;
/**
 * OpenAI-Compatible Provider (for additional fallback)
 */
class OpenAIProvider {
    constructor() {
        this.name = 'OpenAI';
        this.baseURL = 'https://api.openai.com/v1';
        this.apiKey = process.env.OPENAI_API_KEY || '';
    }
    async generateResponse(prompt) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured');
        }
        try {
            const response = await axios_1.default.post(`${this.baseURL}/chat/completions`, {
                model: 'gpt-3.5-turbo', // Cost-effective model
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });
            const content = response.data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('No response content from OpenAI');
            }
            return content.trim();
        }
        catch (error) {
            console.error('❌ OpenAI API error:', error.response?.data || error.message);
            throw new Error(`OpenAI API failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }
    isAvailable() {
        return !!this.apiKey;
    }
}
exports.OpenAIProvider = OpenAIProvider;
/**
 * Provider Fallback Manager
 */
class ProviderFallback {
    constructor() {
        this.providers = [];
        this.fallbackCount = 0;
        this.initializeProviders();
    }
    initializeProviders() {
        // Initialize fallback providers
        const groq = new GroqProvider();
        const openai = new OpenAIProvider();
        if (groq.isAvailable()) {
            this.providers.push(groq);
            console.log('✅ Groq fallback provider initialized');
        }
        if (openai.isAvailable()) {
            this.providers.push(openai);
            console.log('✅ OpenAI fallback provider initialized');
        }
        if (this.providers.length === 0) {
            console.warn('⚠️ No fallback providers available');
            console.warn('Configure GROQ_API_KEY or OPENAI_API_KEY for fallback support');
        }
        else {
            console.log(`✅ ${this.providers.length} fallback provider(s) available`);
        }
    }
    /**
     * Generate response using fallback providers
     */
    async generateFallbackResponse(prompt) {
        if (this.providers.length === 0) {
            throw new Error('No fallback providers available');
        }
        // Try each provider in order
        for (const provider of this.providers) {
            try {
                console.log(`🔄 Attempting fallback with ${provider.name}...`);
                const response = await provider.generateResponse(prompt);
                this.fallbackCount++;
                console.log(`✅ Fallback successful with ${provider.name} (total fallbacks: ${this.fallbackCount})`);
                return {
                    response,
                    provider: provider.name,
                    fallbackUsed: true
                };
            }
            catch (error) {
                console.error(`❌ ${provider.name} fallback failed:`, error);
                continue; // Try next provider
            }
        }
        throw new Error('All fallback providers failed');
    }
    /**
     * Check if any fallback providers are available
     */
    hasAvailableProviders() {
        return this.providers.length > 0;
    }
    /**
     * Get fallback statistics
     */
    getFallbackStats() {
        return {
            availableProviders: this.providers.map(p => p.name),
            totalFallbacks: this.fallbackCount
        };
    }
    /**
     * Reset fallback statistics
     */
    resetStats() {
        this.fallbackCount = 0;
        console.log('🔄 Fallback statistics reset');
    }
}
exports.ProviderFallback = ProviderFallback;
// Export singleton instance
exports.providerFallback = new ProviderFallback();
