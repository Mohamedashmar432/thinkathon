import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface ThreatItem {
  _id: string;
  cveId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore: number;
  exploited: boolean;
  affectedProducts: string[];
  publishedDate: string;
  source: string;
  references: string[];
  cisaKevDate?: string;
  riskScore?: number;
  impactedEndpoints?: string[];
  impactedSoftware?: Array<{
    name: string;
    version: string;
    endpoints: string[];
  }>;
  actionRecommendations?: string[];
}

interface ThreatStats {
  totalThreats: number;
  exploitedThreats: number;
  criticalThreats: number;
  userImpactedThreats: number;
  userHighRiskThreats: number;
  recentThreats: number;
  lastUpdated: string;
}

const ThreatIntelligence = () => {
  const { } = useAuth(); // Remove unused user variable
  const { theme } = useTheme();
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [stats, setStats] = useState<ThreatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'latest' | 'exploited' | 'impacted' | 'high-risk'>('impacted');
  const [filters, setFilters] = useState({
    severity: '',
    exploited: '',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [selectedThreat, setSelectedThreat] = useState<ThreatItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';

  // Fetch threat statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get('/api/threat-feed/stats/overview');
      setStats(response.data.stats);
      setError(null); // Clear any previous errors
    } catch (error: any) {
      console.error('Error fetching threat stats:', error);
      if (error.response?.status === 429) {
        setError('Rate limit exceeded. Please wait a moment before refreshing.');
      } else if (error.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else {
        setError('Failed to fetch threat statistics. Please try again later.');
      }
    }
  }, []);

  // Fetch threats based on active tab and filters
  const fetchThreats = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: filters.limit.toString()
      });

      if (filters.severity) params.append('severity', filters.severity);
      if (filters.exploited) params.append('exploited', filters.exploited);

      const endpoint = `/api/threat-feed/${activeTab}?${params}`;
      const response = await axios.get(endpoint);
      
      setThreats(response.data.threats || []);
      setPagination(response.data.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      });
      setError(null); // Clear any previous errors
    } catch (error: any) {
      console.error('Error fetching threats:', error);
      if (error.response?.status === 429) {
        setError('Rate limit exceeded. Please wait a moment before refreshing.');
      } else if (error.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else {
        setError('Failed to fetch threat data. Please try again later.');
      }
      setThreats([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]); // Remove pagination dependency to prevent infinite loops

  // Initial data load
  useEffect(() => {
    fetchStats();
    fetchThreats();
  }, [fetchStats, fetchThreats]);

  // Auto-refresh every 5 minutes (only if not loading)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchStats();
        fetchThreats();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchStats, fetchThreats, loading]);

  // Handle tab change
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setFilters(prev => ({ ...prev, page: 1 }));
  };

  // Handle filter change
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Get CVSS score color
  const getCvssColor = (score: number) => {
    if (score >= 9.0) return 'text-red-600';
    if (score >= 7.0) return 'text-orange-600';
    if (score >= 4.0) return 'text-yellow-600';
    return 'text-blue-600';
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Show threat details
  const showThreatDetails = async (threat: ThreatItem) => {
    try {
      const response = await axios.get(`/api/threat-feed/${threat.cveId}`);
      setSelectedThreat(response.data.threat);
      setShowDetails(true);
    } catch (error) {
      console.error('Error fetching threat details:', error);
      setSelectedThreat(threat);
      setShowDetails(true);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`}>Threat Intelligence</h1>
            <p className={`mt-2 ${textSecondary}`}>
              Real-time threat intelligence feed with personalized impact analysis
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm ${isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800'}`}>
              Live Feed
            </div>
            {stats && (
              <div className={`text-sm ${textMuted}`}>
                Last updated: {formatDate(stats.lastUpdated)}
              </div>
            )}
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
                <h3 className="text-sm font-medium text-red-800">Error Loading Threat Intelligence</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  setError(null);
                  fetchStats();
                  fetchThreats();
                }}
                className="ml-auto px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <div className={`${cardBg} rounded-lg p-4`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${textSecondary}`}>Total Threats</p>
                  <p className={`text-lg font-semibold ${textPrimary}`}>{stats.totalThreats.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-4`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${textSecondary}`}>Exploited</p>
                  <p className={`text-lg font-semibold ${textPrimary}`}>{stats.exploitedThreats.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-4`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${textSecondary}`}>Critical</p>
                  <p className={`text-lg font-semibold ${textPrimary}`}>{stats.criticalThreats.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-4`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${textSecondary}`}>Your Impact</p>
                  <p className={`text-lg font-semibold ${textPrimary}`}>{stats.userImpactedThreats.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-4`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${textSecondary}`}>High Risk</p>
                  <p className={`text-lg font-semibold ${textPrimary}`}>{stats.userHighRiskThreats.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-4`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${textSecondary}`}>Recent (7d)</p>
                  <p className={`text-lg font-semibold ${textPrimary}`}>{stats.recentThreats.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        ) : !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${cardBg} rounded-lg p-4 animate-pulse`}>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                  <div className="ml-3 flex-1">
                    <div className="h-3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-5 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Navigation */}
        <div className={`${cardBg} rounded-lg mb-6`}>
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { key: 'impacted', label: 'Your Environment', icon: '🎯' },
                { key: 'exploited', label: 'Actively Exploited', icon: '🚨' },
                { key: 'high-risk', label: 'High Risk', icon: '⚡' },
                { key: 'latest', label: 'Latest', icon: '📡' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key as typeof activeTab)}
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

          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                  Severity
                </label>
                <select
                  value={filters.severity}
                  onChange={(e) => handleFilterChange('severity', e.target.value)}
                  className={`border rounded-md px-3 py-2 text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                  Exploitation Status
                </label>
                <select
                  value={filters.exploited}
                  onChange={(e) => handleFilterChange('exploited', e.target.value)}
                  className={`border rounded-md px-3 py-2 text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="">All Threats</option>
                  <option value="true">Exploited Only</option>
                  <option value="false">Not Exploited</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ severity: '', exploited: '', page: 1, limit: 20 })}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Threat Feed */}
        <div className={`${cardBg} rounded-lg`}>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className={textSecondary}>Loading threat intelligence...</p>
            </div>
          ) : threats.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-4">🔍</div>
              <p className={`${textSecondary} mb-2`}>No threats found</p>
              <p className={`text-sm ${textMuted}`}>
                Try adjusting your filters or check back later for new threats
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {threats.map((threat) => (
                <div
                  key={threat._id}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => showThreatDetails(threat)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* CVE Header */}
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className={`text-lg font-semibold ${textPrimary}`}>
                          {threat.cveId}
                        </h3>
                        
                        {/* Severity Badge */}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(threat.severity)}`}>
                          {threat.severity.toUpperCase()}
                        </span>

                        {/* CVSS Score */}
                        <span className={`text-sm font-medium ${getCvssColor(threat.cvssScore)}`}>
                          CVSS {threat.cvssScore}
                        </span>

                        {/* Exploited Badge */}
                        {threat.exploited && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            🚨 EXPLOITED
                          </span>
                        )}

                        {/* Impact Badge */}
                        {threat.impactedEndpoints && threat.impactedEndpoints.length > 0 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                            📍 AFFECTS YOUR ENVIRONMENT
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className={`${textSecondary} mb-3 line-clamp-2`}>
                        {threat.description}
                      </p>

                      {/* Impact Details */}
                      {threat.impactedEndpoints && threat.impactedEndpoints.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center space-x-4 text-sm">
                            <span className={`${textMuted}`}>
                              📊 {threat.impactedEndpoints.length} endpoint(s) affected
                            </span>
                            {threat.riskScore && (
                              <span className={`${textMuted}`}>
                                🎯 Risk Score: {threat.riskScore}/100
                              </span>
                            )}
                          </div>
                          
                          {threat.impactedSoftware && threat.impactedSoftware.length > 0 && (
                            <div className="mt-2">
                              <p className={`text-sm ${textMuted} mb-1`}>Affected Software:</p>
                              <div className="flex flex-wrap gap-2">
                                {threat.impactedSoftware.slice(0, 3).map((software, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                                  >
                                    {software.name} {software.version}
                                  </span>
                                ))}
                                {threat.impactedSoftware.length > 3 && (
                                  <span className={`px-2 py-1 rounded text-xs ${textMuted}`}>
                                    +{threat.impactedSoftware.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center space-x-4 text-sm">
                        <span className={textMuted}>
                          📅 {formatDate(threat.publishedDate)}
                        </span>
                        <span className={textMuted}>
                          📡 {threat.source.toUpperCase()}
                        </span>
                        {threat.affectedProducts.length > 0 && (
                          <span className={textMuted}>
                            🎯 {threat.affectedProducts.length} product(s)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Arrow */}
                    <div className="ml-4">
                      <svg className={`w-5 h-5 ${textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className={`text-sm ${textMuted}`}>
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} threats
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className={`px-3 py-1 rounded text-sm ${
                      pagination.page <= 1
                        ? `${textMuted} cursor-not-allowed`
                        : `${textSecondary} hover:bg-gray-100`
                    }`}
                  >
                    Previous
                  </button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const page = i + Math.max(1, pagination.page - 2);
                    if (page > pagination.pages) return null;
                    
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1 rounded text-sm ${
                          page === pagination.page
                            ? 'bg-blue-500 text-white'
                            : `${textSecondary} hover:bg-gray-100`
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className={`px-3 py-1 rounded text-sm ${
                      pagination.page >= pagination.pages
                        ? `${textMuted} cursor-not-allowed`
                        : `${textSecondary} hover:bg-gray-100`
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Threat Details Modal */}
        {showDetails && selectedThreat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`${cardBg} rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className={`text-xl font-bold ${textPrimary}`}>
                    {selectedThreat.cveId} - Threat Details
                  </h2>
                  <button
                    onClick={() => setShowDetails(false)}
                    className={`${textMuted} hover:text-gray-700`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {/* Threat overview */}
                <div className="mb-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(selectedThreat.severity)}`}>
                      {selectedThreat.severity.toUpperCase()}
                    </span>
                    <span className={`text-lg font-medium ${getCvssColor(selectedThreat.cvssScore)}`}>
                      CVSS {selectedThreat.cvssScore}
                    </span>
                    {selectedThreat.exploited && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
                        🚨 ACTIVELY EXPLOITED
                      </span>
                    )}
                  </div>
                  
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>
                    {selectedThreat.title}
                  </h3>
                  
                  <p className={`${textSecondary} mb-4`}>
                    {selectedThreat.description}
                  </p>
                </div>

                {/* Impact section */}
                {selectedThreat.impactedEndpoints && selectedThreat.impactedEndpoints.length > 0 && (
                  <div className="mb-6">
                    <h4 className={`text-lg font-semibold ${textPrimary} mb-3`}>
                      Impact on Your Environment
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <p className={`text-sm ${textMuted} mb-1`}>Affected Endpoints</p>
                        <p className={`text-2xl font-bold ${textPrimary}`}>
                          {selectedThreat.impactedEndpoints.length}
                        </p>
                      </div>
                      
                      {selectedThreat.riskScore && (
                        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                          <p className={`text-sm ${textMuted} mb-1`}>Risk Score</p>
                          <p className={`text-2xl font-bold ${textPrimary}`}>
                            {selectedThreat.riskScore}/100
                          </p>
                        </div>
                      )}
                    </div>

                    {selectedThreat.actionRecommendations && selectedThreat.actionRecommendations.length > 0 && (
                      <div className="mb-4">
                        <h5 className={`font-medium ${textPrimary} mb-2`}>Recommended Actions</h5>
                        <ul className="space-y-2">
                          {selectedThreat.actionRecommendations.map((action, idx) => (
                            <li key={idx} className={`text-sm ${textSecondary} flex items-start`}>
                              <span className="mr-2">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Technical details */}
                <div className="mb-6">
                  <h4 className={`text-lg font-semibold ${textPrimary} mb-3`}>
                    Technical Details
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className={`text-sm ${textMuted} mb-1`}>Published Date</p>
                      <p className={`${textSecondary}`}>{formatDate(selectedThreat.publishedDate)}</p>
                    </div>
                    
                    <div>
                      <p className={`text-sm ${textMuted} mb-1`}>Source</p>
                      <p className={`${textSecondary}`}>{selectedThreat.source.toUpperCase()}</p>
                    </div>
                    
                    {selectedThreat.cisaKevDate && (
                      <div>
                        <p className={`text-sm ${textMuted} mb-1`}>CISA KEV Date</p>
                        <p className={`${textSecondary}`}>{formatDate(selectedThreat.cisaKevDate)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Affected products */}
                {selectedThreat.affectedProducts.length > 0 && (
                  <div className="mb-6">
                    <h4 className={`text-lg font-semibold ${textPrimary} mb-3`}>
                      Affected Products
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedThreat.affectedProducts.map((product, idx) => (
                        <span
                          key={idx}
                          className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                        >
                          {product}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* References */}
                {selectedThreat.references.length > 0 && (
                  <div>
                    <h4 className={`text-lg font-semibold ${textPrimary} mb-3`}>
                      References
                    </h4>
                    <ul className="space-y-2">
                      {selectedThreat.references.slice(0, 5).map((ref, idx) => (
                        <li key={idx}>
                          <a
                            href={ref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm break-all"
                          >
                            {ref}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ThreatIntelligence;