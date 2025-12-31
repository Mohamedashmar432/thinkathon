import React, { useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import RemediationModal from '../components/RemediationModal';
import axios from 'axios';

const Dashboard = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [timelineDays, setTimelineDays] = useState(30);
  const [remediationModal, setRemediationModal] = useState<{
    isOpen: boolean;
    software: any;
  }>({ isOpen: false, software: null });
  const [agentStats, setAgentStats] = useState<any>(null);

  const {
    stats,
    timeline,
    topSoftware,
    insights,
    activities,
    checklist,
    orgScore,
    loading,
    error,
    lastUpdated,
    updateChecklistItem,
    refreshData,
    isOrganizationUser,
  } = useDashboardData(timelineDays);

  // Check agent presence for CTA button
  const checkAgentPresence = useCallback(async () => {
    if (!user) return null;
    
    try {
      const response = await axios.get('/api/agent/stats/overview');
      setAgentStats(response.data.stats);
      return response.data.stats;
    } catch (error) {
      console.error('Error checking agent presence:', error);
      return null;
    }
  }, [user]);

  // Handle Start Security Scan button click
  const handleStartSecurityScan = useCallback(async () => {
    console.log('Start Security Scan clicked');
    
    // Check if user has any agents installed
    const stats = agentStats || await checkAgentPresence();
    
    if (!stats || stats.total === 0) {
      // No agents installed - redirect to agent installation page
      console.log('No agents found, redirecting to agent installation');
      window.location.href = '/agents';
    } else if (stats.active === 0) {
      // Agents installed but none active - redirect to agent page with message
      console.log('Agents installed but none active, redirecting to agent management');
      window.location.href = '/agents?message=activate';
    } else {
      // Active agents available - redirect to scanner page
      console.log('Active agents found, redirecting to scanner');
      window.location.href = '/scanner';
    }
  }, [agentStats, checkAgentPresence]);

  // Load agent stats on component mount
  React.useEffect(() => {
    if (user && !agentStats) {
      checkAgentPresence();
    }
  }, [user, agentStats, checkAgentPresence]);

  const handleUninstallSoftware = async (softwareName: string, deviceId: string) => {
    try {
      await axios.post(`/api/agent/${deviceId}/uninstall`, { softwareName });
      
      // Log remediation activity
      await axios.post('/api/dashboard/log-remediation', {
        action: 'software_uninstall',
        target: softwareName,
        deviceId,
        timestamp: new Date().toISOString(),
      });

      // Refresh dashboard data to reflect changes
      setTimeout(() => {
        refreshData();
      }, 2000);
    } catch (error) {
      throw error;
    }
  };

  const COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'];

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-blue-500' : 'border-blue-600'} mx-auto mb-4`}></div>
            <p className={textSecondary}>Loading dashboard data...</p>
            <p className={`text-xs ${textMuted} mt-2`}>This may take a few moments</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error && !stats) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md">
              <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-yellow-800 font-medium mb-2">Demo Mode Active</p>
              <p className="text-yellow-700 text-sm mb-4">{error}</p>
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!stats) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className={textMuted}>No dashboard data available</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header with sync status */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`}>Security Dashboard</h1>
            {error && (
              <div className="flex items-center mt-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <p className={`text-sm text-blue-600`}>Demo Mode - {error}</p>
              </div>
            )}
            {lastUpdated && (
              <p className={`text-sm ${textMuted} mt-1`}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex space-x-3">
            {error && (
              <button
                onClick={() => window.location.href = '/auth'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Login for Real Data
              </button>
            )}
            <button
              onClick={refreshData}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Hero Section - Secure Scores */}
        <div className={`grid grid-cols-1 ${isOrganizationUser ? 'lg:grid-cols-2' : ''} gap-6 mb-8`}>
          <div className={`${cardBg} rounded-xl p-8`}>
            <h2 className={`text-xl font-semibold ${textSecondary} mb-6`}>Your Secure Score</h2>
            <div className="flex items-center justify-center">
              <div className="relative w-52 h-52">
                <svg className="transform -rotate-90 w-52 h-52">
                  <circle
                    cx="104"
                    cy="104"
                    r="96"
                    stroke={isDark ? '#374151' : '#E5E7EB'}
                    strokeWidth="16"
                    fill="none"
                  />
                  <circle
                    cx="104"
                    cy="104"
                    r="96"
                    stroke={(stats.userSecureScore || 0) >= 75 ? '#10B981' : (stats.userSecureScore || 0) >= 50 ? '#F59E0B' : '#EF4444'}
                    strokeWidth="16"
                    fill="none"
                    strokeDasharray={`${((stats.userSecureScore || 0) / 100) * 603.19} 603.19`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-5xl font-bold ${textPrimary}`}>{stats.userSecureScore || 0}</span>
                  <span className={`text-sm ${textMuted} mt-1`}>out of 100</span>
                </div>
              </div>
            </div>
            {(stats.totalScans === 0 || error) && (
              <div className="text-center mt-6">
                <p className={`text-sm ${textMuted} mb-4`}>
                  {error ? 'Demo data shown - run a scan for personalized results' : 'Run a security scan to see your score'}
                </p>
                <button
                  onClick={handleStartSecurityScan}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium inline-flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Security Scan
                </button>
              </div>
            )}
          </div>

          {/* Organization Score - Only for ThinkBridge users */}
          {isOrganizationUser && orgScore && (
            <div className={`${cardBg} rounded-xl p-8`}>
              <h2 className={`text-xl font-semibold ${textSecondary} mb-6`}>Organization Secure Score</h2>
              <div className="flex items-center justify-center mb-6">
                <div className="relative w-52 h-52">
                  <svg className="transform -rotate-90 w-52 h-52">
                    <circle
                      cx="104"
                      cy="104"
                      r="96"
                      stroke={isDark ? '#374151' : '#E5E7EB'}
                      strokeWidth="16"
                      fill="none"
                    />
                    <circle
                      cx="104"
                      cy="104"
                      r="96"
                      stroke="#3B82F6"
                      strokeWidth="16"
                      fill="none"
                      strokeDasharray={`${(orgScore.organizationScore / 100) * 603.19} 603.19`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-5xl font-bold ${textPrimary}`}>{orgScore.organizationScore}%</span>
                    <span className={`text-sm ${textMuted} mt-1`}>ThinkBridge</span>
                  </div>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className={`text-sm ${textSecondary}`}>
                  Your contribution: <span className={orgScore.userContribution > 0 ? 'text-green-600' : 'text-red-600'}>{orgScore.userContribution > 0 ? '+' : ''}{orgScore.userContribution} points</span>
                </p>
                <p className={`text-sm ${textSecondary}`}>
                  Team rank: <span className="font-semibold">#{orgScore.ranking.position}</span> of {orgScore.ranking.outOf}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Endpoint Exposure Section */}
        <div className={`${cardBg} rounded-xl p-6 mb-8`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-xl font-semibold ${textPrimary}`}>Security Score Timeline</h2>
            <div className="flex space-x-2">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimelineDays(days)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timelineDays === days
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                <XAxis 
                  dataKey="date" 
                  stroke={isDark ? '#9CA3AF' : '#6B7280'}
                  fontSize={12}
                />
                <YAxis 
                  domain={[0, 100]} 
                  stroke={isDark ? '#9CA3AF' : '#6B7280'}
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    border: isDark ? '1px solid #374151' : '1px solid #E5E7EB',
                    borderRadius: '8px',
                    color: isDark ? '#F9FAFB' : '#111827'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className={`text-sm ${textSecondary}`}>
              Current Score: <span className={`font-bold text-lg ${textPrimary}`}>{stats.endpointExposureScore}</span>
            </p>
            <p className={`text-xs ${textMuted}`}>
              Higher scores indicate better security posture
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className={`${cardBg} rounded-xl p-6`}>
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${textSecondary}`}>Total Scans</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{stats.totalScans}</p>
              </div>
            </div>
          </div>
          
          <div className={`${cardBg} rounded-xl p-6`}>
            <div className="flex items-center">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${textSecondary}`}>Devices</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{stats.totalDevices}</p>
              </div>
            </div>
          </div>
          
          <div className={`${cardBg} rounded-xl p-6`}>
            <div className="flex items-center">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${textSecondary}`}>Critical Vulns</p>
                <p className="text-2xl font-bold text-red-500">{stats.criticalVulnerabilities}</p>
              </div>
            </div>
          </div>
          
          <div className={`${cardBg} rounded-xl p-6`}>
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${textSecondary}`}>Last Scan</p>
                <p className={`text-sm font-semibold ${textPrimary}`}>
                  {stats.lastScanDate
                    ? new Date(stats.lastScanDate).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Vulnerable Software with Remediation Actions */}
        <div className={`${cardBg} rounded-lg p-6 mb-8`}>
          <h2 className={`text-lg font-semibold ${textSecondary} mb-4`}>Top Vulnerable Software</h2>
          <div className="space-y-3">
            {topSoftware.map((software, idx) => (
              <div key={idx} className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className={`font-semibold ${textPrimary}`}>{software.name}</h3>
                    <p className={`text-sm ${textSecondary}`}>Version: {software.version}</p>
                    <p className={`text-sm ${textSecondary} mt-1`}>
                      {software.cveCount} CVE(s) • {software.devicesAffected} device(s) • CVSS: {software.highestCVSS}
                    </p>
                    <p className="text-sm text-blue-500 mt-2">{software.recommendation}</p>
                  </div>
                  <div className="ml-4 flex space-x-2">
                    <button
                      onClick={() => setRemediationModal({
                        isOpen: true,
                        software: {
                          name: software.name,
                          version: software.version,
                          deviceId: 'primary', // This would come from actual device data
                          deviceName: 'Primary Device'
                        }
                      })}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors"
                      title="Remove this software from your devices"
                    >
                      <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vulnerability Insights */}
        {insights && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className={`${cardBg} rounded-lg p-6`}>
              <h2 className={`text-lg font-semibold ${textSecondary} mb-4`}>Vulnerability Insights</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{insights.total}</p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{insights.critical}</p>
                  <p className="text-xs text-gray-600">Critical</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{insights.exploitable}</p>
                  <p className="text-xs text-gray-600">Exploitable</p>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(insights.byCategory).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(insights.byCategory).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-6`}>
              <h2 className={`text-lg font-semibold ${textSecondary} mb-4`}>Trend</h2>
              <div className="text-center">
                <p className={`text-4xl font-bold mb-2 ${textPrimary}`}>{insights.trend.lastWeek}</p>
                <p className={`text-sm ${textSecondary} mb-4`}>Last Week</p>
                <div className="flex items-center justify-center space-x-2">
                  <span className={`text-lg font-semibold ${insights.trend.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {insights.trend.change >= 0 ? '↑' : '↓'} {Math.abs(insights.trend.change)}
                  </span>
                  <span className={`text-sm ${textSecondary}`}>
                    ({insights.trend.percentage >= 0 ? '+' : ''}{insights.trend.percentage}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Remediation Activities */}
        <div className={`${cardBg} rounded-lg p-6 mb-8`}>
          <h2 className={`text-lg font-semibold ${textSecondary} mb-4`}>Top Remediation Activities</h2>
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.priority} className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                    {activity.priority}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${textPrimary}`}>{activity.title}</h3>
                    <p className={`text-sm ${textSecondary} mt-1`}>{activity.impact}</p>
                    <p className={`text-xs ${textMuted} mt-1`}>
                      Estimated time: {activity.estimatedTime} • {activity.affectedDevices.length} device(s)
                    </p>
                    <details className="mt-2">
                      <summary className="text-sm text-blue-500 cursor-pointer">View steps</summary>
                      <ol className={`list-decimal list-inside mt-2 space-y-1 text-sm ${textSecondary}`}>
                        {activity.steps.map((step: any, idx: number) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </details>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Checklist */}
        {checklist && (
          <div className={`${cardBg} rounded-lg p-6 mb-8`}>
            <h2 className={`text-lg font-semibold ${textSecondary} mb-4`}>
              Daily Security Checklist - {checklist.date}
            </h2>
            <div className="space-y-2 mb-4">
              {checklist.checklist.map((item: any) => (
                <label key={item.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => updateChecklistItem(item.id, e.target.checked)}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className={item.completed ? `line-through ${textMuted}` : textPrimary}>
                    {item.task}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className={`flex-1 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded-full h-2`}>
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${checklist.completionPercentage}%` }}
                ></div>
              </div>
              <span className={`ml-4 text-sm font-semibold ${textPrimary}`}>
                {checklist.completionPercentage}% Complete
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className={`text-sm ${textSecondary}`}>
                🔥 {checklist.streakDays} day streak!
              </p>
              <p className={`text-sm ${textSecondary}`}>
                Points earned today: {checklist.contributionToScore}
              </p>
            </div>
            <p className={`text-xs ${textMuted} mt-2`}>
              Complete checklist to improve your secure score by +5 points
            </p>
          </div>
        )}
      </div>

      {/* Remediation Modal */}
      <RemediationModal
        isOpen={remediationModal.isOpen}
        onClose={() => setRemediationModal({ isOpen: false, software: null })}
        software={remediationModal.software}
        onConfirm={handleUninstallSoftware}
      />
    </Layout>
  );
};

export default Dashboard;

