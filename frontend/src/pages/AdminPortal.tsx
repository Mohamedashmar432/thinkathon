import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface SystemOverview {
  users: {
    total: number;
    active: number;
    organization: number;
  };
  agents: {
    total: number;
    active: number;
    windows: number;
    linux: number;
    macos: number;
  };
  scans: {
    total: number;
    completed: number;
    failed: number;
    recent: number;
  };
  threats: {
    total: number;
    exploited: number;
    correlations: number;
    recent: number;
  };
  scheduled: {
    total: number;
    enabled: number;
    recent: number;
  };
  recommendations: {
    total: number;
    active: number;
    completed: number;
  };
  system: {
    uptime: number;
    memory: any;
    recentErrors: number;
  };
}

interface TroubleshootResult {
  subsystem: string;
  status: 'OK' | 'WARNING' | 'FAILED';
  message: string;
  details?: any;
  rootCause?: string;
  impactedUsers?: string[];
  impactedEndpoints?: string[];
  recommendedAction?: string;
  autoFixApplied?: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
}

interface TroubleshootReport {
  executionId: string;
  timestamp: string;
  duration: number;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  healthScore: number;
  results: TroubleshootResult[];
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    failed: number;
    autoFixesApplied: number;
  };
}

interface SystemLog {
  _id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  component: string;
  action: string;
  message: string;
  userId?: string;
  userEmail?: string;
  deviceId?: string;
  scanId?: string;
  cveId?: string;
  metadata?: any;
  error?: any;
  duration?: number;
  success: boolean;
}

