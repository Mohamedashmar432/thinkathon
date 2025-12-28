import Scan, { IScan } from '../models/Scan';

export interface RemediationActivity {
  priority: number;
  title: string;
  impact: string;
  affectedDevices: string[];
  estimatedTime: string;
  cveIds: string[];
  steps: string[];
  maxCVSS: number;
}

function getEstimatedTime(software: string): string {
  const timeMap: Record<string, string> = {
    'chrome': '5 minutes',
    'google chrome': '5 minutes',
    'firefox': '5 minutes',
    'mozilla firefox': '5 minutes',
    'edge': '5 minutes',
    'nodejs': '10 minutes',
    'node.js': '10 minutes',
    'express': '15 minutes',
    'windows': '30 minutes',
    'microsoft windows': '30 minutes',
  };
  
  const lower = software.toLowerCase();
  for (const [key, time] of Object.entries(timeMap)) {
    if (lower.includes(key)) {
      return time;
    }
  }
  
  return '10 minutes';
}

function getUpdateSteps(software: string): string[] {
  const lower = software.toLowerCase();
  
  if (lower.includes('chrome') || lower.includes('google chrome')) {
    return [
      'Open Google Chrome',
      'Click the three dots menu (⋮) in the top right',
      'Go to Settings',
      'Click "About Chrome" in the left sidebar',
      'Chrome will automatically check for updates',
      'Click "Relaunch" if an update is available',
    ];
  }
  
  if (lower.includes('firefox') || lower.includes('mozilla')) {
    return [
      'Open Mozilla Firefox',
      'Click the menu button (☰)',
      'Click "Help"',
      'Click "About Firefox"',
      'Firefox will check for updates automatically',
      'Click "Restart to update Firefox" if an update is available',
    ];
  }
  
  if (lower.includes('edge')) {
    return [
      'Open Microsoft Edge',
      'Click the three dots menu (⋯)',
      'Go to Settings',
      'Click "About Microsoft Edge"',
      'Edge will automatically download updates',
      'Click "Restart" when prompted',
    ];
  }
  
  if (lower.includes('node') || lower.includes('nodejs')) {
    return [
      'Visit nodejs.org',
      'Download the latest LTS version',
      'Run the installer',
      'Restart your terminal/command prompt',
      'Verify installation: node --version',
    ];
  }
  
  if (lower.includes('windows')) {
    return [
      'Open Windows Settings',
      'Go to Update & Security',
      'Click "Check for updates"',
      'Install available updates',
      'Restart your computer if required',
    ];
  }
  
  return [
    `Visit the official website for ${software}`,
    'Download the latest version',
    'Run the installer',
    'Follow the installation wizard',
    'Restart the application',
  ];
}

export async function getTopRemediationActivities(
  scans: IScan[],
  limit: number = 5
): Promise<RemediationActivity[]> {
  // Group vulnerabilities by software
  const softwareVulns: Record<string, {
    software: string;
    version: string;
    cves: string[];
    devices: Set<string>;
    maxCVSS: number;
  }> = {};
  
  scans.forEach(scan => {
    scan.vulnerabilities.items.forEach(vuln => {
      const key = `${vuln.software}-${vuln.version}`;
      
      if (!softwareVulns[key]) {
        softwareVulns[key] = {
          software: vuln.software,
          version: vuln.version,
          cves: [],
          devices: new Set(),
          maxCVSS: 0,
        };
      }
      
      softwareVulns[key].cves.push(vuln.cveId);
      softwareVulns[key].devices.add(scan.deviceId);
      softwareVulns[key].maxCVSS = Math.max(
        softwareVulns[key].maxCVSS,
        vuln.cvssScore
      );
    });
  });
  
  // Convert to activities and sort by priority
  const activities: RemediationActivity[] = Object.values(softwareVulns)
    .map((sv, index) => ({
      priority: index + 1,
      title: `Update ${sv.software} to latest version`,
      impact: `Will fix ${sv.cves.length} vulnerability${sv.cves.length !== 1 ? 'ies' : ''} across ${sv.devices.size} device${sv.devices.size !== 1 ? 's' : ''}`,
      affectedDevices: Array.from(sv.devices),
      estimatedTime: getEstimatedTime(sv.software),
      cveIds: [...new Set(sv.cves)],
      steps: getUpdateSteps(sv.software),
      maxCVSS: sv.maxCVSS,
    }))
    .sort((a, b) => {
      // Priority: highest CVSS, then most CVEs, then most devices
      if (b.maxCVSS !== a.maxCVSS) return b.maxCVSS - a.maxCVSS;
      if (b.cveIds.length !== a.cveIds.length) return b.cveIds.length - a.cveIds.length;
      return b.affectedDevices.length - a.affectedDevices.length;
    })
    .slice(0, limit)
    .map((activity, index) => ({
      ...activity,
      priority: index + 1,
    }));
  
  return activities;
}

