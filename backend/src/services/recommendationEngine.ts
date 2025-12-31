import { IScan } from '../models/Scan';
import { IUser } from '../models/User';
import Recommendation, { IRecommendation } from '../models/Recommendation';
import { getApplicableRecommendations, prioritizeRecommendations, SecurityRecommendationTemplate } from '../data/securityRecommendations';
import { generateGeminiRecommendations } from './llmService';
import crypto from 'crypto';

export interface RecommendationContext {
  scan: IScan;
  user: IUser;
  previousRecommendations?: IRecommendation[];
}

export interface GeneratedRecommendation {
  recommendationId: string;
  title: string;
  description: string;
  action: string;
  whyItMatters: string;
  expectedRiskReduction: number;
  priority: 'high' | 'medium' | 'low';
  category: 'endpoint' | 'system' | 'network' | 'application';
  estimatedTimeMinutes: number;
  scanId: string;
  softwareName?: string;
  vulnerabilityIds?: string[];
}

export class RecommendationEngine {
  
  /**
   * Generate personalized security recommendations based on scan data
   */
  async generateRecommendations(context: RecommendationContext): Promise<GeneratedRecommendation[]> {
    const { scan, user } = context;
    
    console.log(`Generating recommendations for user ${user.email} based on scan ${scan._id}`);
    
    try {
      // Step 1: Get template-based recommendations
      const templateRecommendations = this.getTemplateRecommendations(scan);
      
      // Step 2: Generate AI-powered recommendations
      const aiRecommendations = await this.generateAIRecommendations(scan);
      
      // Step 3: Combine and deduplicate recommendations
      const allRecommendations = this.combineRecommendations(templateRecommendations, aiRecommendations, scan);
      
      // Step 4: Filter out already completed recommendations
      const filteredRecommendations = await this.filterExistingRecommendations(allRecommendations, user._id.toString(), scan.deviceId);
      
      // Step 5: Prioritize and limit recommendations
      const finalRecommendations = this.prioritizeAndLimit(filteredRecommendations);
      
      console.log(`Generated ${finalRecommendations.length} recommendations for user ${user.email}`);
      
      return finalRecommendations;
      
    } catch (error) {
      console.error('Error generating recommendations:', error);
      
      // Fallback to template-only recommendations
      const templateRecommendations = this.getTemplateRecommendations(scan);
      const fallbackRecommendations = this.combineRecommendations(templateRecommendations, [], scan);
      
      return this.prioritizeAndLimit(fallbackRecommendations);
    }
  }
  
  /**
   * Get template-based recommendations from the security recommendations database
   */
  private getTemplateRecommendations(scan: IScan): SecurityRecommendationTemplate[] {
    const scanData = {
      systemInfo: scan.systemInfo,
      software: scan.software,
      vulnerabilities: scan.vulnerabilities,
      patches: scan.patches,
      hasEmailClient: scan.software?.some(s => 
        s.name?.toLowerCase().includes('outlook') || 
        s.name?.toLowerCase().includes('mail') || 
        s.name?.toLowerCase().includes('thunderbird')
      )
    };
    
    const applicableRecommendations = getApplicableRecommendations(scanData);
    return prioritizeRecommendations(applicableRecommendations);
  }
  
  /**
   * Generate AI-powered recommendations using Gemini
   */
  private async generateAIRecommendations(scan: IScan): Promise<any[]> {
    try {
      const vulnerabilities = scan.vulnerabilities?.items || [];
      const software = scan.software || [];
      const systemInfo = scan.systemInfo;
      
      // Only generate AI recommendations if there are vulnerabilities or outdated software
      if (vulnerabilities.length === 0 && software.length === 0) {
        return [];
      }
      
      const aiRecommendations = await generateGeminiRecommendations({
        vulnerabilities,
        software,
        systemInfo,
        deviceId: scan.deviceId
      });
      
      return aiRecommendations || [];
      
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      return [];
    }
  }
  
  /**
   * Combine template and AI recommendations, removing duplicates
   */
  private combineRecommendations(
    templateRecs: SecurityRecommendationTemplate[], 
    aiRecs: any[], 
    scan: IScan
  ): GeneratedRecommendation[] {
    const recommendations: GeneratedRecommendation[] = [];
    
    // Add template recommendations
    templateRecs.forEach(template => {
      const recommendationId = this.generateRecommendationId(template.id, scan.deviceId, scan._id.toString());
      
      recommendations.push({
        recommendationId,
        title: template.title,
        description: template.description,
        action: template.action,
        whyItMatters: template.whyItMatters,
        expectedRiskReduction: template.expectedRiskReduction,
        priority: template.priority,
        category: template.category,
        estimatedTimeMinutes: template.estimatedTimeMinutes,
        scanId: scan._id.toString(),
        softwareName: this.extractSoftwareName(template, scan),
        vulnerabilityIds: this.extractVulnerabilityIds(template, scan)
      });
    });
    
    // Add AI recommendations (if they don't duplicate template ones)
    aiRecs.forEach(aiRec => {
      const isDuplicate = recommendations.some(existing => 
        this.isSimilarRecommendation(existing.title, aiRec.title)
      );
      
      if (!isDuplicate) {
        const recommendationId = this.generateRecommendationId(`ai-${aiRec.title}`, scan.deviceId, scan._id.toString());
        
        recommendations.push({
          recommendationId,
          title: aiRec.title || 'AI Security Recommendation',
          description: aiRec.description || aiRec.action || 'AI-generated security recommendation',
          action: aiRec.action || aiRec.description || 'Follow AI-generated guidance',
          whyItMatters: aiRec.whyItMatters || aiRec.impact || 'Improves overall security posture',
          expectedRiskReduction: aiRec.expectedRiskReduction || 15,
          priority: aiRec.priority || 'medium',
          category: aiRec.category || 'system',
          estimatedTimeMinutes: aiRec.estimatedTimeMinutes || 10,
          scanId: scan._id.toString(),
          softwareName: aiRec.softwareName,
          vulnerabilityIds: aiRec.vulnerabilityIds
        });
      }
    });
    
    return recommendations;
  }
  
