import Scan, { IScan } from '../models/Scan';
import User, { IUser } from '../models/User';

export function getDaysSince(date: Date | undefined): number {
  if (!date) return 999;
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function isChecklistComplete(checklist: any): boolean {
  if (!checklist || !checklist.items) return false;
  return checklist.items.every((item: any) => item.completed);
}

export function getLatestScansPerDevice(scans: IScan[]): IScan[] {
  const latestByDevice = new Map<string, IScan>();
  
  scans.forEach(scan => {
    const existing = latestByDevice.get(scan.deviceId);
    if (!existing || new Date(scan.scanTimestamp) > new Date(existing.scanTimestamp)) {
      latestByDevice.set(scan.deviceId, scan);
    }
  });
  
  return Array.from(latestByDevice.values());
}

export function calculateUserSecureScore(scans: IScan[], user: IUser): number {
  try {
    // CRITICAL: Return 0 for first-time users with no scans
    if (!scans || scans.length === 0) {
      console.log('No scans found - returning default score of 0 for new user');
      return 0;
    }
    
    const latestScans = getLatestScansPerDevice(scans);
    if (latestScans.length === 0) {
      console.log('No latest scans found - returning default score of 0');
      return 0;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    let totalScore = 0;
    
    latestScans.forEach(scan => {
      let score = 100;
      
      // Ensure vulnerabilities object exists with proper defaults
      const vulnerabilities = scan.vulnerabilities || {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        exploitable: 0,
        items: []
      };
      
      // Validate vulnerability numbers
      const total = Math.max(0, vulnerabilities.total || 0);
      const critical = Math.max(0, vulnerabilities.critical || 0);
      const high = Math.max(0, vulnerabilities.high || 0);
      const exploitable = Math.max(0, vulnerabilities.exploitable || 0);
      
      // Software vulnerabilities (-40 max)
      if (scan.software && scan.software.length > 0 && total > 0) {
        const vulnRatio = total / scan.software.length;
        score -= Math.min(40, vulnRatio * 50);
      }
      
      // Critical CVEs (-5 each, max -30)
      score -= Math.min(30, critical * 5);
      
      // High severity CVEs (-3 each, max -20)
      score -= Math.min(20, high * 3);
      
      // Exploitable vulnerabilities (-10 each, max -25)
      score -= Math.min(25, exploitable * 10);
      
      // Outdated patches penalty
      if (scan.patches && scan.patches.latestPatchDate) {
        const daysSincePatches = getDaysSince(scan.patches.latestPatchDate);
        if (daysSincePatches > 60) score -= 20;
        else if (daysSincePatches > 30) score -= 10;
      }
      
      // Daily checklist bonus (+5 if completed today)
      if (user.dailyChecklist?.date) {
        const checklistDate = new Date(user.dailyChecklist.date).toISOString().split('T')[0];
        if (checklistDate === today && isChecklistComplete(user.dailyChecklist)) {
          score += 5;
        }
      }
      
      // Ensure score is within valid range
      const validScore = Math.max(0, Math.min(100, Math.round(score)));
      totalScore += isNaN(validScore) ? 0 : validScore;
    });
    
    const finalScore = Math.round(totalScore / latestScans.length);
    
    // Ensure final score is valid and within range
    if (isNaN(finalScore) || finalScore === null || finalScore === undefined) {
      console.log('Invalid final score calculated - returning 0');
      return 0;
    }
    
    const clampedScore = Math.max(0, Math.min(100, finalScore));
    console.log(`Calculated security score: ${clampedScore} (from ${latestScans.length} scans)`);
    return clampedScore;
  } catch (error) {
    console.error('Error in calculateUserSecureScore:', error);
    return 0; // Return 0 on any error for new users
  }
}

export function calculateEndpointExposureScore(scan: IScan): number {
  // Ensure vulnerabilities object exists
  const vulnerabilities = scan.vulnerabilities || {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    exploitable: 0,
    items: []
  };
  
  const endpoints: Array<{ endpoint: string; cvssScore: number }> = [];
  
  vulnerabilities.items.forEach(vuln => {
    if (vuln.affectedEndpoints && vuln.affectedEndpoints.length > 0) {
      vuln.affectedEndpoints.forEach(endpoint => {
        endpoints.push({
          endpoint,
          cvssScore: vuln.cvssScore,
        });
      });
    }
  });
  
  if (endpoints.length === 0) return 100; // Perfect score if no vulnerable endpoints
  
  // Calculate average exposure (invert CVSS - higher CVSS = lower score)
  let totalExposure = 0;
  endpoints.forEach(ep => {
    totalExposure += (10 - ep.cvssScore); // Invert CVSS
  });
  
  const exposureScore = Math.round((totalExposure / endpoints.length) * 10);
  const finalScore = Math.max(0, Math.min(100, exposureScore));
  
  // Return valid score
  return isNaN(finalScore) ? 100 : finalScore;
}