const AdminPortal = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'troubleshoot' | 'logs' | 'users' | 'agents'>('overview');
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [troubleshootReport, setTroubleshootReport] = useState<TroubleshootReport | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [troubleshooting, setTroubleshooting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logFilters, setLogFilters] = useState({
    level: '',
    component: '',
    success: '',
    search: '',
    limit: 100
  });

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';

  // Check if user is admin
  const isAdmin = user?.email?.includes('admin') || 
                  user?.email === 'ashmar@thinkbridge.in' ||
                  ['admin@thinkbridge.in', 'admin@thinkbridge.com', 'support@thinkbridge.in'].includes(user?.email || '');

  // Fetch system overview
  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/overview');
      setOverview(response.data.overview);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching overview:', error);
      setError('Failed to fetch system overview');
    } finally {
      setLoading(false);
    }
  }, []);

  // Run troubleshoot
  const runTroubleshoot = async () => {
    try {
      setTroubleshooting(true);
      setError(null);
      const response = await axios.post('/api/admin/troubleshoot');
      setTroubleshootReport(response.data.report);
    } catch (error: any) {
      console.error('Error running troubleshoot:', error);
      setError('Failed to run system troubleshoot');
    } finally {
      setTroubleshooting(false);
    }
  };

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (logFilters.level) params.append('level', logFilters.level);
      if (logFilters.component) params.append('component', logFilters.component);
      if (logFilters.success) params.append('success', logFilters.success);
      if (logFilters.search) params.append('search', logFilters.search);
      params.append('limit', logFilters.limit.toString());

      const response = await axios.get(`/api/admin/logs?${params}`);
      setLogs(response.data.logs);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      setError('Failed to fetch system logs');
    } finally {
      setLoading(false);
    }
  }, [logFilters]);

  // Initial load
  useEffect(() => {
    if (isAdmin) {
      fetchOverview();
    }
  }, [isAdmin, fetchOverview]);

  // Load data based on active tab
  useEffect(() => {
    if (!isAdmin) return;

    switch (activeTab) {
      case 'overview':
        fetchOverview();
        break;
      case 'logs':
        fetchLogs();
        break;
    }
  }, [activeTab, isAdmin, fetchOverview, fetchLogs]);

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  // Format memory
  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
      case 'HEALTHY':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'WARNING':
      case 'DEGRADED':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'FAILED':
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className={`text-2xl font-bold ${textPrimary} mb-2`}>Access Denied</h1>
            <p className={textSecondary}>You don't have permission to access the admin portal.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`}>Admin Portal</h1>
            <p className={`mt-2 ${textSecondary}`}>
              System administration and troubleshooting dashboard
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>
              Admin Access
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className={`${cardBg} rounded-lg mb-6`}>
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { key: 'overview', label: 'System Overview', icon: '📊' },
                { key: 'troubleshoot', label: 'Troubleshoot', icon: '🔧' },
                { key: 'logs', label: 'System Logs', icon: '📋' },
                { key: 'users', label: 'Users', icon: '👥' },
                { key: 'agents', label: 'Agents', icon: '🤖' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : `border-transparent ${textSecondary} hover:text-gray-700 hover:border-gray-300`
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* System Health Score */}
            {troubleshootReport && (
              <div className={`${cardBg} rounded-lg p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-xl font-semibold ${textPrimary}`}>System Health</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(troubleshootReport.overallStatus)}`}>
                    {troubleshootReport.overallStatus}
                  </span>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className={textSecondary}>Health Score</span>
                      <span className={`font-semibold ${textPrimary}`}>{troubleshootReport.healthScore}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          troubleshootReport.healthScore >= 90 ? 'bg-green-500' :
                          troubleshootReport.healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${troubleshootReport.healthScore}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className={`text-sm ${textMuted}`}>
                    Last check: {formatDate(troubleshootReport.timestamp)}
                  </div>
                </div>
              </div>
            )}

            {/* System Overview Cards */}
            {overview && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Users */}
                <div className={`${cardBg} rounded-lg p-6`}>
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Users</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Total</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.users.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Active (7d)</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.users.active}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Organization</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.users.organization}</span>
                    </div>
                  </div>
                </div>

                {/* Agents */}
                <div className={`${cardBg} rounded-lg p-6`}>
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Agents</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Total</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.agents.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Active</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.agents.active}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={textMuted}>Windows: {overview.agents.windows}</span>
                      <span className={textMuted}>Linux: {overview.agents.linux}</span>
                      <span className={textMuted}>macOS: {overview.agents.macos}</span>
                    </div>
                  </div>
                </div>

                {/* Scans */}
                <div className={`${cardBg} rounded-lg p-6`}>
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Scans</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Total</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.scans.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Completed</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.scans.completed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Failed</span>
                      <span className={`font-semibold text-red-600`}>{overview.scans.failed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Recent (24h)</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.scans.recent}</span>
                    </div>
                  </div>
                </div>

                {/* Threats */}
                <div className={`${cardBg} rounded-lg p-6`}>
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Threat Intelligence</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Total Threats</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.threats.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Exploited</span>
                      <span className={`font-semibold text-red-600`}>{overview.threats.exploited.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Correlations</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.threats.correlations.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Recent (7d)</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.threats.recent.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Scheduled Scans */}
                <div className={`${cardBg} rounded-lg p-6`}>
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Scheduled Scans</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Total</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.scheduled.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Enabled</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.scheduled.enabled}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Recent (24h)</span>
                      <span className={`font-semibold ${textPrimary}`}>{overview.scheduled.recent}</span>
                    </div>
                  </div>
                </div>

                {/* System Resources */}
                <div className={`${cardBg} rounded-lg p-6`}>
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>System Resources</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={textSecondary}>Uptime</span>
                      <span className={`font-semibold ${textPrimary}`}>{formatUptime(overview.system.uptime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Memory (Heap)</span>
                      <span className={`font-semibold ${textPrimary}`}>{formatMemory(overview.system.memory.heapUsed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={textSecondary}>Recent Errors</span>
                      <span className={`font-semibold ${overview.system.recentErrors > 0 ? 'text-red-600' : textPrimary}`}>
                        {overview.system.recentErrors}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'troubleshoot' && (
          <div className="space-y-6">
            {/* Troubleshoot Controls */}
            <div className={`${cardBg} rounded-lg p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-xl font-semibold ${textPrimary}`}>System Troubleshoot</h2>
                  <p className={`mt-1 ${textSecondary}`}>
                    Run comprehensive system diagnostics to identify and resolve issues
                  </p>
                </div>
                <button
                  onClick={runTroubleshoot}
                  disabled={troubleshooting}
                  className={`px-6 py-3 rounded-lg font-medium ${
                    troubleshooting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {troubleshooting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Running Diagnostics...
                    </div>
                  ) : (
                    '🔧 Run Troubleshoot'
                  )}
                </button>
              </div>
            </div>

            {/* Troubleshoot Results */}
            {troubleshootReport && (
              <div className={`${cardBg} rounded-lg p-6`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`text-lg font-semibold ${textPrimary}`}>Diagnostic Report</h3>
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(troubleshootReport.overallStatus)}`}>
                      {troubleshootReport.overallStatus}
                    </span>
                    <span className={`text-sm ${textMuted}`}>
                      {formatDate(troubleshootReport.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${textPrimary}`}>{troubleshootReport.summary.totalChecks}</div>
                    <div className={`text-sm ${textMuted}`}>Total Checks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{troubleshootReport.summary.passed}</div>
                    <div className={`text-sm ${textMuted}`}>Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{troubleshootReport.summary.warnings}</div>
                    <div className={`text-sm ${textMuted}`}>Warnings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{troubleshootReport.summary.failed}</div>
                    <div className={`text-sm ${textMuted}`}>Failed</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${textPrimary}`}>{troubleshootReport.healthScore}%</div>
                    <div className={`text-sm ${textMuted}`}>Health Score</div>
                  </div>
                </div>

                {/* Detailed Results */}
                <div className="space-y-4">
                  {troubleshootReport.results.map((result, index) => (
                    <div key={index} className={`border rounded-lg p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className={`font-medium ${textPrimary}`}>{result.subsystem}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(result.status)}`}>
                              {result.status}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(result.severity)}`}>
                              {result.severity}
                            </span>
                          </div>
                          <p className={`${textSecondary} mb-2`}>{result.message}</p>
                          
                          {result.rootCause && (
                            <div className="mb-2">
                              <span className={`text-sm font-medium ${textMuted}`}>Root Cause: </span>
                              <span className={`text-sm ${textSecondary}`}>{result.rootCause}</span>
                            </div>
                          )}
                          
                          {result.recommendedAction && (
                            <div className="mb-2">
                              <span className={`text-sm font-medium ${textMuted}`}>Recommended Action: </span>
                              <span className={`text-sm ${textSecondary}`}>{result.recommendedAction}</span>
                            </div>
                          )}
                          
                          {result.impactedUsers && result.impactedUsers.length > 0 && (
                            <div className="mb-2">
                              <span className={`text-sm font-medium ${textMuted}`}>Impacted Users: </span>
                              <span className={`text-sm ${textSecondary}`}>{result.impactedUsers.join(', ')}</span>
                            </div>
                          )}
                          
                          {result.autoFixApplied && (
                            <div className="flex items-center text-sm text-green-600">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Auto-fix applied
                            </div>
                          )}
                        </div>
                        <div className={`text-xs ${textMuted}`}>
                          {formatDate(result.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6">
            {/* Log Filters */}
            <div className={`${cardBg} rounded-lg p-6`}>
              <h2 className={`text-xl font-semibold ${textPrimary} mb-4`}>System Logs</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-1`}>Level</label>
                  <select
                    value={logFilters.level}
                    onChange={(e) => setLogFilters(prev => ({ ...prev, level: e.target.value }))}
                    className={`w-full border rounded-md px-3 py-2 text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  >
                    <option value="">All Levels</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-1`}>Component</label>
                  <select
                    value={logFilters.component}
                    onChange={(e) => setLogFilters(prev => ({ ...prev, component: e.target.value }))}
                    className={`w-full border rounded-md px-3 py-2 text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  >
                    <option value="">All Components</option>
                    <option value="agent">Agent</option>
                    <option value="scan">Scan</option>
                    <option value="ai">AI</option>
                    <option value="ingestion">Ingestion</option>
                    <option value="scheduler">Scheduler</option>
                    <option value="api">API</option>
                    <option value="auth">Auth</option>
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-1`}>Success</label>
                  <select
                    value={logFilters.success}
                    onChange={(e) => setLogFilters(prev => ({ ...prev, success: e.target.value }))}
                    className={`w-full border rounded-md px-3 py-2 text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  >
                    <option value="">All</option>
                    <option value="true">Success</option>
                    <option value="false">Failed</option>
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-1`}>Search</label>
                  <input
                    type="text"
                    value={logFilters.search}
                    onChange={(e) => setLogFilters(prev => ({ ...prev, search: e.target.value }))}
                    placeholder="Search logs..."
                    className={`w-full border rounded-md px-3 py-2 text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={fetchLogs}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Logs Display */}
            <div className={`${cardBg} rounded-lg`}>
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className={textSecondary}>Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-4">📋</div>
                  <p className={`${textSecondary} mb-2`}>No logs found</p>
                  <p className={`text-sm ${textMuted}`}>Try adjusting your filters</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <div key={log._id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              log.level === 'error' ? 'bg-red-100 text-red-800' :
                              log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                              log.level === 'info' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {log.level.toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                              {log.component}
                            </span>
                            <span className={`text-xs ${textMuted}`}>{log.action}</span>
                            {log.success !== undefined && (
                              <span className={`px-2 py-1 rounded text-xs ${log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {log.success ? 'SUCCESS' : 'FAILED'}
                              </span>
                            )}
                          </div>
                          <p className={`${textSecondary} mb-2`}>{log.message}</p>
                          
                          {log.userEmail && (
                            <div className={`text-sm ${textMuted}`}>
                              User: {log.userEmail}
                            </div>
                          )}
                          
                          {log.deviceId && (
                            <div className={`text-sm ${textMuted}`}>
                              Device: {log.deviceId}
                            </div>
                          )}
                          
                          {log.duration && (
                            <div className={`text-sm ${textMuted}`}>
                              Duration: {log.duration}ms
                            </div>
                          )}
                          
                          {log.error && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                              <div className="font-medium text-red-800">{log.error.name}: {log.error.message}</div>
                              {log.error.stack && (
                                <pre className="mt-1 text-xs text-red-700 overflow-x-auto">
                                  {log.error.stack.split('\n').slice(0, 3).join('\n')}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                        <div className={`text-xs ${textMuted} ml-4`}>
                          {formatDate(log.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Placeholder for other tabs */}
        {(activeTab === 'users' || activeTab === 'agents') && (
          <div className={`${cardBg} rounded-lg p-8 text-center`}>
            <div className="text-4xl mb-4">🚧</div>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>Coming Soon</h3>
            <p className={textSecondary}>
              {activeTab === 'users' ? 'User management interface' : 'Agent management interface'} is under development
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminPortal;