"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGeminiRecommendations = generateGeminiRecommendations;
const generative_ai_1 = require("@google/generative-ai");
const LLMCache_1 = __importDefault(require("../models/LLMCache"));
const aiGateway_1 = require("./ai/aiGateway");
class LLMService {
    constructor() {
        this.genAI = null;
        this.model = null;
        // Initialize legacy Gemini for backward compatibility
        this.initializeGemini();
    }
    initializeGemini() {
        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                console.warn('GEMINI_API_KEY not found in environment variables. Using AI Gateway with fallback.');
                return;
            }
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
            console.log('✅ Legacy Gemini AI initialized for backward compatibility');
        }
        catch (error) {
            console.error('❌ Failed to initialize legacy Gemini AI:', error);
            this.genAI = null;
            this.model = null;
        }
    }
    async generateRecommendations(inventory) {
        // Check cache first
        const cacheKey = this.generateCacheKey(inventory);
        const cached = await this.getCachedRecommendations(cacheKey);
        if (cached) {
            console.log('📋 Using cached recommendations');
            return cached;
        }
        let recommendations;
        if (!this.model) {
            console.log('📋 Using default recommendations (no AI model)');
            recommendations = this.getDefaultRecommendations(inventory);
        }
        else {
            try {
                console.log('🤖 Generating AI recommendations...');
                const prompt = this.buildRecommendationPrompt(inventory);
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                recommendations = this.parseRecommendations(text, inventory);
                console.log(`✅ Generated ${recommendations.length} AI recommendations`);
            }
            catch (error) {
                console.error('❌ Error generating AI recommendations:', error);
                recommendations = this.getDefaultRecommendations(inventory);
            }
        }
        // Cache the results
        await this.cacheRecommendations(cacheKey, recommendations);
        return recommendations;
    }
    async generateGeminiRecommendations(request) {
        try {
            // Create a focused prompt for security recommendations
            const prompt = `
You are a cybersecurity expert analyzing a system scan. Based on the following data, provide specific, actionable security recommendations.

SYSTEM INFORMATION:
- OS: ${request.systemInfo?.osName} ${request.systemInfo?.osVersion}
- Architecture: ${request.systemInfo?.architecture}
- Device: ${request.deviceId}

VULNERABILITIES FOUND (${request.vulnerabilities.length}):
${request.vulnerabilities.map(v => `
- ${v.software} v${v.version}: ${v.cveId} (CVSS: ${v.cvssScore}, Severity: ${v.severity})
  Description: ${v.description}
  Exploitable: ${v.exploitable ? 'Yes' : 'No'}
`).join('')}

INSTALLED SOFTWARE (${request.software.length} items):
${request.software.slice(0, 10).map(s => `- ${s.name} v${s.version} (${s.publisher})`).join('\n')}

REQUIREMENTS:
1. Provide 3-5 specific, actionable security recommendations
2. Focus on the most critical vulnerabilities and risks
3. Each recommendation must include:
   - title: Clear, specific action (max 80 chars)
   - description: Brief explanation (max 150 chars)
   - action: Step-by-step instructions (max 200 chars)
   - whyItMatters: Security impact explanation (max 150 chars)
   - expectedRiskReduction: Number between 5-40
   - priority: "high", "medium", or "low"
   - category: "endpoint", "system", "network", or "application"
   - estimatedTimeMinutes: Number between 5-60

4. Prioritize recommendations that:
   - Address critical/high severity vulnerabilities
   - Are user-actionable (no admin/IT-only tasks)
   - Provide significant risk reduction
   - Are feasible for end users

5. Use simple, non-technical language
6. Focus on immediate actions the user can take

Respond with valid JSON array format:
[
  {
    "title": "Update Chrome to latest version",
    "description": "Chrome version 118 has critical security vulnerabilities that need patching",
    "action": "Open Chrome > Settings > About Chrome to automatically update to the latest version",
    "whyItMatters": "Outdated browsers are primary targets for malware and data theft attacks",
    "expectedRiskReduction": 25,
    "priority": "high",
    "category": "application",
    "estimatedTimeMinutes": 5
  }
]
`;
            console.log('🤖 Generating AI recommendations with AI Gateway...');
            // Use the new AI Gateway instead of direct Gemini call
            const response = await (0, aiGateway_1.generateAIResponse)(prompt);
            // Parse JSON response
            let recommendations = [];
            try {
                // Extract JSON from response (handle potential markdown formatting)
                const jsonMatch = response.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    recommendations = JSON.parse(jsonMatch[0]);
                }
                else {
                    console.warn('No valid JSON found in AI Gateway response');
                    return [];
                }
            }
            catch (parseError) {
                console.error('Error parsing AI Gateway JSON response:', parseError);
                console.log('Raw response:', response);
                return [];
            }
            // Validate and clean recommendations
            const validRecommendations = recommendations.filter((rec) => rec.title && rec.description && rec.action && rec.whyItMatters).map((rec) => ({
                title: rec.title.substring(0, 80),
                description: rec.description.substring(0, 150),
                action: rec.action.substring(0, 200),
                whyItMatters: rec.whyItMatters.substring(0, 150),
                expectedRiskReduction: Math.min(40, Math.max(5, rec.expectedRiskReduction || 15)),
                priority: ['high', 'medium', 'low'].includes(rec.priority) ? rec.priority : 'medium',
                category: ['endpoint', 'system', 'network', 'application'].includes(rec.category) ? rec.category : 'system',
                estimatedTimeMinutes: Math.min(60, Math.max(5, rec.estimatedTimeMinutes || 10))
            }));
            console.log(`✅ Generated ${validRecommendations.length} AI recommendations via AI Gateway`);
            return validRecommendations;
        }
        catch (error) {
            console.error('❌ Error generating AI Gateway recommendations:', error);
            // Fallback to legacy Gemini if AI Gateway fails
            if (this.model) {
                console.log('🔄 Falling back to legacy Gemini...');
                return this.generateLegacyGeminiRecommendations(request);
            }
            return [];
        }
    }
    /**
     * Legacy Gemini method for backward compatibility
     */
    async generateLegacyGeminiRecommendations(request) {
        try {
            const prompt = `Generate 3-5 security recommendations based on scan data. Return as JSON array with title, description, action, whyItMatters, expectedRiskReduction, priority, category, estimatedTimeMinutes fields.`;
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return [];
        }
        catch (error) {
            console.error('Legacy Gemini also failed:', error);
            return [];
        }
    }
    generateCacheKey(inventory) {
        const softwareHash = inventory.software
            .map(sw => `${sw.name}-${sw.version}`)
            .sort()
            .join('|');
        return `rec_${inventory.systemInfo.osName}_${inventory.secureScore}_${softwareHash}`.substring(0, 100);
    }
    async getCachedRecommendations(cacheKey) {
        try {
            const cached = await LLMCache_1.default.findOne({
                cacheKey,
                expiresAt: { $gt: new Date() }
            });
            return cached ? cached.recommendations : null;
        }
        catch (error) {
            console.error('Error fetching cached recommendations:', error);
            return null;
        }
    }
    async cacheRecommendations(cacheKey, recommendations) {
        try {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // Cache for 7 days
            await LLMCache_1.default.findOneAndUpdate({ cacheKey }, {
                cacheKey,
                recommendations,
                expiresAt,
                createdAt: new Date()
            }, { upsert: true });
        }
        catch (error) {
            console.error('Error caching recommendations:', error);
        }
    }
    buildRecommendationPrompt(inventory) {
        return `
You are a cybersecurity expert providing personalized security recommendations for an end user.

CONTEXT:
- User's OS: ${inventory.systemInfo.osName} ${inventory.systemInfo.osVersion}
- Current Security Score: ${inventory.secureScore}/100
- Total Vulnerabilities: ${inventory.totalVulnerabilities}
- Critical Vulnerabilities: ${inventory.criticalVulnerabilities}
- Installed Software: ${inventory.software.length} applications

SOFTWARE INVENTORY:
${inventory.software.map(sw => `- ${sw.name} v${sw.version} (${sw.publisher})${sw.vulnerabilities?.length ? ` - ${sw.vulnerabilities.length} vulnerabilities` : ''}`).join('\n')}

CRITICAL CONSTRAINTS:
1. ONLY recommend actions the END USER can perform themselves
2. NO IT admin, tenant admin, or organization-wide policy recommendations
3. Focus on device-level, local OS, and endpoint configurations
4. Use simple, non-technical language
5. Provide specific, actionable steps

REQUIRED OUTPUT FORMAT (JSON):
[
  {
    "id": "unique-id",
    "title": "Brief action title",
    "description": "Simple explanation",
    "priority": "high|medium|low",
    "category": "software|system|network|behavior",
    "whatToFix": "What needs to be fixed",
    "whyItMatters": "Why this is important",
    "howToFix": ["Step 1", "Step 2", "Step 3"],
    "riskImpact": "What happens if ignored",
    "estimatedTime": "5 minutes",
    "status": "not_started"
  }
]

Generate 3-5 recommendations focusing on the highest impact actions.`;
    }
    parseRecommendations(text, inventory) {
        try {
            // Extract JSON from the response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch (error) {
            console.error('Error parsing AI recommendations:', error);
            return this.getDefaultRecommendations(inventory);
        }
    }
    getDefaultRecommendations(inventory) {
        const recommendations = [];
        // High-priority software updates
        if (inventory.criticalVulnerabilities > 0) {
            recommendations.push({
                id: 'update-critical-software',
                title: 'Update Critical Software',
                description: 'Update software with critical security vulnerabilities',
                priority: 'high',
                category: 'software',
                whatToFix: `${inventory.criticalVulnerabilities} critical vulnerabilities in installed software`,
                whyItMatters: 'Critical vulnerabilities can be exploited by attackers to take control of your device',
                howToFix: [
                    'Open each application and check for updates',
                    'Enable automatic updates where possible',
                    'Restart applications after updating'
                ],
                riskImpact: 'High risk of malware infection or data theft',
                estimatedTime: '15 minutes',
                status: 'not_started'
            });
        }
        // OS updates
        if (inventory.systemInfo.osName.includes('Windows')) {
            recommendations.push({
                id: 'windows-updates',
                title: 'Install Windows Updates',
                description: 'Keep your operating system up to date with latest security patches',
                priority: 'high',
                category: 'system',
                whatToFix: 'Potentially missing Windows security updates',
                whyItMatters: 'OS updates fix security vulnerabilities and improve system stability',
                howToFix: [
                    'Open Windows Settings',
                    'Go to Update & Security',
                    'Click "Check for updates"',
                    'Install all available updates',
                    'Restart when prompted'
                ],
                riskImpact: 'System vulnerabilities could be exploited',
                estimatedTime: '20 minutes',
                status: 'not_started'
            });
        }
        // Antivirus check
        recommendations.push({
            id: 'antivirus-check',
            title: 'Verify Antivirus Protection',
            description: 'Ensure real-time antivirus protection is active and up to date',
            priority: 'medium',
            category: 'system',
            whatToFix: 'Antivirus protection status',
            whyItMatters: 'Antivirus software protects against malware and suspicious files',
            howToFix: [
                'Open Windows Security (or your antivirus software)',
                'Check that real-time protection is ON',
                'Run a quick scan',
                'Update virus definitions if needed'
            ],
            riskImpact: 'Increased risk of malware infection',
            estimatedTime: '10 minutes',
            status: 'not_started'
        });
        return recommendations.slice(0, 5);
    }
    async explainSecurityScore(inventory) {
        try {
            const prompt = `
Explain this user's security score in simple, encouraging language:

Current Score: ${inventory.secureScore}/100
Vulnerabilities: ${inventory.totalVulnerabilities} total, ${inventory.criticalVulnerabilities} critical
Software: ${inventory.software.length} applications installed

Provide a brief, positive explanation of what the score means and how they can improve it.
Use simple language that a non-technical person can understand.
Keep it under 100 words.
`;
            console.log('🤖 Generating security score explanation with AI Gateway...');
            const response = await (0, aiGateway_1.generateAIResponse)(prompt);
            console.log('✅ Generated security score explanation via AI Gateway');
            return response;
        }
        catch (error) {
            console.error('❌ Error explaining security score with AI Gateway:', error);
            // Fallback to legacy Gemini
            if (this.model) {
                try {
                    console.log('🔄 Falling back to legacy Gemini for score explanation...');
                    const result = await this.model.generateContent(`Explain security score ${inventory.secureScore}/100 in simple terms.`);
                    const response = await result.response;
                    return response.text();
                }
                catch (legacyError) {
                    console.error('Legacy Gemini also failed for score explanation:', legacyError);
                }
            }
            // Final fallback to default explanation
            return this.getDefaultScoreExplanation(inventory);
        }
    }
    getDefaultScoreExplanation(inventory) {
        if (inventory.secureScore >= 80) {
            return "Great job! Your security score shows you're well-protected. Keep your software updated and maintain good security habits to stay safe.";
        }
        else if (inventory.secureScore >= 60) {
            return "You're on the right track! Your security is decent, but there's room for improvement. Focus on updating software and enabling security features.";
        }
        else if (inventory.secureScore >= 40) {
            return "Your security needs attention. Don't worry - following a few key recommendations will significantly improve your protection against threats.";
        }
        else {
            return "Your device needs immediate security improvements. Start with the highest priority recommendations to quickly boost your protection.";
        }
    }
}
exports.default = new LLMService();
// Export the generateGeminiRecommendations function for use in recommendation engine
async function generateGeminiRecommendations(request) {
    const llmService = new LLMService();
    return llmService.generateGeminiRecommendations(request);
}