  /**
   * Filter out recommendations that have already been completed
   */
  private async filterExistingRecommendations(
    recommendations: GeneratedRecommendation[], 
    userId: string, 
    deviceId: string
  ): Promise<GeneratedRecommendation[]> {
    try {
      const existingRecommendations = await Recommendation.find({
        userId,
        deviceId,
        status: 'completed'
      }).select('recommendationId title');
      
      const completedIds = new Set(existingRecommendations.map(r => r.recommendationId));
      const completedTitles = new Set(existingRecommendations.map(r => r.title.toLowerCase()));
      
      return recommendations.filter(rec => 
        !completedIds.has(rec.recommendationId) && 
        !completedTitles.has(rec.title.toLowerCase())
      );
      
    } catch (error) {
      console.error('Error filtering existing recommendations:', error);
      return recommendations;
    }
  }
  
  /**
   * Prioritize and limit recommendations to a manageable number
   */
  private prioritizeAndLimit(recommendations: GeneratedRecommendation[]): GeneratedRecommendation[] {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    
    // Sort by priority and risk reduction
    const sorted = recommendations.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return b.expectedRiskReduction - a.expectedRiskReduction;
    });
    
    // Limit to top 10 recommendations to avoid overwhelming users
    return sorted.slice(0, 10);
  }
  
  /**
   * Generate a unique recommendation ID
   */
  private generateRecommendationId(baseId: string, deviceId: string, scanId: string): string {
    const data = `${baseId}-${deviceId}-${scanId}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
  
  /**
   * Extract software name from template triggers
   */
  private extractSoftwareName(template: SecurityRecommendationTemplate, scan: IScan): string | undefined {
    if (!template.triggers.softwareNames) return undefined;
    
    const matchingSoftware = scan.software?.find(s => 
      template.triggers.softwareNames!.some(name => 
        s.name?.toLowerCase().includes(name.toLowerCase())
      )
    );
    
    return matchingSoftware?.name;
  }
  
  /**
   * Extract vulnerability IDs from scan data
   */
  private extractVulnerabilityIds(template: SecurityRecommendationTemplate, scan: IScan): string[] | undefined {
    if (!template.triggers.vulnerabilityTypes || !scan.vulnerabilities?.items) return undefined;
    
    const matchingVulns = scan.vulnerabilities.items.filter(vuln =>
      template.triggers.vulnerabilityTypes!.some(type =>
        vuln.description?.toLowerCase().includes(type.toLowerCase()) ||
        vuln.cveId?.toLowerCase().includes(type.toLowerCase())
      )
    );
    
    return matchingVulns.length > 0 ? matchingVulns.map(v => v.cveId) : undefined;
  }
  
  /**
   * Check if two recommendations are similar (to avoid duplicates)
   */
  private isSimilarRecommendation(title1: string, title2: string): boolean {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalized1 = normalize(title1);
    const normalized2 = normalize(title2);
    
    // Check for exact match or significant overlap
    if (normalized1 === normalized2) return true;
    
    // Check for significant word overlap
    const words1 = normalized1.split(' ').filter(w => w.length > 3);
    const words2 = normalized2.split(' ').filter(w => w.length > 3);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    const commonWords = words1.filter(w => words2.includes(w));
    const overlapRatio = commonWords.length / Math.min(words1.length, words2.length);
    
    return overlapRatio > 0.6; // 60% word overlap threshold
  }
  
  /**
   * Save recommendations to database
   */
  async saveRecommendations(
    recommendations: GeneratedRecommendation[], 
    userId: string, 
    userEmail: string, 
    deviceId: string
  ): Promise<IRecommendation[]> {
    const savedRecommendations: IRecommendation[] = [];
    
    for (const rec of recommendations) {
      try {
        // Check if recommendation already exists
        const existing = await Recommendation.findOne({
          recommendationId: rec.recommendationId,
          userId,
          deviceId
        });
        
        if (existing) {
          console.log(`Recommendation ${rec.recommendationId} already exists, skipping`);
          savedRecommendations.push(existing);
          continue;
        }
        
        // Create new recommendation
        const newRecommendation = new Recommendation({
          userId,
          userEmail,
          deviceId,
          recommendationId: rec.recommendationId,
          title: rec.title,
          description: rec.description,
          action: rec.action,
          whyItMatters: rec.whyItMatters,
          expectedRiskReduction: rec.expectedRiskReduction,
          priority: rec.priority,
          category: rec.category,
          userActionable: true,
          estimatedTimeMinutes: rec.estimatedTimeMinutes,
          status: 'not_started',
          scanId: rec.scanId,
          softwareName: rec.softwareName,
          vulnerabilityIds: rec.vulnerabilityIds
        });
        
        const saved = await newRecommendation.save();
        savedRecommendations.push(saved);
        
        console.log(`Saved recommendation: ${rec.title}`);
        
      } catch (error) {
        console.error(`Error saving recommendation ${rec.title}:`, error);
      }
    }
    
    console.log(`Saved ${savedRecommendations.length} recommendations to database`);
    return savedRecommendations;
  }
}

// Export singleton instance
export const recommendationEngine = new RecommendationEngine();