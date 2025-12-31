import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import axios from 'axios';

interface ScanHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
}

interface ScanData {
  _id: string;
  scanTimestamp: string;
  secureScore: number;
  endpointExposureScore: number;
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  software: any[];
  status: string;
}

const ScanHistoryModal: React.FC<ScanHistoryModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  deviceName,
}) => {
  const { theme } = useTheme();
  const [scans, setScans] = useState<ScanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const overlayBg = isDark ? 'bg-black bg-opacity-75' : 'bg-black bg-opacity-50';

  useEffect(() => {
    if (isOpen) {
      fetchScanHistory();
    }
  }, [isOpen, deviceId, selectedTimeframe]);

  const fetchScanHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/scan?deviceId=${deviceId}&limit=50`);
      
      // Filter by timeframe
      const cutoffDate = new Date();
      const days = selectedTimeframe === '7d' ? 7 : selectedTimeframe === '30d' ? 30 : 90;
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredScans = response.data.scans.filter((scan: ScanData) => 
        new Date(scan.scanTimestamp) >= cutoffDate
      );
      
      setScans(filteredScans);
    } catch (error) {
      console.error('Error fetching scan history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981'; // green
    if (score >= 60) return '#F59E0B'; // yellow
    if (score >= 40) return '#F97316'; // orange
    return '#EF4444'; // red
  };

  const getScoreTrend = () => {
    if (scans.length < 2) return null;
    
    const latest = scans[0];
    const previous = scans[1];
    const change = latest.secureScore - previous.secureScore;
    
    return {
      change,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      percentage: previous.secureScore > 0 ? Math.round((change / previous.secureScore) * 100) : 0
    };
  };

  const chartData = scans
    .slice()
    .reverse()
    .map(scan => ({
      date: new Date(scan.scanTimestamp).toLocaleDateString(),
      secureScore: scan.secureScore,
      exposureScore: scan.endpointExposureScore,
      vulnerabilities: scan.vulnerabilities.total,
      critical: scan.vulnerabilities.critical,
      high: scan.vulnerabilities.high,
      medium: scan.vulnerabilities.medium,
      low: scan.vulnerabilities.low,
    }));

  const vulnerabilityData = scans.length > 0 ? [
    { name: 'Critical', value: scans[0].vulnerabilities.critical, color: '#EF4444' },
    { name: 'High', value: scans[0].vulnerabilities.high, color: '#F97316' },
    { name: 'Medium', value: scans[0].vulnerabilities.medium, color: '#F59E0B' },
    { name: 'Low', value: scans[0].vulnerabilities.low, color: '#3B82F6' },
  ] : [];

  const trend = getScoreTrend();

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${overlayBg}`}>
      <div className={`${modalBg} rounded-lg shadow-xl max-w-6xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`text-xl font-semibold ${textPrimary}`}>
              Scan History - {deviceName}
            </h3>
            <p className={`text-sm ${textSecondary} mt-1`}>
              Security scan results and trends over time
            </p>
          </div>
          <button
            onClick={onClose}
            className={`${textSecondary} hover:${textPrimary} transition-colors`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Timeframe Selector */}
        <div className="flex space-x-2 mb-6">
          {(['7d', '30d', '90d'] as const).map((timeframe) => (
            <button
              key={timeframe}
              onClick={() => setSelectedTimeframe(timeframe)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                selectedTimeframe === timeframe
                  ? 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {timeframe === '7d' ? '7 Days' : timeframe === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-blue-500' : 'border-blue-600'}`}></div>
          </div>
        ) : scans.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>No scan history</h3>
            <p className={`${textSecondary}`}>
              No scans found for the selected timeframe. Run a security scan to see results here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${textSecondary}`}>Latest Score</p>
                    <p className={`text-2xl font-bold ${textPrimary}`} style={{ color: getScoreColor(scans[0].secureScore) }}>
                      {scans[0].secureScore}
                    </p>
                  </div>
                  {trend && (
                    <div className={`text-sm ${trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
                      {trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'} {Math.abs(trend.change)}
                    </div>
                  )}
                </div>
              </div>

              <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                <p className={`text-sm ${textSecondary}`}>Total Scans</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{scans.length}</p>
              </div>

              <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                <p className={`text-sm ${textSecondary}`}>Critical Vulns</p>
                <p className="text-2xl font-bold text-red-600">{scans[0].vulnerabilities.critical}</p>
              </div>

              <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                <p className={`text-sm ${textSecondary}`}>Software Count</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{scans[0].software.length}</p>
              </div>
            </div>

            {/* Score Trend Chart */}
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-6`}>
              <h4 className={`text-lg font-semibold ${textPrimary} mb-4`}>Security Score Trend</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
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
                        border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                        borderRadius: '6px',
                        color: isDark ? '#FFFFFF' : '#000000'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="secureScore" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      name="Secure Score"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="exposureScore" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      name="Exposure Score"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Vulnerability Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-6`}>
                <h4 className={`text-lg font-semibold ${textPrimary} mb-4`}>Vulnerability Trend</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                      <XAxis 
                        dataKey="date" 
                        stroke={isDark ? '#9CA3AF' : '#6B7280'}
                        fontSize={10}
                      />
                      <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} fontSize={10} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                          border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                          borderRadius: '6px',
                          color: isDark ? '#FFFFFF' : '#000000'
                        }}
                      />
                      <Line type="monotone" dataKey="critical" stroke="#EF4444" strokeWidth={2} name="Critical" />
                      <Line type="monotone" dataKey="high" stroke="#F97316" strokeWidth={2} name="High" />
                      <Line type="monotone" dataKey="medium" stroke="#F59E0B" strokeWidth={2} name="Medium" />
                      <Line type="monotone" dataKey="low" stroke="#3B82F6" strokeWidth={2} name="Low" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-6`}>
                <h4 className={`text-lg font-semibold ${textPrimary} mb-4`}>Current Vulnerabilities</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vulnerabilityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                      <XAxis 
                        dataKey="name" 
                        stroke={isDark ? '#9CA3AF' : '#6B7280'}
                        fontSize={12}
                      />
                      <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} fontSize={12} />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                          border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                          borderRadius: '6px',
                          color: isDark ? '#FFFFFF' : '#000000'
                        }}
                      />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Scans List */}
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-6`}>
              <h4 className={`text-lg font-semibold ${textPrimary} mb-4`}>Recent Scans</h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {scans.slice(0, 10).map((scan) => (
                  <div key={scan._id} className={`flex items-center justify-between p-3 ${isDark ? 'bg-gray-700' : 'bg-white'} rounded-lg`}>
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: getScoreColor(scan.secureScore) }}></div>
                      <div>
                        <p className={`font-medium ${textPrimary}`}>
                          {new Date(scan.scanTimestamp).toLocaleDateString()} {new Date(scan.scanTimestamp).toLocaleTimeString()}
                        </p>
                        <p className={`text-sm ${textSecondary}`}>
                          {scan.vulnerabilities.total} vulnerabilities • {scan.software.length} software items
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${textPrimary}`} style={{ color: getScoreColor(scan.secureScore) }}>
                        {scan.secureScore}
                      </p>
                      <p className={`text-xs ${textSecondary}`}>Score</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanHistoryModal;