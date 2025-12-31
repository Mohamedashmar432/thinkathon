import axios from 'axios';
import * as cron from 'node-cron';
import ThreatIntelItem, { IThreatIntelItem } from '../models/ThreatIntelItem';
import ThreatCorrelation, { IThreatCorrelation } from '../models/ThreatCorrelation';
import User from '../models/User';
import Scan from '../models/Scan';

interface NVDCVEResponse {
  vulnerabilities: Array<{
    cve: {
      id: string;
      descriptions: Array<{ lang: string; value: string }>;
      published: string;
      lastModified: string;
      metrics?: {
        cvssMetricV31?: Array<{
          cvssData: {
            baseScore: number;
            baseSeverity: string;
          };
        }>;
        cvssMetricV2?: Array<{
          cvssData: {
            baseScore: number;
            baseSeverity: string;
          };
        }>;
      };
      configurations?: Array<{
        nodes: Array<{
          cpeMatch: Array<{
            criteria: string;
            matchCriteriaId: string;
          }>;
        }>;
      }>;
      references: Array<{
        url: string;
        source: string;
      }>;
    };
  }>;
  totalResults: number;
}

interface CISAKEVResponse {
  vulnerabilities: Array<{
    cveID: string;
    vendorProject: string;
    product: string;
    vulnerabilityName: string;
    dateAdded: string;
    shortDescription: string;
    requiredAction: string;
    dueDate: string;
  }>;
}

class ThreatIntelligenceService {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private lastIngestionTime: Date | null = null;

  // API endpoints
  private readonly NVD_API_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
  private readonly CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
  
  constructor() {
    this.startIngestionScheduler();
  }

