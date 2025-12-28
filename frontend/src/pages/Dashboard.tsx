import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { DashboardStats, EndpointExposureTimeline, TopEndpoint, TopVulnerableSoftware, VulnerabilityInsights, RemediationActivity, OrganizationScore } from '../../../shared/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const Dashboard = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeline, setTimeline] = useState<EndpointExposureTimeline[]>([]);
  const [topEndpoints, setTopEndpoints] = useState<TopEndpoint[]>([]);
  const [topSoftware, setTopSoftware] = useState<TopVulnerableSoftware[]>([]);
  const [insights, setInsights] = useState<VulnerabilityInsights | null>(null);
  const [activities, setActivities] = useState<RemediationActivity[]>([]);
  const [orgScore, setOrgScore] = useState<OrganizationScore | null>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timelineDays, setTimelineDays] = useState(30);

  useEffect(() => {
    fetchDashboardData();
  }, [timelineDays]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, timelineRes, endpointsRes, softwareRes, insightsRes, activitiesRes, checklistRes] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get(`/api/dashboard/endpoint-exposure-timeline?days=${timelineDays}`),
        axios.get('/api/dashboard/top-endpoints'),
        axios.get('/api/dashboard/top-vulnerable-software'),
        axios.get('/api/dashboard/vulnerability-insights'),
        axios.get('/api/dashboard/top-remediation-activities'),
        axios.get('/api/dashboard/daily-checklist'),
      ]);

      setStats(statsRes.data);
      setTimeline(timelineRes.data.timeline);
      setTopEndpoints(endpointsRes.data.endpoints);
      setTopSoftware(softwareRes.data.software);
      setInsights(insightsRes.data.insights);
      setActivities(activitiesRes.data.activities);
      setChecklist(checklistRes.data);

      // Fetch org score if user is from thinkbridge.com or thinkbridge.in
      const userEmail = user?.email || '';
      if (userEmail.endsWith('@thinkbridge.com') || userEmail.endsWith('@thinkbridge.in')) {
        try {
          const orgRes = await axios.get('/api/organization/score');
          setOrgScore(orgRes.data);
        } catch (err) {
          // Ignore if org features not available
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateChecklistItem = async (itemId: number, completed: boolean) => {
    try {
      const res = await axios.put(`/api/dashboard/daily-checklist/${itemId}`, { completed });
      setChecklist({
        ...checklist,
        checklist: res.data.item,
        completionPercentage: res.data.newCompletionPercentage,
      });
      fetchDashboardData(); // Refresh stats
    } catch (error) {
      console.error('Error updating checklist:', error);
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
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-blue-500' : 'border-blue-600'}`}></div>
        </div>
      </Layout>
    );
  }

  if (!stats) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className={textMuted}>Failed to load dashboard data</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h1 className={`text-2xl font-bold mb-6 ${textPrimary}`}>Incidents</h1>

        {/* Hero Section - Secure Scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className={`${cardBg} rounded-lg p-6`}>
            <h2 className={`text-lg font-semibold ${textSecondary} mb-4`}>Your Secure Score</h2>
            <div className="flex items-center justify-center">
              <div className="relative w-48 h-48">
                <svg className="transform -rotate-90 w-48 h-48">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="#E5E7EB"
                    strokeWidth="16"
                    fill="none"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke={stats.userSecureScore >= 75 ? '#10B981' : stats.userSecureScore >= 50 ? '#F59E0B' : '#EF4444'}
                    strokeWidth="16"
                    fill="none"
                    strokeDasharray={`${(stats.userSecureScore / 100) * 552.92} 552.92`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold">{stats.userSecureScore}</span>
                </div>
              </div>
            </div>
          </div>

          {orgScore && (
            <div className={`${cardBg} rounded-lg p-6`}>
              <h2 className={`text-lg font-semibold ${textSecondary} mb-4`}>Organization Score</h2>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-48 h-48">
                  <svg className="transform -rotate-90 w-48 h-48">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="#E5E7EB"
                      strokeWidth="16"
                      fill="none"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="#3B82F6"
                      strokeWidth="16"
                      fill="none"
                      strokeDasharray={`${(orgScore.organizationScore / 100) * 552.92} 552.92`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold">{orgScore.organizationScore}</span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className={`text-sm ${textSecondary}`}>
                  Your contribution: {orgScore.userContribution} points
                </p>
                <p className={`text-sm ${textSecondary} mt-1`}>
                  Rank: #{orgScore.ranking.position} of {orgScore.ranking.outOf}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Endpoint Exposure Section */}
        <div className={`${cardBg} rounded-lg p-6 mb-8`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-lg font-semibold ${textSecondary}`}>Endpoint Exposure Score</h2>
            <div className="flex space-x-2">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimelineDays(days)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    timelineDays === days
                      ? 'bg-blue-600 text-white'
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
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className={`text-center text-sm ${textSecondary} mt-2`}>
            Current Score: <span className="font-semibold">{stats.endpointExposureScore}</span>
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className={`${cardBg} rounded-lg p-4`}>
            <p className={`text-sm ${textSecondary}`}>Total Scans</p>
            <p className={`text-2xl font-bold ${textPrimary}`}>{stats.totalScans}</p>
          </div>
          <div className={`${cardBg} rounded-lg p-4`}>
            <p className={`text-sm ${textSecondary}`}>Devices</p>
            <p className={`text-2xl font-bold ${textPrimary}`}>{stats.totalDevices}</p>
          </div>
          <div className={`${cardBg} rounded-lg p-4`}>
            <p className={`text-sm ${textSecondary}`}>Critical Vulns</p>
            <p className="text-2xl font-bold text-red-500">{stats.criticalVulnerabilities}</p>
          </div>
          <div className={`${cardBg} rounded-lg p-4`}>
            <p className={`text-sm ${textSecondary}`}>Last Scan</p>
            <p className={`text-sm font-semibold ${textPrimary}`}>
              {stats.lastScanDate
                ? new Date(stats.lastScanDate).toLocaleDateString()
                : 'Never'}
            </p>
          </div>
        </div>

        {/* Top Endpoints */}
        <div className={`${cardBg} rounded-lg p-6 mb-8`}>
          <h2 className={`text-lg font-semibold ${textSecondary} mb-4`}>Top Endpoint Recommendations</h2>
          <div className="space-y-3">
            {topEndpoints.map((endpoint, idx) => (
              <div key={idx} className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`font-mono text-sm ${textPrimary}`}>{endpoint.endpoint}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          endpoint.riskLevel === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : endpoint.riskLevel === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : endpoint.riskLevel === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {endpoint.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <p className={`text-sm ${textSecondary}`}>{endpoint.recommendation}</p>
                    <p className={`text-xs ${textMuted} mt-1`}>
                      {endpoint.vulnerabilities.length} CVE(s) • Exposure Score: {endpoint.exposureScore}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Vulnerable Software */}
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
                      {Object.entries(insights.byCategory).map((entry, index) => (
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
                        {activity.steps.map((step, idx) => (
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
    </Layout>
  );
};

export default Dashboard;

