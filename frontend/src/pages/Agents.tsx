import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { useConfirmation } from '../components/ConfirmationModal';
import ScanHistoryModal from '../components/ScanHistoryModal';

interface Agent {
  deviceId: string;
  deviceName: string;
  status: 'active' | 'inactive' | 'installing' | 'uninstalled' | 'error';
  version: string;
  installedAt: string;
  lastHeartbeat?: string;
  lastScan?: string;
  systemInfo?: {
    osName?: string;
    osVersion?: string;
    architecture?: string;
    manufacturer?: string;
    model?: string;
  };
}

interface AgentStats {
  total: number;
  active: number;
  inactive: number;
  uninstalled: number;
}

type SupportedOS = 'windows' | 'linux' | 'macos';

const Agents = () => {
  const { theme } = useTheme();
  const { showSuccess, showError } = useToast();
  const { confirm } = useConfirmation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedOS, setSelectedOS] = useState<SupportedOS>('windows');
  const [showDeploymentLimit, setShowDeploymentLimit] = useState(false);
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    deviceId: string;
    deviceName: string;
  }>({ isOpen: false, deviceId: '', deviceName: '' });

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';

  const MAX_AGENTS = 5;

  // Helper function to get OS icon based on OS name
  const getOSIcon = (osName?: string) => {
    if (!osName) return null;
    
    const osLower = osName.toLowerCase();
    if (osLower.includes('windows')) {
      return (
        <svg className="w-4 h-4 inline mr-1" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22l-10-1.91V13.1l10 .15z" fill="#0078D4"/>
        </svg>
      );
    } else if (osLower.includes('linux') || osLower.includes('ubuntu') || osLower.includes('debian') || osLower.includes('centos') || osLower.includes('fedora')) {
      return (
        <svg className="w-4 h-4 inline mr-1" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 01-.088.069c-.104.105-.259.158-.436.158-.177 0-.332-.053-.436-.158-.104-.105-.158-.259-.158-.436 0-.177.054-.331.158-.436.104-.104.259-.158.436-.158.001 0 .001 0 .002 0h.002zm2.785.584c.084 0 .167.015.25.043.083.03.155.067.217.118.061.051.108.112.14.18.033.07.049.145.049.221 0 .329-.229.594-.513.594-.284 0-.513-.265-.513-.594 0-.329.229-.594.513-.594.001 0 .002 0 .003 0h.002-.002z" fill="#FCC624"/>
        </svg>
      );
    } else if (osLower.includes('mac') || osLower.includes('darwin')) {
      return (
        <svg className="w-4 h-4 inline mr-1" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#007AFF"/>
        </svg>
      );
    }
    return null;
  };

  const osInfo = {
    windows: {
      name: 'Windows',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22l-10-1.91V13.1l10 .15z" fill="#0078D4"/>
        </svg>
      ),
      capabilities: [
        'Full software inventory scanning',
        'Real-time vulnerability detection',
        'Remote software uninstallation',
        'System health monitoring',
        'Patch management tracking',
        'Browser extension analysis',
        'Double-click installation (.bat file)',
        'Silent background execution'
      ],
      limitations: [],
      status: 'Stable',
      statusColor: 'text-green-600'
    },
    linux: {
      name: 'Linux',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 01-.088.069c-.104.105-.259.158-.436.158-.177 0-.332-.053-.436-.158-.104-.105-.158-.259-.158-.436 0-.177.054-.331.158-.436.104-.104.259-.158.436-.158.001 0 .001 0 .002 0h.002zm2.785.584c.084 0 .167.015.25.043.083.03.155.067.217.118.061.051.108.112.14.18.033.07.049.145.049.221 0 .329-.229.594-.513.594-.284 0-.513-.265-.513-.594 0-.329.229-.594.513-.594.001 0 .002 0 .003 0h.002-.002z" fill="#FCC624"/>
        </svg>
      ),
      capabilities: [
        'Package manager integration (APT, YUM, DNF)',
        'Snap and Flatpak package detection',
        'System service monitoring',
        'Security configuration analysis',
        'Browser extension scanning (Chrome)',
        'Terminal-based installation',
        'Multi-distribution support'
      ],
      limitations: [
        'Remote software management limited',
        'GUI-based applications may not be fully detected',
        'Distribution-specific features vary',
        'Requires sudo privileges for comprehensive scanning'
      ],
      status: 'Beta',
      statusColor: 'text-yellow-600'
    },
    macos: {
      name: 'macOS',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#007AFF"/>
        </svg>
      ),
      capabilities: [
        'Application bundle detection (/Applications)',
        'Homebrew package scanning',
        'Mac App Store application detection',
        'System integrity monitoring',
        'Browser extension analysis (Safari, Chrome)',
        'Native macOS notifications',
        'Terminal-based installation'
      ],
      limitations: [
        'System-level access requires admin permissions',
        'App Store applications have limited metadata',
        'Some system directories require additional permissions',
        'Gatekeeper may require manual approval'
      ],
      status: 'Beta',
      statusColor: 'text-yellow-600'
    }
  };

  useEffect(() => {
    fetchData();
    // Remove auto-refresh to prevent UI blinking
    // Data will be refreshed on user actions or manual refresh
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [agentsRes, statsRes] = await Promise.all([
        axios.get('/api/agent'),
        axios.get('/api/agent/stats/overview')
      ]);
      
      console.log('Agents response:', agentsRes.data);
      console.log('Stats response:', statsRes.data);
      
      setAgents(agentsRes.data.agents || []);
      setStats(statsRes.data.stats || { total: 0, active: 0, inactive: 0, uninstalled: 0 });
    } catch (err: any) {
      console.error('Failed to fetch agent data:', err);
      showError('Data Fetch Failed', 'Unable to load agent data. Please try again.');
      
      // Set fallback data to prevent UI issues
      setAgents([]);
      setStats({ total: 0, active: 0, inactive: 0, uninstalled: 0 });
    } finally {
      setLoading(false);
    }
  };

  const downloadInstaller = async () => {
    // Check deployment limit
    const activeAgents = agents.filter(a => a.status === 'active').length;
    if (activeAgents >= MAX_AGENTS) {
      setShowDeploymentLimit(true);
      return;
    }

    try {
      const response = await axios.post(
        '/api/agent/download-installer',
        { os: selectedOS },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const filename = selectedOS === 'windows' ? 'SecureHabitAgent.bat' :
                      selectedOS === 'linux' ? 'secure-habit-agent.sh' :
                      'secure-habit-agent-macos.sh';
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showSuccess('Agent Downloaded', `${osInfo[selectedOS].name} agent installer downloaded successfully!`);
    } catch (error: any) {
      console.error('Error downloading installer:', error);
      
      if (error.response?.status === 400 && error.response?.data?.message) {
        showError('Download Failed', error.response.data.message);
      } else {
        showError('Download Failed', 'Error downloading installer. Please try again.');
      }
    }
  };
  const runQuickScan = async (deviceId: string, deviceName: string) => {
    try {
      // Create a pending scan record
      const response = await axios.post(`/api/agent/${deviceId}/quick-scan`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.scanId) {
        // Add to background scan manager
        if ((window as any).addBackgroundScan) {
          (window as any).addBackgroundScan({
            scanId: response.data.scanId,
            scanType: 'quick' as const,
            deviceName,
            deviceId,
            startTime: new Date()
          });
        }
        
        showSuccess('Scan Started', `Quick scan initiated on ${deviceName}. You can monitor progress in the background scan panel.`);
      } else {
        showError('Scan Failed', 'Failed to initiate scan. Please try again.');
      }
    } catch (error: any) {
      console.error('Error initiating quick scan:', error);
      showError('Scan Failed', error.response?.data?.message || 'Failed to initiate scan. Agent may be offline.');
    }
  };

  const runFullScan = async (deviceId: string, deviceName: string) => {
    try {
      // Create a pending scan record
      const response = await axios.post(`/api/agent/${deviceId}/full-scan`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.scanId) {
        // Add to background scan manager
        if ((window as any).addBackgroundScan) {
          (window as any).addBackgroundScan({
            scanId: response.data.scanId,
            scanType: 'full' as const,
            deviceName,
            deviceId,
            startTime: new Date()
          });
        }
        
        showSuccess('Scan Started', `Full scan initiated on ${deviceName}. You can monitor progress in the background scan panel.`);
      } else {
        showError('Scan Failed', 'Failed to initiate scan. Please try again.');
      }
    } catch (error: any) {
      console.error('Error initiating full scan:', error);
      showError('Scan Failed', error.response?.data?.message || 'Failed to initiate scan. Agent may be offline.');
    }
  };

  const showScanHistory = (deviceId: string, deviceName: string) => {
    setHistoryModal({
      isOpen: true,
      deviceId,
      deviceName
    });
  };

  const checkAgentHealth = async (deviceId: string) => {
    try {
      setActionLoading(deviceId);
      await axios.post(`/api/agent/${deviceId}/health-check`);
      showSuccess('Health Check Initiated', 'Results will appear in your dashboard.');
    } catch (err) {
      showError('Health Check Failed', 'Agent may be offline.');
    } finally {
      setActionLoading(null);
    }
  };

  const uninstallAgent = async (deviceId: string) => {
    const confirmed = await confirm({
      title: 'Uninstall Agent',
      message: 'Are you sure you want to uninstall this agent? This action cannot be undone.',
      confirmText: 'Uninstall',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      setActionLoading(deviceId);
      await axios.post(`/api/agent/${deviceId}/uninstall-agent`);
      showSuccess('Agent Uninstall Initiated', 'The agent will remove itself shortly.');
      setTimeout(fetchData, 3000); // Refresh after 3 seconds
    } catch (err) {
      showError('Uninstall Failed', 'Failed to uninstall agent.');
    } finally {
      setActionLoading(null);
    }
  };

  const deactivateAgent = async (deviceId: string) => {
    const confirmed = await confirm({
      title: 'Deactivate Agent',
      message: 'Deactivate this agent to free up a deployment slot?',
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    try {
      await axios.post(`/api/agent/${deviceId}/deactivate`);
      showSuccess('Agent Deactivated', 'Agent has been deactivated successfully.');
      fetchData();
      setShowDeploymentLimit(false);
    } catch (err) {
      showError('Deactivation Failed', 'Failed to deactivate agent.');
    }
  };

  const getStatusBadge = (status: string, lastHeartbeat?: string) => {
    const isOnline = lastHeartbeat && 
      (new Date().getTime() - new Date(lastHeartbeat).getTime()) < 5 * 60 * 1000; // 5 minutes

    if (status === 'active' && isOnline) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <span className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
          Online
        </span>
      );
    } else if (status === 'active') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <span className="w-2 h-2 bg-yellow-400 rounded-full mr-1.5"></span>
          Connected
        </span>
      );
    } else if (status === 'inactive') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <span className="w-2 h-2 bg-gray-400 rounded-full mr-1.5"></span>
          Offline
        </span>
      );
    } else if (status === 'error') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <span className="w-2 h-2 bg-red-400 rounded-full mr-1.5"></span>
          Error
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <span className="w-2 h-2 bg-blue-400 rounded-full mr-1.5"></span>
          {status}
        </span>
      );
    }
  };

  const getTimeSince = (date?: string) => {
    if (!date) return 'Never';
    
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-blue-500' : 'border-blue-600'}`}></div>
        </div>
      </Layout>
    );
  }

  const activeAgentCount = agents.filter(a => a.status === 'active').length;
  const canDeployMore = activeAgentCount < MAX_AGENTS;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`}>Agent Control Panel</h1>
            <p className={`${textSecondary} mt-1`}>
              Manage and control security agents across your devices ({activeAgentCount}/{MAX_AGENTS} active)
            </p>
          </div>
        </div>

        {/* OS Selection and Download */}
        <div className={`${cardBg} rounded-lg p-6 mb-8`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>Deploy New Agent</h2>
          
          {/* OS Selection */}
          <div className="mb-6">
            <label className={`block text-sm font-medium ${textSecondary} mb-3`}>
              Select Operating System:
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(osInfo) as SupportedOS[]).map((os) => (
                <button
                  key={os}
                  onClick={() => setSelectedOS(os)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedOS === os
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : isDark
                      ? 'border-gray-700 hover:border-gray-600'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="flex justify-center mb-2">{osInfo[os].icon}</div>
                    <div className={`font-medium ${textPrimary}`}>{osInfo[os].name}</div>
                    <div className={`text-xs mt-1 px-2 py-1 rounded-full inline-block ${
                      osInfo[os].status === 'Stable' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {osInfo[os].status}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* OS Capabilities */}
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4 mb-6`}>
            <h3 className={`font-medium ${textPrimary} mb-3`}>
              {osInfo[selectedOS].name} Agent Capabilities
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>✅ Supported Features:</h4>
                <ul className={`text-sm ${textSecondary} space-y-1`}>
                  {osInfo[selectedOS].capabilities.map((capability, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      {capability}
                    </li>
                  ))}
                </ul>
              </div>
              
              {osInfo[selectedOS].limitations.length > 0 && (
                <div>
                  <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>⚠️ Limitations:</h4>
                  <ul className={`text-sm ${textSecondary} space-y-1`}>
                    {osInfo[selectedOS].limitations.map((limitation, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-yellow-500 mr-2">•</span>
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Download Button */}
          <div className="flex items-center justify-between">
            <div>
              {!canDeployMore && (
                <p className="text-sm text-red-600 mb-2">
                  ⚠️ Maximum agent limit reached ({MAX_AGENTS}/{MAX_AGENTS})
                </p>
              )}
            </div>
            <button
              onClick={downloadInstaller}
              disabled={!canDeployMore}
              className={`px-6 py-3 rounded-lg flex items-center transition-colors ${
                !canDeployMore
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!canDeployMore ? 'Limit Reached' : `Download ${osInfo[selectedOS].name} Agent`}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className={`${cardBg} rounded-lg p-6`}>
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${textSecondary}`}>Total Agents</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.total}</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-6`}>
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${textSecondary}`}>Active</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.active}</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-6`}>
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${textSecondary}`}>Inactive</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.inactive}</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-6`}>
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${textSecondary}`}>Uninstalled</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.uninstalled}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agents List */}
        {agents.length === 0 ? (
          <div className={`${cardBg} rounded-lg p-12 text-center`}>
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>No agents deployed</h3>
            <p className={`${textSecondary} mb-6`}>
              Download and install the Secure Habit agent on your Windows devices to start monitoring
            </p>
            <button
              onClick={downloadInstaller}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg inline-flex items-center transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Security Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div key={agent.deviceId} className={`${cardBg} rounded-lg p-6`}>
                {/* Agent Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className={`text-lg font-semibold ${textPrimary}`}>
                      {agent.deviceName}
                    </h3>
                    <p className={`text-sm ${textMuted}`}>v{agent.version}</p>
                    {agent.systemInfo?.osName && (
                      <p className={`text-xs ${textMuted} mt-1 flex items-center`}>
                        {getOSIcon(agent.systemInfo.osName)}
                        {agent.systemInfo.osName} {agent.systemInfo.architecture}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(agent.status, agent.lastHeartbeat)}
                </div>

                {/* Agent Details */}
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className={textSecondary}>Last heartbeat:</span>
                    <span className={`${textPrimary} font-medium`}>
                      {getTimeSince(agent.lastHeartbeat)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Last scan:</span>
                    <span className={`${textPrimary} font-medium`}>
                      {getTimeSince(agent.lastScan)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={textSecondary}>Installed:</span>
                    <span className={`${textPrimary} font-medium`}>
                      {new Date(agent.installedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => runQuickScan(agent.deviceId, agent.deviceName)}
                      disabled={agent.status !== 'active' || actionLoading === agent.deviceId}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-2 rounded text-sm flex items-center justify-center transition-colors"
                      title="Perform a quick security scan to identify immediate threats"
                    >
                      {actionLoading === agent.deviceId ? (
                        <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      )}
                      Quick Scan
                    </button>
                    
                    <button
                      onClick={() => runFullScan(agent.deviceId, agent.deviceName)}
                      disabled={agent.status !== 'active' || actionLoading === agent.deviceId}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-3 py-2 rounded text-sm flex items-center justify-center transition-colors"
                      title="Perform a comprehensive security scan including malware detection"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Full Scan
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => showScanHistory(agent.deviceId, agent.deviceName)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm flex items-center justify-center transition-colors"
                      title="View scan history and security trends for this device"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      History
                    </button>

                    <button
                      onClick={() => checkAgentHealth(agent.deviceId)}
                      disabled={agent.status !== 'active' || actionLoading === agent.deviceId}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-3 py-2 rounded text-sm flex items-center justify-center transition-colors"
                      title="Check agent health status and system security posture"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Health
                    </button>

                    <button
                      onClick={() => uninstallAgent(agent.deviceId)}
                      disabled={actionLoading === agent.deviceId}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-3 py-2 rounded text-sm flex items-center justify-center transition-colors"
                      title="Permanently remove the security agent from this device"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Deployment Limit Modal */}
        {showDeploymentLimit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className={`${cardBg} rounded-lg shadow-xl max-w-md w-full mx-4 p-6`}>
              <div className="flex items-center mb-4">
                <div className="p-2 bg-red-100 rounded-lg mr-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Agent Deployment Limit Reached</h3>
              </div>
              
              <p className={`${textSecondary} mb-6`}>
                You have reached the maximum limit of {MAX_AGENTS} active agents. To deploy a new agent, 
                you must first deactivate an existing one.
              </p>
              
              <div className="space-y-3 mb-6">
                <h4 className={`font-medium ${textPrimary}`}>Active Agents:</h4>
                {agents.filter(a => a.status === 'active').map((agent) => (
                  <div key={agent.deviceId} className={`flex items-center justify-between p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg`}>
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{agent.deviceName}</p>
                      <p className={`text-sm ${textSecondary} flex items-center`}>
                        {getOSIcon(agent.systemInfo?.osName)}
                        {agent.systemInfo?.osName}
                      </p>
                    </div>
                    <button
                      onClick={() => deactivateAgent(agent.deviceId)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      Deactivate
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeploymentLimit(false)}
                  className={`flex-1 px-4 py-2 border rounded-lg transition-colors ${
                    isDark
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Installation Instructions */}
        <div className={`${cardBg} rounded-lg p-6 mt-8`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Installation Instructions - {osInfo[selectedOS].name}
          </h2>
          
          {selectedOS === 'windows' && (
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
              <h3 className={`font-medium ${textPrimary} mb-3 flex items-center`}>
                <span className="mr-2">{osInfo.windows.icon}</span>
                Windows Installation (Double-Click Execution)
              </h3>
              <ol className={`list-decimal list-inside space-y-2 text-sm ${textSecondary}`}>
                <li>Download the Windows agent installer (.bat file)</li>
                <li><strong>Right-click</strong> the downloaded file and select <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">"Run as administrator"</code></li>
                <li>Click <strong>"Yes"</strong> when Windows UAC prompts for permission</li>
                <li>The agent will install and run automatically in the background</li>
                <li>A notification will appear when the scan completes (2-5 minutes)</li>
                <li>Verify the agent appears as "Online" in this control panel</li>
              </ol>
              <div className={`mt-3 p-3 ${isDark ? 'bg-gray-700' : 'bg-blue-100'} rounded`}>
                <p className={`text-sm ${textSecondary}`}>
                  <strong>💡 Tip:</strong> The agent runs silently and will automatically scan your system for vulnerabilities, 
                  outdated software, and security issues. Results appear in your dashboard within minutes.
                </p>
              </div>
            </div>
          )}

          {selectedOS === 'linux' && (
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-green-50 border-green-200'} border rounded-lg p-4`}>
              <h3 className={`font-medium ${textPrimary} mb-3 flex items-center`}>
                <span className="mr-2">{osInfo.linux.icon}</span>
                Linux Installation (Terminal-Based)
              </h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>Method 1: Direct Download & Execute</h4>
                  <div className={`${isDark ? 'bg-gray-900' : 'bg-gray-100'} rounded p-3 font-mono text-sm`}>
                    <div className="space-y-1">
                      <div># Download the agent</div>
                      <div className="text-blue-600 dark:text-blue-400">curl -O https://your-domain/agent/linux/secure-habit-agent.sh</div>
                      <div># Make executable</div>
                      <div className="text-blue-600 dark:text-blue-400">chmod +x secure-habit-agent.sh</div>
                      <div># Run with sudo privileges</div>
                      <div className="text-blue-600 dark:text-blue-400">sudo ./secure-habit-agent.sh</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>Method 2: One-Line Installation</h4>
                  <div className={`${isDark ? 'bg-gray-900' : 'bg-gray-100'} rounded p-3 font-mono text-sm`}>
                    <div className="text-blue-600 dark:text-blue-400">
                      curl -sSL https://your-domain/agent/linux/secure-habit-agent.sh | sudo bash
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`mt-4 p-3 ${isDark ? 'bg-gray-700' : 'bg-green-100'} rounded`}>
                <p className={`text-sm ${textSecondary} mb-2`}>
                  <strong>🔒 Security Note:</strong> The agent requires sudo privileges to:
                </p>
                <ul className={`text-xs ${textSecondary} list-disc list-inside space-y-1`}>
                  <li>Scan system packages (APT, YUM, DNF, Snap, Flatpak)</li>
                  <li>Access system configuration files</li>
                  <li>Detect security vulnerabilities</li>
                  <li>Analyze installed software versions</li>
                </ul>
              </div>
              
              <div className={`mt-3 p-3 ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-100'} rounded`}>
                <p className={`text-sm ${textSecondary}`}>
                  <strong>⚠️ Beta Status:</strong> Linux support is in beta. Supported distributions: 
                  Ubuntu, Debian, CentOS, RHEL, Fedora, Arch Linux. Some features may be limited.
                  Please report any issues you encounter.
                </p>
              </div>
            </div>
          )}

          {selectedOS === 'macos' && (
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-purple-50 border-purple-200'} border rounded-lg p-4`}>
              <h3 className={`font-medium ${textPrimary} mb-3 flex items-center`}>
                <span className="mr-2">{osInfo.macos.icon}</span>
                macOS Installation (Terminal-Based)
              </h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>Method 1: Direct Download & Execute</h4>
                  <div className={`${isDark ? 'bg-gray-900' : 'bg-gray-100'} rounded p-3 font-mono text-sm`}>
                    <div className="space-y-1">
                      <div># Download the agent</div>
                      <div className="text-purple-600 dark:text-purple-400">curl -O https://your-domain/agent/macos/secure-habit-agent-macos.sh</div>
                      <div># Make executable</div>
                      <div className="text-purple-600 dark:text-purple-400">chmod +x secure-habit-agent-macos.sh</div>
                      <div># Run with admin privileges</div>
                      <div className="text-purple-600 dark:text-purple-400">sudo ./secure-habit-agent-macos.sh</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>Method 2: One-Line Installation</h4>
                  <div className={`${isDark ? 'bg-gray-900' : 'bg-gray-100'} rounded p-3 font-mono text-sm`}>
                    <div className="text-purple-600 dark:text-purple-400">
                      curl -sSL https://your-domain/agent/macos/secure-habit-agent-macos.sh | sudo bash
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`mt-4 p-3 ${isDark ? 'bg-gray-700' : 'bg-purple-100'} rounded`}>
                <p className={`text-sm ${textSecondary} mb-2`}>
                  <strong>🔒 Security Note:</strong> The agent requires admin privileges to:
                </p>
                <ul className={`text-xs ${textSecondary} list-disc list-inside space-y-1`}>
                  <li>Scan application bundles and system software</li>
                  <li>Access Homebrew and Mac App Store data</li>
                  <li>Analyze system security configuration</li>
                  <li>Detect browser extensions and security tools</li>
                </ul>
              </div>
              
              <div className={`mt-3 p-3 ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-100'} rounded`}>
                <p className={`text-sm ${textSecondary}`}>
                  <strong>🍎 Beta Status:</strong> macOS support is in beta. If Gatekeeper blocks execution, 
                  right-click the file and select "Open" to bypass security restrictions, or use the terminal method above.
                  Please report any issues you encounter.
                </p>
              </div>
            </div>
          )}
          
          {/* Common troubleshooting */}
          <div className={`mt-6 p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg`}>
            <h3 className={`font-medium ${textPrimary} mb-3`}>🛠️ Troubleshooting</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>Common Issues:</h4>
                <ul className={`text-sm ${textSecondary} space-y-1`}>
                  <li>• <strong>Permission denied:</strong> Ensure you're running as administrator/sudo</li>
                  <li>• <strong>Network timeout:</strong> Check firewall and internet connection</li>
                  <li>• <strong>Antivirus blocking:</strong> Temporarily disable or whitelist the agent</li>
                  {selectedOS === 'macos' && (
                    <li>• <strong>Gatekeeper blocking:</strong> Right-click → Open, then allow execution</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className={`text-sm font-medium ${textSecondary} mb-2`}>Need Help?</h4>
                <ul className={`text-sm ${textSecondary} space-y-1`}>
                  <li>• Check the agent log files for detailed error messages</li>
                  <li>• Ensure your system meets minimum requirements</li>
                  <li>• Try re-downloading the agent if issues persist</li>
                  <li>• Contact support if problems continue</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Scan History Modal */}
        <ScanHistoryModal
          isOpen={historyModal.isOpen}
          onClose={() => setHistoryModal({ isOpen: false, deviceId: '', deviceName: '' })}
          deviceId={historyModal.deviceId}
          deviceName={historyModal.deviceName}
        />
      </div>
    </Layout>
  );
};

export default Agents;