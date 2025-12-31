import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';

interface ScanProgressCardProps {
  scanId: string;
  scanType: 'quick' | 'full';
  deviceName: string;
  deviceId: string;
  onComplete?: () => void;
  onRemove?: () => void;
}

interface ScanStatus {
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string;
  startTime?: string;
  endTime?: string;
}

const ScanProgressCard: React.FC<ScanProgressCardProps> = ({
  scanId,
  scanType,
  deviceName,
  deviceId,
  onComplete,
  onRemove
}) => {
  const { theme } = useTheme();
  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    status: 'queued',
    progress: 0
  });
  const [isExpanded, setIsExpanded] = useState(true);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';

  useEffect(() => {
    let pollInterval: number;
    let startTime = Date.now();

    const pollScanStatus = async () => {
      try {
        const response = await axios.get(`/api/scan/${scanId}/status`);
        const { status, progress, message } = response.data;
        
        setScanStatus(prev => ({
          ...prev,
          status,
          progress: progress || 0,
          message
        }));

        // Calculate estimated time remaining
        if (status === 'running' && progress > 0) {
          const elapsed = Date.now() - startTime;
          const totalEstimated = (elapsed / progress) * 100;
          const remaining = totalEstimated - elapsed;
          
          if (remaining > 0) {
            const minutes = Math.ceil(remaining / 60000);
            setEstimatedTimeRemaining(`~${minutes} min remaining`);
          }
        }

        // Handle completion
        if (status === 'completed' || status === 'failed') {
          window.clearInterval(pollInterval);
          setScanStatus(prev => ({
            ...prev,
            endTime: new Date().toISOString()
          }));
          
          if (status === 'completed' && onComplete) {
            onComplete();
          }

          // Auto-remove after 10 seconds if completed successfully
          if (status === 'completed') {
            setTimeout(() => {
              if (onRemove) onRemove();
            }, 10000);
          }
        }
      } catch (error) {
        console.error('Error polling scan status:', error);
        // Continue polling on error, but less frequently
      }
    };

    // Start polling immediately
    pollScanStatus();
    
    // Poll every 3 seconds while scan is active
    if (scanStatus.status === 'queued' || scanStatus.status === 'running') {
      pollInterval = window.setInterval(pollScanStatus, 3000);
    }

    return () => {
      if (pollInterval) window.clearInterval(pollInterval);
    };
  }, [scanId, scanStatus.status, onComplete, onRemove]);

  const getStatusColor = () => {
    switch (scanStatus.status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'running': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'queued': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (scanStatus.status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'running':
        return (
          <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'queued':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (scanStatus.status) {
      case 'completed': return 'Scan Completed';
      case 'failed': return 'Scan Failed';
      case 'running': return 'Scanning in Progress';
      case 'queued': return 'Scan Queued';
      default: return 'Unknown Status';
    }
  };

  return (
    <div className={`${cardBg} rounded-lg shadow-sm mb-3 transition-all duration-200 ${
      isExpanded ? 'p-4' : 'p-3'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <div className="flex items-center space-x-2">
              <h4 className={`font-medium ${textPrimary}`}>
                {scanType === 'quick' ? 'Quick' : 'Full'} Scan
              </h4>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            <p className={`text-sm ${textSecondary}`}>{deviceName}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {scanStatus.status === 'running' && (
            <span className={`text-xs ${textMuted}`}>
              {Math.round(scanStatus.progress)}%
            </span>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${textSecondary}`}
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {(scanStatus.status === 'completed' || scanStatus.status === 'failed') && onRemove && (
            <button
              onClick={onRemove}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${textSecondary}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Progress Bar */}
          {(scanStatus.status === 'running' || scanStatus.status === 'queued') && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className={textSecondary}>Progress</span>
                <span className={textSecondary}>
                  {scanStatus.status === 'queued' ? 'Waiting to start...' : `${Math.round(scanStatus.progress)}%`}
                </span>
              </div>
              <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    scanStatus.status === 'queued' 
                      ? 'bg-yellow-500 animate-pulse' 
                      : 'bg-blue-600'
                  }`}
                  style={{ 
                    width: scanStatus.status === 'queued' ? '100%' : `${scanStatus.progress}%` 
                  }}
                ></div>
              </div>
              {estimatedTimeRemaining && scanStatus.status === 'running' && (
                <p className={`text-xs ${textMuted}`}>{estimatedTimeRemaining}</p>
              )}
            </div>
          )}

          {/* Status Message */}
          {scanStatus.message && (
            <div className={`text-sm ${textSecondary} ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded p-2`}>
              {scanStatus.message}
            </div>
          )}

          {/* Scan Details */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className={`${textMuted} block`}>Scan ID</span>
              <span className={`${textSecondary} font-mono`}>{scanId.slice(-8)}</span>
            </div>
            <div>
              <span className={`${textMuted} block`}>Device ID</span>
              <span className={`${textSecondary} font-mono`}>{deviceId.slice(-8)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          {scanStatus.status === 'completed' && (
            <div className="flex space-x-2">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                View Results
              </button>
              {onRemove && (
                <button
                  onClick={onRemove}
                  className={`px-3 py-2 text-sm rounded transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {scanStatus.status === 'failed' && (
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  // Retry logic could be implemented here
                  console.log('Retry scan:', scanId);
                }}
                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                Retry Scan
              </button>
              {onRemove && (
                <button
                  onClick={onRemove}
                  className={`px-3 py-2 text-sm rounded transition-colors ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScanProgressCard;