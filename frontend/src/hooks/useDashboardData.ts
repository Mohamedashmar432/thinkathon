// Centralized dashboard data management hook
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface DashboardData {
  stats: any;
  timeline: any[];
  topSoftware: any[];
  insights: any;
  activities: any[];
  checklist: any;
  orgScore: any;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Mock data for when API calls fail
const getMockData = () => ({
  stats: {
    userSecureScore: 75,
    endpointExposureScore: 85,
    totalScans: 5,
    totalDevices: 2,
    totalVulnerabilities: 12,
    criticalVulnerabilities: 3,
    exploitableVulnerabilities: 2,
    lastScanDate: new Date().toISOString(),
    recentScans: []
  },
  timeline: [
    { date: '2024-12-25', score: 70 },
    { date: '2024-12-26', score: 72 },
    { date: '2024-12-27', score: 75 },
    { date: '2024-12-28', score: 78 },
    { date: '2024-12-29', score: 85 }
  ],
  topSoftware: [
    {
      name: 'Adobe Reader',
      version: '2020.1.0',
      devicesAffected: 2,
      cveCount: 5,
      highestCVSS: 8.5,
      latestCVE: 'CVE-2023-1234',
      recommendation: 'Update Adobe Reader to latest version'
    },
    {
      name: 'Chrome Browser',
      version: '108.0.0',
      devicesAffected: 1,
      cveCount: 3,
      highestCVSS: 7.2,
      latestCVE: 'CVE-2023-5678',
      recommendation: 'Update Chrome to latest version'
    }
  ],
  insights: {
    total: 12,
    critical: 3,
    high: 4,
    medium: 3,
    low: 2,
    exploitable: 2,
    byCategory: {
      'Remote Code Execution': 3,
      'Privilege Escalation': 2,
      'Information Disclosure': 4,
      'Denial of Service': 2,
      'Cross-Site Scripting': 1
    },
    trend: {
      lastWeek: 12,
      change: -2,
      percentage: -14.3
    }
  },
  activities: [
    {
      priority: 1,
      title: 'Update Adobe Reader',
      impact: 'Fixes 5 critical vulnerabilities',
      estimatedTime: '10 minutes',
      affectedDevices: ['DESKTOP-001', 'LAPTOP-002'],
      steps: [
        'Download latest Adobe Reader',
        'Run installer as administrator',
        'Restart applications',
        'Verify update completed'
      ]
    },
    {
      priority: 2,
      title: 'Apply Windows Security Updates',
      impact: 'Patches 3 high-severity vulnerabilities',
      estimatedTime: '30 minutes',
      affectedDevices: ['DESKTOP-001'],
      steps: [
        'Open Windows Update',
        'Check for updates',
        'Install all security updates',
        'Restart computer'
      ]
    }
  ],
  checklist: {
    date: new Date().toISOString().split('T')[0],
    checklist: [
      { id: 1, task: 'OS Updated', completed: true },
      { id: 2, task: 'No High-Risk Software', completed: false },
      { id: 3, task: 'Antivirus Enabled', completed: true },
      { id: 4, task: 'No Critical CVEs', completed: false },
      { id: 5, task: 'Firewall Active', completed: true }
    ],
    completionPercentage: 60,
    streakDays: 3,
    contributionToScore: 6
  }
});

export const useDashboardData = (timelineDays: number = 30) => {
  const { user, token } = useAuth();
  const [data, setData] = useState<DashboardData>({
    stats: null,
    timeline: [],
    topSoftware: [],
    insights: null,
    activities: [],
    checklist: null,
    orgScore: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const isOrganizationUser = user?.email?.endsWith('@thinkbridge.com') || user?.email?.endsWith('@thinkbridge.in');

  const fetchAllData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));
      
      console.log('🔄 Fetching dashboard data...', { 
        token: token ? 'Present' : 'Missing',
        user: user?.email || 'Not logged in',
        isOrganizationUser 
      });

      // Always call API endpoints - they now handle unauthenticated users with demo data
      console.log('🌐 Making API calls...');
      
      // Fetch all dashboard data in parallel for consistency
      const requests = [
        axios.get('/api/dashboard/stats'),
        axios.get(`/api/dashboard/endpoint-exposure-timeline?days=${timelineDays}`),
        axios.get('/api/dashboard/top-vulnerable-software'),
        axios.get('/api/dashboard/vulnerability-insights'),
        axios.get('/api/dashboard/top-remediation-activities'),
        axios.get('/api/dashboard/daily-checklist'),
      ];

      // Add organization score request if user is from ThinkBridge
      if (isOrganizationUser) {
        requests.push(axios.get('/api/organization-score/score'));
        console.log('🏢 Adding organization score request for ThinkBridge user');
      }

      const responses = await Promise.allSettled(requests);
      
      console.log('📡 API responses received:', responses.map((r, i) => ({
        index: i,
        status: r.status,
        error: r.status === 'rejected' ? r.reason.message : null
      })));

      // Process responses - all should succeed now with demo data fallback
      const statsRes = responses[0].status === 'fulfilled' ? responses[0].value : null;
      const timelineRes = responses[1].status === 'fulfilled' ? responses[1].value : null;
      const softwareRes = responses[2].status === 'fulfilled' ? responses[2].value : null;
      const insightsRes = responses[3].status === 'fulfilled' ? responses[3].value : null;
      const activitiesRes = responses[4].status === 'fulfilled' ? responses[4].value : null;
      const checklistRes = responses[5].status === 'fulfilled' ? responses[5].value : null;
      const orgScoreRes = responses[6]?.status === 'fulfilled' ? responses[6].value : null;

      // Check if any requests failed
      const failedRequests = responses.filter(r => r.status === 'rejected');
      
      if (failedRequests.length > 0) {
        console.warn('Some API requests failed:', failedRequests.map(r => r.reason?.message));
        // Fall back to mock data only if API calls fail
        const mockData = getMockData();
        
        setData({
          stats: statsRes?.data || mockData.stats,
          timeline: timelineRes?.data?.timeline || mockData.timeline,
          topSoftware: softwareRes?.data?.software || mockData.topSoftware,
          insights: insightsRes?.data?.insights || mockData.insights,
          activities: activitiesRes?.data?.activities || mockData.activities,
          checklist: checklistRes?.data || mockData.checklist,
          orgScore: orgScoreRes?.data || (isOrganizationUser ? {
            organizationScore: 46.83,
            userContribution: -36,
            totalMembers: 25,
            totalDevices: 45,
            ranking: { position: 18, outOf: 25 },
            topContributors: [],
            explanation: 'Your organization\'s security score is 46.83%. There\'s room for improvement.'
          } : null),
          loading: false,
          error: 'Some data from demo mode - login for full features',
          lastUpdated: new Date(),
        });
      } else {
        // All requests succeeded
        const isDemo = statsRes?.data?.isDemo || timelineRes?.data?.isDemo;
        
        setData({
          stats: statsRes?.data || {},
          timeline: timelineRes?.data?.timeline || [],
          topSoftware: softwareRes?.data?.software || [],
          insights: insightsRes?.data?.insights || [],
          activities: activitiesRes?.data?.activities || [],
          checklist: checklistRes?.data || [],
          orgScore: orgScoreRes?.data || (isOrganizationUser ? {
            organizationScore: 46.83,
            userContribution: -36,
            totalMembers: 25,
            totalDevices: 45,
            ranking: { position: 18, outOf: 25 },
            topContributors: [],
            explanation: 'Your organization\'s security score is 46.83%. There\'s room for improvement.'
          } : null),
          loading: false,
          error: isDemo ? 'Demo mode - login for personalized data' : null,
          lastUpdated: new Date(),
        });
      }
      
      console.log('✅ Dashboard data loaded successfully:', {
        userSecureScore: statsRes?.data?.userSecureScore,
        orgScore: orgScoreRes?.data?.organizationScore || (isOrganizationUser ? 46.83 : 'N/A'),
        checklistCompletion: checklistRes?.data?.completionPercentage,
        authToken: token ? 'Present' : 'Missing',
        isDemo: statsRes?.data?.isDemo || false
      });
    } catch (error: any) {
      console.error('❌ Error fetching dashboard data:', error);
      
      // Fallback to mock data on error
      console.log('🔄 Falling back to mock data due to error');
      const mockData = getMockData();
      setData({
        stats: mockData.stats,
        timeline: mockData.timeline,
        topSoftware: mockData.topSoftware,
        insights: mockData.insights,
        activities: mockData.activities,
        checklist: mockData.checklist,
        orgScore: isOrganizationUser ? {
          organizationScore: 46.83,
          userContribution: -36,
          totalMembers: 25,
          totalDevices: 45,
          ranking: { position: 18, outOf: 25 },
          topContributors: [],
          explanation: 'Your organization\'s security score is 46.83%. There\'s room for improvement.'
        } : null,
        loading: false,
        error: 'Using demo data - login for full features',
        lastUpdated: new Date(),
      });
      console.log('✅ Fallback mock data loaded');
    }
  }, [timelineDays, isOrganizationUser, token]);

  const updateChecklistItem = useCallback(async (itemId: number, completed: boolean) => {
    try {
      if (!token) {
        // Update local state for demo mode
        setData(prev => ({
          ...prev,
          checklist: {
            ...prev.checklist,
            checklist: prev.checklist.checklist.map((item: any) =>
              item.id === itemId ? { ...item, completed } : item
            ),
            completionPercentage: Math.round(
              (prev.checklist.checklist.filter((item: any, idx: number) => 
                idx === itemId - 1 ? completed : item.completed
              ).length / prev.checklist.checklist.length) * 100
            ),
          },
        }));
        console.log('Updated checklist item in demo mode');
        return;
      }

      const res = await axios.put(`/api/dashboard/daily-checklist/${itemId}`, { completed });
      
      setData(prev => ({
        ...prev,
        checklist: {
          ...prev.checklist,
          checklist: prev.checklist.checklist.map((item: any) =>
            item.id === itemId ? { ...item, completed } : item
          ),
          completionPercentage: res.data.newCompletionPercentage,
        },
      }));

      // Refresh stats after checklist update to sync secure score
      const statsRes = await axios.get('/api/dashboard/stats');
      setData(prev => ({
        ...prev,
        stats: statsRes.data,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      console.error('Error updating checklist:', error);
      throw error;
    }
  }, [token]);

  const refreshData = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    ...data,
    updateChecklistItem,
    refreshData,
    isOrganizationUser,
  };
};