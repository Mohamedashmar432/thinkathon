import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import ScanProgressCard from './ScanProgressCard';

interface ActiveScan {
  scanId: string;
  scanType: 'quick' | 'full';
  deviceName: string;
  deviceId: string;
  startTime: Date;
}

interface BackgroundScanManagerProps {
  className?: string;
}

const BackgroundScanManager: React.FC<BackgroundScanManagerProps> = ({ className = '' }) => {
  const { theme } = useTheme();
  const [activeScans, setActiveScans] = useState<ActiveScan[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';

  // Load active scans from localStorage on mount
  useEffect(() => {
    const savedScans = localStorage.getItem('activeScans');
    if (savedScans) {
      try {
        const scans = JSON.parse(savedScans).map((scan: any) => ({
          ...scan,
          startTime: new Date(scan.startTime)
        }));
        setActiveScans(scans);
      } catch (error) {
        console.error('Error loading active scans:', error);
      }
    }
  }, []);

  // Save active scans to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('activeScans', JSON.stringify(activeScans));
  }, [activeScans]);

  // Add a new scan to the manager
  const addScan = (scan: ActiveScan) => {
    setActiveScans(prev => [...prev, scan]);
    setIsMinimized(false); // Show the manager when a new scan is added
  };

  // Remove a scan from the manager
  const removeScan = (scanId: string) => {
    setActiveScans(prev => prev.filter(scan => scan.scanId !== scanId));
  };

  // Handle scan completion
  const handleScanComplete = () => {
    // Refresh dashboard data or trigger other actions
    console.log('Scan completed - refreshing data');
  };

  // Expose addScan method globally for other components to use
  useEffect(() => {
    (window as any).addBackgroundScan = addScan;
    return () => {
      delete (window as any).addBackgroundScan;
    };
  }, []);

  if (activeScans.length === 0) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] ${className}`}>
      <div className={`${cardBg} rounded-lg shadow-lg`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className={`font-medium ${textPrimary}`}>
              Active Scans ({activeScans.length})
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${textSecondary}`}
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              <svg 
                className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={() => setActiveScans([])}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${textSecondary}`}
              title="Clear all completed scans"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scan Cards */}
        {!isMinimized && (
          <div className="p-4 max-h-96 overflow-y-auto">
            {activeScans.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`${textSecondary} text-sm`}>No active scans</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeScans.map((scan) => (
                  <ScanProgressCard
                    key={scan.scanId}
                    scanId={scan.scanId}
                    scanType={scan.scanType}
                    deviceName={scan.deviceName}
                    deviceId={scan.deviceId}
                    onComplete={handleScanComplete}
                    onRemove={() => removeScan(scan.scanId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Minimized View */}
        {isMinimized && (
          <div className="p-3">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${textSecondary}`}>
                {activeScans.filter(scan => scan.scanType === 'quick').length} quick, {' '}
                {activeScans.filter(scan => scan.scanType === 'full').length} full scans
              </span>
              <div className="flex space-x-1">
                {activeScans.slice(0, 3).map((scan, index) => (
                  <div
                    key={scan.scanId}
                    className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  />
                ))}
                {activeScans.length > 3 && (
                  <span className={`text-xs ${textSecondary} ml-1`}>+{activeScans.length - 3}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackgroundScanManager;