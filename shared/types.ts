// Shared TypeScript types for frontend and backend

export interface User {
  _id?: string;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  apiKey?: string;
  role?: string;
  createdAt?: Date;
  lastLogin?: Date;
  dailyChecklist?: DailyChecklist;
}

export interface DailyChecklist {
  date: Date;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: number;
  task: string;
  completed: boolean;
  completedAt?: Date;
}

export interface SystemInfo {
  computerName: string;
  osName: string;
  osVersion: string;
  osBuild: string;
  architecture: string;
  manufacturer: string;
  model: string;
}

export interface Software {
  name: string;
  version: string;
  publisher: string;
  installDate: string;
}

export interface BrowserExtension {
  browser: string;
  name: string;
  version: string;
  extensionId: string;
}

export interface Patches {
  totalPatches: number;
  latestPatchId: string;
  latestPatchDate: Date;
}

export interface Vulnerability {
  software: string;
  version: string;
  cveId: string;
  cvssScore: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  exploitable: boolean;
  recommendation: string;
  affectedEndpoints?: string[];
}

export interface Vulnerabilities {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  exploitable: number;
  items: Vulnerability[];
}

export interface Scan {
  _id?: string;
  userId: string;
  userEmail: string;
  deviceId: string;
  scanTimestamp: Date;
  systemInfo: SystemInfo;
  software: Software[];
  browserExtensions?: BrowserExtension[];
  patches: Patches;
  vulnerabilities: Vulnerabilities;
  secureScore?: number;
  endpointExposureScore?: number;
  status: 'pending' | 'analyzing' | 'completed';
  createdAt?: Date;
  analyzedAt?: Date;
}

export interface Organization {
  _id?: string;
  domain: string;
  name: string;
  secureScore: number;
  totalMembers: number;
  totalDevices: number;
  scoreHistory: ScoreHistory[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScoreHistory {
  date: Date;
  score: number;
}

export interface Endpoint {
  _id?: string;
  scanId: string;
  userId: string;
  endpoint: string;
  exposureScore: number;
  vulnerabilities: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  detectedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  token?: string;
  user?: User;
  scan?: Scan;
  scans?: Scan[];
  totalScans?: number;
  [key: string]: any;
}

export interface DashboardStats {
  userSecureScore: number;
  organizationSecureScore?: number;
  endpointExposureScore: number;
  totalScans: number;
  totalDevices: number;
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  exploitableVulnerabilities: number;
  lastScanDate?: string;
  recentScans: Scan[];
}

export interface EndpointExposureTimeline {
  date: string;
  score: number;
}

export interface TopEndpoint {
  endpoint: string;
  exposureScore: number;
  vulnerabilities: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface TopVulnerableSoftware {
  name: string;
  version: string;
  devicesAffected: number;
  cveCount: number;
  highestCVSS: number;
  latestCVE: string;
  recommendation: string;
}

export interface VulnerabilityInsights {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  exploitable: number;
  byCategory: Record<string, number>;
  trend: {
    lastWeek: number;
    change: number;
    percentage: number;
  };
}

export interface RemediationActivity {
  priority: number;
  title: string;
  impact: string;
  affectedDevices: string[];
  estimatedTime: string;
  cveIds: string[];
  steps: string[];
}

export interface OrganizationScore {
  organizationScore: number;
  userContribution: number;
  totalMembers: number;
  totalDevices: number;
  ranking: {
    position: number;
    outOf: number;
  };
  topContributors: Array<{
    name: string;
    score: number;
    contribution: number;
  }>;
}