  // Start the ingestion scheduler (runs every hour)
  startIngestionScheduler() {
    if (this.cronJob) {
      this.cronJob.destroy();
    }

    // Run every hour at minute 0
    this.cronJob = cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) {
        this.isRunning = true;
        try {
          console.log('🔍 Starting threat intelligence ingestion...');
          await this.performFullIngestion();
          console.log('✅ Threat intelligence ingestion completed');
        } catch (error) {
          console.error('❌ Threat intelligence ingestion failed:', error);
        } finally {
          this.isRunning = false;
        }
      }
    }, {
      timezone: 'UTC'
    });

    console.log('📡 Threat Intelligence ingestion scheduler started (hourly)');
  }

  // Stop the scheduler
  stopIngestionScheduler() {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
      console.log('📡 Threat Intelligence ingestion scheduler stopped');
    }
  }

  // Perform full ingestion from all sources
  async performFullIngestion(): Promise<void> {
    try {
      const startTime = new Date();
      
      // Ingest from multiple sources in parallel
      const [nvdResults, kevResults] = await Promise.allSettled([
        this.ingestFromNVD(),
        this.ingestFromCISAKEV()
      ]);

      // Log results
      let totalIngested = 0;
      if (nvdResults.status === 'fulfilled') {
        totalIngested += nvdResults.value;
        console.log(`📊 NVD ingestion: ${nvdResults.value} CVEs processed`);
      } else {
        console.error('❌ NVD ingestion failed:', nvdResults.reason);
      }

      if (kevResults.status === 'fulfilled') {
        totalIngested += kevResults.value;
        console.log(`📊 CISA KEV ingestion: ${kevResults.value} CVEs processed`);
      } else {
        console.error('❌ CISA KEV ingestion failed:', kevResults.reason);
      }

      this.lastIngestionTime = startTime;
      console.log(`🎯 Total threat intelligence items processed: ${totalIngested}`);

      // Trigger correlation for all users (async)
      this.triggerCorrelationForAllUsers();

    } catch (error) {
      console.error('❌ Full ingestion failed:', error);
      throw error;
    }
  }

  // Ingest CVEs from NVD API
  async ingestFromNVD(): Promise<number> {
    try {
      // Get CVEs from the last 7 days to catch recent updates
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const params = {
        pubStartDate: startDate.toISOString().split('T')[0] + 'T00:00:00.000',
        pubEndDate: endDate.toISOString().split('T')[0] + 'T23:59:59.999',
        resultsPerPage: 2000
      };

      console.log('📡 Fetching CVEs from NVD API...');
      const response = await axios.get<NVDCVEResponse>(this.NVD_API_BASE, {
        params,
        timeout: 30000,
        headers: {
          'User-Agent': 'SecureHabit-ThreatIntel/1.0'
        }
      });

      const vulnerabilities = response.data.vulnerabilities || [];
      console.log(`📊 Retrieved ${vulnerabilities.length} CVEs from NVD`);

      let processedCount = 0;
      for (const vuln of vulnerabilities) {
        try {
          await this.processNVDVulnerability(vuln);
          processedCount++;
        } catch (error) {
          console.error(`❌ Failed to process CVE ${vuln.cve.id}:`, error);
        }
      }

      return processedCount;
    } catch (error) {
      console.error('❌ NVD ingestion error:', error);
      throw error;
    }
  }

  // Process individual NVD vulnerability
  async processNVDVulnerability(vuln: any): Promise<void> {
    const cve = vuln.cve;
    
    // Extract CVSS score and severity
    let cvssScore = 0;
    let severity = 'low';
    
    if (cve.metrics?.cvssMetricV31?.[0]) {
      cvssScore = cve.metrics.cvssMetricV31[0].cvssData.baseScore;
      severity = cve.metrics.cvssMetricV31[0].cvssData.baseSeverity.toLowerCase();
    } else if (cve.metrics?.cvssMetricV2?.[0]) {
      cvssScore = cve.metrics.cvssMetricV2[0].cvssData.baseScore;
      severity = this.mapCVSSv2Severity(cvssScore);
    }

    // Extract affected products from CPE data
    const affectedProducts = this.extractAffectedProducts(cve.configurations);

    // Get description
    const description = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 'No description available';

    // Extract references
    const references = cve.references?.map((ref: any) => ref.url) || [];

    // Upsert threat intel item
    await ThreatIntelItem.findOneAndUpdate(
      { cveId: cve.id },
      {
        cveId: cve.id,
        title: `${cve.id} - Vulnerability`,
        description: description.substring(0, 1000), // Limit description length
        severity: severity as 'critical' | 'high' | 'medium' | 'low',
        cvssScore,
        affectedProducts,
        publishedDate: new Date(cve.published),
        source: 'nvd',
        references,
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );
  }

  // Ingest from CISA Known Exploited Vulnerabilities
  async ingestFromCISAKEV(): Promise<number> {
    try {
      console.log('📡 Fetching CISA KEV data...');
      const response = await axios.get<CISAKEVResponse>(this.CISA_KEV_URL, {
        timeout: 30000,
        headers: {
          'User-Agent': 'SecureHabit-ThreatIntel/1.0'
        }
      });

      const vulnerabilities = response.data.vulnerabilities || [];
      console.log(`📊 Retrieved ${vulnerabilities.length} KEV entries from CISA`);

      let processedCount = 0;
      for (const vuln of vulnerabilities) {
        try {
          await this.processCISAKEVVulnerability(vuln);
          processedCount++;
        } catch (error) {
          console.error(`❌ Failed to process KEV ${vuln.cveID}:`, error);
        }
      }

      return processedCount;
    } catch (error) {
      console.error('❌ CISA KEV ingestion error:', error);
      throw error;
    }
  }

  // Process individual CISA KEV vulnerability
  async processCISAKEVVulnerability(vuln: any): Promise<void> {
    // Mark as exploited and update existing record if it exists
    const existingItem = await ThreatIntelItem.findOne({ cveId: vuln.cveID });
    
    if (existingItem) {
      // Update existing item to mark as exploited
      existingItem.exploited = true;
      existingItem.cisaKevDate = new Date(vuln.dateAdded);
      existingItem.updatedAt = new Date();
      await existingItem.save();
    } else {
      // Create new item for KEV-only CVEs
      const affectedProducts = this.normalizeProductNames([vuln.product, vuln.vendorProject]);
      
      await ThreatIntelItem.create({
        cveId: vuln.cveID,
        title: vuln.vulnerabilityName || `${vuln.cveID} - Known Exploited Vulnerability`,
        description: vuln.shortDescription || 'Known exploited vulnerability identified by CISA',
        severity: 'high', // Default to high for KEV items
        cvssScore: 7.5, // Default score for KEV items without NVD data
        exploited: true,
        affectedProducts,
        publishedDate: new Date(vuln.dateAdded),
        source: 'cisa_kev',
        references: [],
        cisaKevDate: new Date(vuln.dateAdded)
      });
    }
  }

  // Extract affected products from NVD CPE configurations
  extractAffectedProducts(configurations: any[]): string[] {
    if (!configurations) return [];

    const products = new Set<string>();
    
    for (const config of configurations) {
      if (config.nodes) {
        for (const node of config.nodes) {
          if (node.cpeMatch) {
            for (const match of node.cpeMatch) {
              const product = this.parseCPEString(match.criteria);
              if (product) {
                products.add(product);
              }
            }
          }
        }
      }
    }

    return Array.from(products);
  }

  // Parse CPE string to extract product name
  parseCPEString(cpe: string): string | null {
    try {
      // CPE format: cpe:2.3:a:vendor:product:version:update:edition:language:sw_edition:target_sw:target_hw:other
      const parts = cpe.split(':');
      if (parts.length >= 5) {
        const vendor = parts[3];
        const product = parts[4];
        return this.normalizeProductName(`${vendor} ${product}`);
      }
    } catch (error) {
      console.error('Error parsing CPE string:', cpe, error);
    }
    return null;
  }

  // Normalize product names for better matching
  normalizeProductName(productName: string): string {
    return productName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Normalize array of product names
  normalizeProductNames(products: string[]): string[] {
    return products
      .filter(p => p && p.trim())
      .map(p => this.normalizeProductName(p))
      .filter(p => p.length > 0);
  }

  // Map CVSS v2 score to severity
  mapCVSSv2Severity(score: number): string {
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    return 'low';
  }

  // Trigger correlation for all users (async)
  async triggerCorrelationForAllUsers(): Promise<void> {
    try {
      console.log('🔄 Triggering threat correlation for all users...');
      
      // Get all users with scans
      const users = await User.find({}).select('_id email');
      
      for (const user of users) {
        // Run correlation in background (don't await)
        this.correlateThreatsForUser(user._id.toString(), user.email).catch(error => {
          console.error(`❌ Correlation failed for user ${user.email}:`, error);
        });
      }
      
      console.log(`🔄 Triggered correlation for ${users.length} users`);
    } catch (error) {
      console.error('❌ Failed to trigger correlation for all users:', error);
    }
  }

  // Correlate threats for a specific user
  async correlateThreatsForUser(userId: string, userEmail: string): Promise<void> {
    try {
      console.log(`🔍 Correlating threats for user: ${userEmail}`);

      // Get user's latest scans and software inventory
      const userScans = await Scan.find({ userId })
        .sort({ scanTimestamp: -1 })
        .limit(10);

      if (userScans.length === 0) {
        console.log(`⚠️ No scans found for user ${userEmail}`);
        return;
      }

      // Aggregate all software from user's endpoints
      const softwareInventory = new Map<string, Set<string>>();
      const endpointSoftware = new Map<string, Array<{ name: string; version: string }>>();

      for (const scan of userScans) {
        const deviceId = scan.deviceId;
        endpointSoftware.set(deviceId, scan.software || []);

        for (const software of scan.software || []) {
          const normalizedName = this.normalizeProductName(software.name);
          if (!softwareInventory.has(normalizedName)) {
            softwareInventory.set(normalizedName, new Set());
          }
          softwareInventory.get(normalizedName)!.add(deviceId);
        }
      }

      // Get recent threat intel items (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const threatItems = await ThreatIntelItem.find({
        publishedDate: { $gte: thirtyDaysAgo }
      }).sort({ publishedDate: -1 });

      console.log(`📊 Checking ${threatItems.length} threats against ${softwareInventory.size} software items`);

      let correlationsCreated = 0;
      for (const threat of threatItems) {
        const correlation = await this.correlateThreatWithUserSoftware(
          threat,
          userId,
          userEmail,
          softwareInventory,
          endpointSoftware
        );

        if (correlation) {
          correlationsCreated++;
        }
      }

      console.log(`✅ Created ${correlationsCreated} threat correlations for user ${userEmail}`);

    } catch (error) {
      console.error(`❌ Threat correlation failed for user ${userEmail}:`, error);
      throw error;
    }
  }

  // Correlate individual threat with user software
  async correlateThreatWithUserSoftware(
    threat: IThreatIntelItem,
    userId: string,
    userEmail: string,
    softwareInventory: Map<string, Set<string>>,
    endpointSoftware: Map<string, Array<{ name: string; version: string }>>
  ): Promise<IThreatCorrelation | null> {
    try {
      const impactedEndpoints: string[] = [];
      const impactedSoftware: Array<{ name: string; version: string; endpoints: string[] }> = [];

      // Check if any affected products match user's software
      for (const affectedProduct of threat.affectedProducts) {
        const normalizedProduct = this.normalizeProductName(affectedProduct);
        
        // Check for exact and partial matches
        for (const [userSoftware, endpoints] of softwareInventory) {
          if (this.isProductMatch(normalizedProduct, userSoftware)) {
            // Found a match - collect impacted endpoints and software details
            const endpointArray = Array.from(endpoints);
            impactedEndpoints.push(...endpointArray);

            // Get software details for each endpoint
            for (const endpointId of endpointArray) {
              const endpointSoft = endpointSoftware.get(endpointId) || [];
              for (const soft of endpointSoft) {
                if (this.isProductMatch(normalizedProduct, this.normalizeProductName(soft.name))) {
                  impactedSoftware.push({
                    name: soft.name,
                    version: soft.version,
                    endpoints: [endpointId]
                  });
                }
              }
            }
          }
        }
      }

      // If no impact found, don't create correlation
      if (impactedEndpoints.length === 0) {
        return null;
      }

      // Remove duplicates
      const uniqueEndpoints = [...new Set(impactedEndpoints)];

      // Calculate risk score
      const exploitedMultiplier = threat.exploited ? 2.0 : 1.0;
      const riskFactors = {
        cvssScore: threat.cvssScore,
        exploitedMultiplier,
        endpointCount: uniqueEndpoints.length,
        internetExposure: false, // TODO: Implement internet exposure detection
        criticalSystem: false // TODO: Implement critical system detection
      };

      const riskScore = (ThreatCorrelation as any).calculateRiskScore(riskFactors);

      // Generate action recommendations
      const actionRecommendations = this.generateActionRecommendations(threat, uniqueEndpoints.length);

      // Upsert threat correlation
      const correlation = await ThreatCorrelation.findOneAndUpdate(
        { cveId: threat.cveId, userId },
        {
          cveId: threat.cveId,
          userId,
          userEmail,
          impactedEndpoints: uniqueEndpoints,
          impactedSoftware,
          riskScore,
          riskFactors,
          lastChecked: new Date(),
          threatDetails: {
            severity: threat.severity,
            exploited: threat.exploited,
            cisaKev: !!threat.cisaKevDate,
            exploitAvailable: threat.exploitationDetails?.exploitAvailable || false
          },
          actionRecommendations,
          updatedAt: new Date()
        },
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true
        }
      );

      return correlation;

    } catch (error) {
      console.error(`❌ Failed to correlate threat ${threat.cveId}:`, error);
      return null;
    }
  }

  // Check if products match (exact or partial)
  isProductMatch(threatProduct: string, userSoftware: string): boolean {
    // Exact match
    if (threatProduct === userSoftware) {
      return true;
    }

    // Partial match - check if key terms overlap
    const threatTerms = threatProduct.split(' ').filter(t => t.length > 2);
    const userTerms = userSoftware.split(' ').filter(t => t.length > 2);

    // Need at least 2 matching terms for partial match
    const matchingTerms = threatTerms.filter(term => 
      userTerms.some(userTerm => 
        userTerm.includes(term) || term.includes(userTerm)
      )
    );

    return matchingTerms.length >= 2;
  }

  // Generate action recommendations based on threat
  generateActionRecommendations(threat: IThreatIntelItem, endpointCount: number): string[] {
    const recommendations: string[] = [];

    if (threat.exploited) {
      recommendations.push('🚨 URGENT: This vulnerability is actively exploited in the wild');
      recommendations.push('📋 Apply security patches immediately');
      recommendations.push('🔍 Monitor affected systems for signs of compromise');
    } else {
      recommendations.push('📋 Apply security patches as soon as possible');
      recommendations.push('🔍 Monitor vendor security advisories');
    }

    if (threat.severity === 'critical') {
      recommendations.push('⚡ Prioritize patching - Critical severity');
    }

    if (endpointCount > 5) {
      recommendations.push(`📊 High impact: ${endpointCount} endpoints affected`);
      recommendations.push('🎯 Consider staged deployment of patches');
    }

    recommendations.push('📖 Review vendor security documentation');
    
    return recommendations;
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.cronJob !== null,
      isIngesting: this.isRunning,
      lastIngestionTime: this.lastIngestionTime,
      nextIngestion: this.cronJob ? 'Every hour at minute 0' : 'Not scheduled'
    };
  }

  // Manual ingestion trigger
  async triggerManualIngestion(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Ingestion already in progress');
    }

    this.isRunning = true;
    try {
      await this.performFullIngestion();
    } finally {
      this.isRunning = false;
    }
  }
}

// Export singleton instance
export default new ThreatIntelligenceService();