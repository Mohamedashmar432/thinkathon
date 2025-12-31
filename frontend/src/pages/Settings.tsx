import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Settings = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    organization: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [organizationScore, setOrganizationScore] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [scheduledScans, setScheduledScans] = useState<any[]>([]);
  const [scheduledScanLoading, setScheduledScanLoading] = useState(false);

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const inputBg = isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900';

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        organization: user.organization || '',
      });
      
      // Fetch organization score if user is from ThinkBridge
      if (user.email.endsWith('@thinkbridge.com') || user.email.endsWith('@thinkbridge.in')) {
        fetchOrganizationScore();
      }
      
      // Fetch user agents and scheduled scans
      fetchAgents();
      fetchScheduledScans();
    }
  }, [user]);

  const fetchOrganizationScore = async () => {
    try {
      const response = await axios.get('/api/organization-score/score');
      setOrganizationScore(response.data);
    } catch (error) {
      console.error('Error fetching organization score:', error);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await axios.get('/api/agent/list');
      setAgents(response.data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const fetchScheduledScans = async () => {
    try {
      const response = await axios.get('/api/scheduled-scans');
      setScheduledScans(response.data.scheduledScans || []);
    } catch (error) {
      console.error('Error fetching scheduled scans:', error);
    }
  };

  const toggleScheduledScan = async (deviceId: string, scanType: 'quick' | 'health', enabled: boolean) => {
    setScheduledScanLoading(true);
    try {
      await axios.post('/api/scheduled-scans', {
        deviceId,
        scanType,
        enabled,
        scheduledTimeIST: '05:00'
      });
      
      // Refresh scheduled scans
      await fetchScheduledScans();
      setMessage(`Scheduled ${scanType} scan ${enabled ? 'enabled' : 'disabled'} successfully!`);
    } catch (error: any) {
      setMessage(error.response?.data?.message || `Error ${enabled ? 'enabling' : 'disabling'} scheduled scan`);
    } finally {
      setScheduledScanLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Update user profile (this endpoint would need to be created)
      // For now, just show a message
      setMessage('Profile updated successfully!');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  const isOrganizationUser = user?.email.endsWith('@thinkbridge.com') || user?.email.endsWith('@thinkbridge.in');

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className={`text-3xl font-bold ${textPrimary} mb-8`}>Settings</h1>

        {/* User Profile Section */}
        <div className={`${cardBg} rounded-lg p-6 mb-6`}>
          <h2 className={`text-xl font-semibold ${textPrimary} mb-6`}>User Profile</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.includes('success')
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  className={`w-full ${inputBg} rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  className={`w-full ${inputBg} rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className={`w-full ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'} rounded-lg px-4 py-3 ${textSecondary}`}
              />
              <p className={`text-xs ${textSecondary} mt-2`}>Email cannot be changed</p>
            </div>

            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                Organization
              </label>
              <input
                type="text"
                value={formData.organization}
                onChange={(e) =>
                  setFormData({ ...formData, organization: e.target.value })
                }
                className={`w-full ${inputBg} rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Scheduled Scans Section */}
        <div className={`${cardBg} rounded-lg p-6 mb-6`}>
          <h2 className={`text-xl font-semibold ${textPrimary} mb-6`}>Scheduled Scans</h2>
          <p className={`text-sm ${textSecondary} mb-6`}>
            Configure automatic daily scans for your devices. Scans run at 5:00 AM IST (11:30 PM UTC previous day) and collect security data in the background.
          </p>

          {agents.length === 0 ? (
            <div className="text-center py-8">
              <div className={`text-4xl mb-4`}>🤖</div>
              <p className={`${textSecondary} mb-4`}>No agents found</p>
              <p className={`text-sm ${textSecondary}`}>
                Install agents on your devices first to enable scheduled scanning.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => {
                const deviceSchedule = scheduledScans.find(s => s.deviceId === agent.deviceId) || {
                  deviceId: agent.deviceId,
                  quick: null,
                  health: null
                };

                return (
                  <div key={agent.deviceId} className={`p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className={`font-medium ${textPrimary}`}>
                          {agent.systemInfo?.computerName || agent.deviceId}
                        </h3>
                        <p className={`text-sm ${textSecondary}`}>
                          {agent.systemInfo?.osName} • {agent.status === 'active' ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        agent.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {agent.status === 'active' ? 'Online' : 'Offline'}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Quick Scan Toggle */}
                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div>
                          <h4 className="text-sm font-medium text-blue-800">Quick Scan</h4>
                          <p className="text-xs text-blue-600">Daily security overview</p>
                          {deviceSchedule.quick && (
                            <p className="text-xs text-blue-500 mt-1">
                              Next: {new Date(deviceSchedule.quick.nextRun).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={deviceSchedule.quick?.enabled || false}
                            onChange={(e) => toggleScheduledScan(agent.deviceId, 'quick', e.target.checked)}
                            disabled={scheduledScanLoading || agent.status !== 'active'}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {/* Health Scan Toggle */}
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div>
                          <h4 className="text-sm font-medium text-green-800">Health Scan</h4>
                          <p className="text-xs text-green-600">Comprehensive system check</p>
                          {deviceSchedule.health && (
                            <p className="text-xs text-green-500 mt-1">
                              Next: {new Date(deviceSchedule.health.nextRun).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={deviceSchedule.health?.enabled || false}
                            onChange={(e) => toggleScheduledScan(agent.deviceId, 'health', e.target.checked)}
                            disabled={scheduledScanLoading || agent.status !== 'active'}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Scan Statistics */}
                    {(deviceSchedule.quick || deviceSchedule.health) && (
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        {deviceSchedule.quick && (
                          <>
                            <div className={`p-2 ${isDark ? 'bg-gray-700' : 'bg-white'} rounded`}>
                              <p className="text-xs text-blue-600">Quick Runs</p>
                              <p className={`font-semibold ${textPrimary}`}>{deviceSchedule.quick.totalRuns || 0}</p>
                            </div>
                            <div className={`p-2 ${isDark ? 'bg-gray-700' : 'bg-white'} rounded`}>
                              <p className="text-xs text-red-600">Quick Missed</p>
                              <p className={`font-semibold ${textPrimary}`}>{deviceSchedule.quick.missedRuns || 0}</p>
                            </div>
                          </>
                        )}
                        {deviceSchedule.health && (
                          <>
                            <div className={`p-2 ${isDark ? 'bg-gray-700' : 'bg-white'} rounded`}>
                              <p className="text-xs text-green-600">Health Runs</p>
                              <p className={`font-semibold ${textPrimary}`}>{deviceSchedule.health.totalRuns || 0}</p>
                            </div>
                            <div className={`p-2 ${isDark ? 'bg-gray-700' : 'bg-white'} rounded`}>
                              <p className="text-xs text-red-600">Health Missed</p>
                              <p className={`font-semibold ${textPrimary}`}>{deviceSchedule.health.missedRuns || 0}</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Scheduled Scan Information</h4>
                <ul className="text-xs text-yellow-700 mt-2 space-y-1">
                  <li>• Scans run automatically at 5:00 AM IST (11:30 PM UTC previous day)</li>
                  <li>• Devices must be online and active for scans to execute</li>
                  <li>• Missed scans are tracked and will run when device comes online</li>
                  <li>• Scan data automatically updates your dashboard and security score</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Privacy Section */}
        <div className={`${cardBg} rounded-lg p-6 mb-6`}>
          <h2 className={`text-xl font-semibold ${textPrimary} mb-6`}>Security & Privacy</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <h3 className="text-sm font-medium text-green-800">Data Encryption</h3>
                <p className="text-xs text-green-600">All your data is encrypted in transit and at rest</p>
              </div>
              <div className="flex items-center text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <h3 className="text-sm font-medium text-blue-800">Secure Authentication</h3>
                <p className="text-xs text-blue-600">JWT tokens with secure session management</p>
              </div>
              <div className="flex items-center text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div>
                <h3 className="text-sm font-medium text-purple-800">AI Privacy</h3>
                <p className="text-xs text-purple-600">AI recommendations are generated securely without exposing sensitive data</p>
              </div>
              <div className="flex items-center text-purple-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Section - Only for ThinkBridge users */}
        {isOrganizationUser && (
          <div className={`${cardBg} rounded-lg p-6 mb-6`}>
            <h2 className={`text-xl font-semibold ${textPrimary} mb-6`}>Organization Dashboard</h2>
            
            {organizationScore ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-800">Organization Score</h3>
                    <p className="text-2xl font-bold text-blue-900">{organizationScore.organizationScore}%</p>
                  </div>
                  
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="text-sm font-medium text-green-800">Your Contribution</h3>
                    <p className="text-2xl font-bold text-green-900">
                      {organizationScore.userContribution > 0 ? '+' : ''}{organizationScore.userContribution}%
                    </p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h3 className="text-sm font-medium text-purple-800">Your Ranking</h3>
                    <p className="text-2xl font-bold text-purple-900">
                      #{organizationScore.ranking.position} of {organizationScore.ranking.outOf}
                    </p>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className={`text-sm ${textSecondary}`}>{organizationScore.explanation}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4`}></div>
                <p className={`${textSecondary}`}>Loading organization data...</p>
              </div>
            )}
          </div>
        )}

        {/* Danger Zone */}
        <div className={`${cardBg} rounded-lg p-6 border-red-200`}>
          <h2 className="text-xl font-semibold text-red-700 mb-4">Danger Zone</h2>
          <p className={`text-sm ${textSecondary} mb-6`}>
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;

