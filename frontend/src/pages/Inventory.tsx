import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import RemediationModal from '../components/RemediationModal';

interface Software {
  name: string;
  version: string;
  publisher: string;
  installDate: string;
  riskScore?: number;
  cves?: CVE[];
  recommendation?: AIRecommendation;
  deviceId?: string;
  deviceName?: string;
}

interface CVE {
  cveId: string;
  cvssScore: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  exploitable: boolean;
  software: string; // Add software property
}

interface AIRecommendation {
  action: 'update' | 'uninstall' | 'ignore' | 'mitigate';
  whatToFix: string;
  whyItMatters: string;
  riskImpact: string;
  priority: 'high' | 'medium' | 'low';
}

interface InventoryData {
  deviceId: string;
  deviceName: string;
  lastScan: string;
  overallRiskScore: number;
  software: Software[];
  totalCVEs: number;
  criticalCVEs: number;
  systemInfo: {
    osName: string;
    osVersion: string;
    architecture: string;
  };
}

const Inventory = () => {
  const { theme } = useTheme();
  const [inventory, setInventory] = useState<InventoryData[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expandedSoftware, setExpandedSoftware] = useState<Set<string>>(new Set());
  const [remediationModal, setRemediationModal] = useState<{
    isOpen: boolean;
    software: any;
  }>({ isOpen: false, software: null });

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    try {
      // Fetch scans and transform to inventory format
      const response = await axios.get('/api/scan');
      const scans = response.data.scans || [];
      
      // Group by device and get latest scan per device
      const deviceMap = new Map();
      scans.forEach((scan: any) => {
        if (!deviceMap.has(scan.deviceId) || 
            new Date(scan.scanTimestamp) > new Date(deviceMap.get(scan.deviceId).scanTimestamp)) {
          deviceMap.set(scan.deviceId, scan);
        }
      });

      const inventoryData = Array.from(deviceMap.values()).map((scan: any) => ({
        deviceId: scan.deviceId,
        deviceName: scan.systemInfo?.computerName || scan.deviceId,
        lastScan: scan.scanTimestamp,
        overallRiskScore: 100 - (scan.secureScore || 0),
        software: (scan.software || []).map((sw: any) => ({
          ...sw,
          deviceId: scan.deviceId,
          deviceName: scan.systemInfo?.computerName || scan.deviceId,
          riskScore: calculateSoftwareRisk(sw, scan.vulnerabilities?.items || []),
          cves: getCVEsForSoftware(sw.name, scan.vulnerabilities?.items || []),
          recommendation: generateAIRecommendation(sw, scan.vulnerabilities?.items || [])
        })),
        totalCVEs: scan.vulnerabilities?.total || 0,
        criticalCVEs: scan.vulnerabilities?.critical || 0,
        systemInfo: scan.systemInfo || {}
      }));

      setInventory(inventoryData);
      if (inventoryData.length > 0 && !selectedDevice) {
        setSelectedDevice(inventoryData[0].deviceId);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSoftwareRisk = (software: any, vulnerabilities: CVE[]) => {
    const softwareCVEs = vulnerabilities.filter(v => 
      v.software?.toLowerCase().includes(software.name.toLowerCase())
    );
    
    if (softwareCVEs.length === 0) return 0;
    
    const avgCVSS = softwareCVEs.reduce((sum, cve) => sum + cve.cvssScore, 0) / softwareCVEs.length;
    return Math.round((avgCVSS / 10) * 100);
  };

  const getCVEsForSoftware = (softwareName: string, vulnerabilities: CVE[]) => {
    return vulnerabilities.filter(v => 
      v.software?.toLowerCase().includes(softwareName.toLowerCase())
    );
  };

  const generateAIRecommendation = (software: any, vulnerabilities: CVE[]): AIRecommendation => {
    const softwareCVEs = getCVEsForSoftware(software.name, vulnerabilities);
    
    if (softwareCVEs.length === 0) {
      return {
        action: 'ignore',
        whatToFix: 'No action needed',
        whyItMatters: 'This software has no known vulnerabilities.',
        riskImpact: 'No security risk identified.',
        priority: 'low'
      };
    }

    const criticalCVEs = softwareCVEs.filter(cve => cve.severity === 'critical');
    const highCVEs = softwareCVEs.filter(cve => cve.severity === 'high');
    
    if (criticalCVEs.length > 0) {
      return {
        action: 'update',
        whatToFix: `Update ${software.name} to the latest version immediately`,
        whyItMatters: `This software has ${criticalCVEs.length} critical vulnerabilities that could allow attackers to take control of your system.`,
        riskImpact: 'High risk of system compromise, data theft, or malware installation.',
        priority: 'high'
      };
    } else if (highCVEs.length > 0) {
      return {
        action: 'update',
        whatToFix: `Update ${software.name} to patch security vulnerabilities`,
        whyItMatters: `This software has ${highCVEs.length} high-severity vulnerabilities that could be exploited by attackers.`,
        riskImpact: 'Medium risk of security breach or unauthorized access.',
        priority: 'medium'
      };
    } else {
      return {
        action: 'mitigate',
        whatToFix: `Monitor ${software.name} for updates`,
        whyItMatters: `This software has minor vulnerabilities that should be addressed when convenient.`,
        riskImpact: 'Low risk, but good security hygiene suggests updating.',
        priority: 'low'
      };
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-100';
    if (score >= 60) return 'text-orange-600 bg-orange-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'update': return 'text-blue-600 bg-blue-100';
      case 'uninstall': return 'text-red-600 bg-red-100';
      case 'mitigate': return 'text-yellow-600 bg-yellow-100';
      case 'ignore': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

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

      // Refresh inventory data to reflect changes
      setTimeout(() => {
        fetchInventoryData();
      }, 2000);
    } catch (error) {
      throw error;
    }
  };

  const toggleSoftwareExpansion = (softwareName: string) => {
    const newExpanded = new Set(expandedSoftware);
    if (newExpanded.has(softwareName)) {
      newExpanded.delete(softwareName);
    } else {
      newExpanded.add(softwareName);
    }
    setExpandedSoftware(newExpanded);
  };

  const currentInventory = inventory.find(inv => inv.deviceId === selectedDevice);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-blue-500' : 'border-blue-600'}`}></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`}>Software Inventory</h1>
            <p className={`${textSecondary} mt-1`}>
              View installed software, associated vulnerabilities, and AI-driven recommendations
            </p>
          </div>
          
          {/* Device Selector */}
          {inventory.length > 1 && (
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className={`px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {inventory.map((inv) => (
                <option key={inv.deviceId} value={inv.deviceId}>
                  {inv.deviceName}
                </option>
              ))}
            </select>
          )}
        </div>

        {!currentInventory ? (
          <div className={`${cardBg} rounded-lg p-12 text-center`}>
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
            </svg>
            <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>No inventory data available</h3>
            <p className={`${textSecondary} mb-6`}>
              Run the Secure Habit agent on your devices to see software inventory
            </p>
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className={`${cardBg} rounded-lg p-6`}>
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${textSecondary}`}>Total Software</p>
                    <p className={`text-2xl font-bold ${textPrimary}`}>{currentInventory.software.length}</p>
                  </div>
                </div>
              </div>

              <div className={`${cardBg} rounded-lg p-6`}>
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${textSecondary}`}>Total CVEs</p>
                    <p className={`text-2xl font-bold ${textPrimary}`}>{currentInventory.totalCVEs}</p>
                  </div>
                </div>
              </div>

              <div className={`${cardBg} rounded-lg p-6`}>
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${textSecondary}`}>Critical CVEs</p>
                    <p className={`text-2xl font-bold ${textPrimary}`}>{currentInventory.criticalCVEs}</p>
                  </div>
                </div>
              </div>

              <div className={`${cardBg} rounded-lg p-6`}>
                <div className="flex items-center">
                  <div className={`p-2 ${getRiskColor(currentInventory.overallRiskScore).replace('text-', 'bg-').replace('-600', '-100')} rounded-lg`}>
                    <svg className={`w-6 h-6 ${getRiskColor(currentInventory.overallRiskScore).split(' ')[0]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${textSecondary}`}>Risk Score</p>
                    <p className={`text-2xl font-bold ${textPrimary}`}>{currentInventory.overallRiskScore}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Device Info */}
            <div className={`${cardBg} rounded-lg p-6 mb-8`}>
              <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>Device Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className={`text-sm ${textSecondary}`}>Device Name</p>
                  <p className={`font-medium ${textPrimary}`}>{currentInventory.deviceName}</p>
                </div>
                <div>
                  <p className={`text-sm ${textSecondary}`}>Operating System</p>
                  <p className={`font-medium ${textPrimary}`}>
                    {currentInventory.systemInfo.osName} {currentInventory.systemInfo.osVersion}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${textSecondary}`}>Last Scan</p>
                  <p className={`font-medium ${textPrimary}`}>
                    {new Date(currentInventory.lastScan).toLocaleDateString()} {new Date(currentInventory.lastScan).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Software Inventory */}
            <div className={`${cardBg} rounded-lg p-6`}>
              <h2 className={`text-lg font-semibold ${textPrimary} mb-6`}>Software Inventory</h2>
              
              <div className="space-y-4">
                {currentInventory.software.map((software, index) => (
                  <div key={`${software.name}-${index}`} className={`border rounded-lg p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <h3 className={`font-medium ${textPrimary}`}>{software.name}</h3>
                          <span className={`text-sm ${textMuted}`}>v{software.version}</span>
                          <span className={`text-sm ${textMuted}`}>{software.publisher}</span>
                          
                          {/* Risk Score Badge */}
                          {software.riskScore !== undefined && software.riskScore > 0 && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(software.riskScore)}`}>
                              Risk: {software.riskScore}%
                            </span>
                          )}
                          
                          {/* CVE Count */}
                          {software.cves && software.cves.length > 0 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
                              {software.cves.length} CVE{software.cves.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* AI Recommendation Dropdown and Actions */}
                      {software.recommendation && (
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(software.recommendation.action)}`}>
                            {software.recommendation.action.toUpperCase()}
                          </span>
                          
                          {/* Uninstall Button for risky software */}
                          {(software.recommendation.action === 'uninstall' || 
                            (software.cves && software.cves.length > 0 && software.cves.some(cve => cve.severity === 'critical'))) && (
                            <button
                              onClick={() => setRemediationModal({
                                isOpen: true,
                                software: {
                                  name: software.name,
                                  version: software.version,
                                  deviceId: software.deviceId,
                                  deviceName: software.deviceName
                                }
                              })}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                              title="Remove this software from your device"
                            >
                              <svg className="w-3 h-3 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Remove
                            </button>
                          )}
                          
                          <button
                            onClick={() => toggleSoftwareExpansion(software.name)}
                            className={`p-1 rounded hover:bg-gray-100 ${isDark ? 'hover:bg-gray-800' : ''}`}
                          >
                            <svg 
                              className={`w-4 h-4 ${textSecondary} transform transition-transform ${expandedSoftware.has(software.name) ? 'rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Expanded Details */}
                    {expandedSoftware.has(software.name) && software.recommendation && (
                      <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className="space-y-3">
                          <div>
                            <h4 className={`font-medium ${textPrimary} mb-1`}>What to fix:</h4>
                            <p className={`text-sm ${textSecondary}`}>{software.recommendation.whatToFix}</p>
                          </div>
                          
                          <div>
                            <h4 className={`font-medium ${textPrimary} mb-1`}>Why it matters:</h4>
                            <p className={`text-sm ${textSecondary}`}>{software.recommendation.whyItMatters}</p>
                          </div>
                          
                          <div>
                            <h4 className={`font-medium ${textPrimary} mb-1`}>Risk if ignored:</h4>
                            <p className={`text-sm ${textSecondary}`}>{software.recommendation.riskImpact}</p>
                          </div>
                          
                          {/* CVE Details */}
                          {software.cves && software.cves.length > 0 && (
                            <div>
                              <h4 className={`font-medium ${textPrimary} mb-2`}>Associated CVEs:</h4>
                              <div className="space-y-2">
                                {software.cves.map((cve, cveIndex) => (
                                  <div key={cveIndex} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <span className={`text-sm font-mono ${textPrimary}`}>{cve.cveId}</span>
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(cve.severity)}`}>
                                        {cve.severity.toUpperCase()}
                                      </span>
                                      <span className={`text-sm ${textMuted}`}>CVSS: {cve.cvssScore}</span>
                                    </div>
                                    {cve.exploitable && (
                                      <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-600">
                                        EXPLOITABLE
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Remediation Modal */}
        <RemediationModal
          isOpen={remediationModal.isOpen}
          onClose={() => setRemediationModal({ isOpen: false, software: null })}
          software={remediationModal.software}
          onConfirm={handleUninstallSoftware}
        />
      </div>
    </Layout>
  );
};

export default Inventory;