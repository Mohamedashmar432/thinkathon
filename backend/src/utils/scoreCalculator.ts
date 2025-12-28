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
  if (scans.length === 0) return 0;
  
  const latestScans = getLatestScansPerDevice(scans);
  const today = new Date().toISOString().split('T')[0];
  
  let totalScore = 0;
  
  latestScans.forEach(scan => {
    let score = 100;
    
    // Software vulnerabilities (-40 max)
    if (scan.software.length > 0) {
      const vulnRatio = scan.vulnerabilities.total / scan.software.length;
      score -= Math.min(40, vulnRatio * 50);
    }
    
    // Critical CVEs (-5 each, max -30)
    score -= Math.min(30, scan.vulnerabilities.critical * 5);
    
    // Exploitable vulnerabilities (-10 each, max -20)
    score -= Math.min(20, scan.vulnerabilities.exploitable * 10);
    
    // Outdated patches (-10 if >30 days, -20 if >60 days)
    const daysSincePatches = getDaysSince(scan.patches.latestPatchDate);
    if (daysSincePatches > 60) score -= 20;
    else if (daysSincePatches > 30) score -= 10;
    
    // Daily checklist bonus (+5 if completed today)
    if (user.dailyChecklist?.date) {
      const checklistDate = new Date(user.dailyChecklist.date).toISOString().split('T')[0];
      if (checklistDate === today && isChecklistComplete(user.dailyChecklist)) {
        score += 5;
      }
    }
    
    totalScore += Math.max(0, Math.min(100, score));
  });
  
  return Math.round(totalScore / latestScans.length);
}

export function calculateEndpointExposureScore(scan: IScan): number {
  const endpoints: Array<{ endpoint: string; cvssScore: number }> = [];
  
  scan.vulnerabilities.items.forEach(vuln => {
    if (vuln.affectedEndpoints && vuln.affectedEndpoints.length > 0) {
      vuln.affectedEndpoints.forEach(endpoint => {
        endpoints.push({
          endpoint,
          cvssScore: vuln.cvssScore,
        });
      });
    }
  });
  
  if (endpoints.length === 0) return 100;
  
  // Calculate average exposure (invert CVSS - higher CVSS = lower score)
  let totalExposure = 0;
  endpoints.forEach(ep => {
    totalExposure += (10 - ep.cvssScore); // Invert CVSS
  });
  
  const exposureScore = Math.round((totalExposure / endpoints.length) * 10);
  return Math.max(0, Math.min(100, exposureScore));
}

