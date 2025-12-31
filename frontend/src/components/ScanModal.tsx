import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanType: 'quick' | 'full';
  deviceName: string;
  onConfirm: () => Promise<void>;
  status?: 'idle' | 'scanning' | 'success' | 'error';
  message?: string;
  progress?: number;
}

const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  scanType,
  deviceName,
  onConfirm,
  status: externalStatus,
  message: externalMessage,
  progress: externalProgress,
}) => {
  const { theme } = useTheme();
  const [internalStatus, setInternalStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [internalMessage, setInternalMessage] = useState('');
  const [internalProgress, setInternalProgress] = useState(0);

  // Use external props if provided, otherwise use internal state
  const status = externalStatus || internalStatus;
  const message = externalMessage || internalMessage;
  const progress = externalProgress !== undefined ? externalProgress : internalProgress;

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const overlayBg = isDark ? 'bg-black bg-opacity-75' : 'bg-black bg-opacity-50';

  useEffect(() => {
    if (status === 'scanning' && externalProgress === undefined) {
      const interval = setInterval(() => {
        setInternalProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);

      return () => clearInterval(interval);
    }
  }, [status, externalProgress]);

  useEffect(() => {
    if (status === 'success') {
      // Auto-close after 3 seconds on success
      const timeout = setTimeout(() => {
        onClose();
        resetModal();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [status, onClose]);

  const handleConfirm = async () => {
    if (!externalStatus) {
      setInternalStatus('scanning');
      setInternalProgress(0);
      setInternalMessage(`Initiating ${scanType} scan on ${deviceName}...`);
    }

    try {
      await onConfirm();
      if (!externalStatus) {
        setInternalProgress(100);
        setInternalStatus('success');
        setInternalMessage(`${scanType === 'quick' ? 'Quick' : 'Full'} scan completed successfully! Check your dashboard for results.`);
      }
    } catch (error: any) {
      if (!externalStatus) {
        setInternalStatus('error');
        setInternalMessage(error.response?.data?.message || 'Scan failed. The agent may be offline or unable to process the request.');
      }
    }
  };

  const resetModal = () => {
    setInternalStatus('idle');
    setInternalMessage('');
    setInternalProgress(0);
  };

  const handleClose = () => {
    if (status !== 'scanning') {
      onClose();
      resetModal();
    }
  };

  if (!isOpen) return null;

  const getStatusColor = () => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'scanning': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return (
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'scanning':
        return (
          <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${overlayBg}`}>
      <div className={`${modalBg} rounded-lg shadow-xl max-w-md w-full mx-4 p-6`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-lg font-semibold ${textPrimary}`}>
            {status === 'idle' ? `${scanType === 'quick' ? 'Quick' : 'Full'} Security Scan` : 'Scan Status'}
          </h3>
          {status !== 'scanning' && (
            <button
              onClick={handleClose}
              className={`${textSecondary} hover:${textPrimary} transition-colors`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mb-6">
          {status === 'idle' ? (
            <div>
              <div className="flex items-center mb-4">
                <div className="p-3 bg-blue-100 rounded-lg mr-4">
                  {getStatusIcon()}
                </div>
                <div>
                  <h4 className={`font-medium ${textPrimary}`}>
                    {scanType === 'quick' ? 'Quick Scan' : 'Full Security Scan'}
                  </h4>
                  <p className={`text-sm ${textSecondary}`}>
                    {scanType === 'quick' 
                      ? 'Fast vulnerability check (2-3 minutes)'
                      : 'Comprehensive security analysis (5-10 minutes)'
                    }
                  </p>
                </div>
              </div>

              <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4 mb-4`}>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSecondary}`}>Device:</span>
                    <span className={`text-sm font-medium ${textPrimary}`}>{deviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSecondary}`}>Scan Type:</span>
                    <span className={`text-sm ${textPrimary}`}>
                      {scanType === 'quick' ? 'Quick Scan' : 'Full Security Scan'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSecondary}`}>Estimated Time:</span>
                    <span className={`text-sm ${textPrimary}`}>
                      {scanType === 'quick' ? '2-3 minutes' : '5-10 minutes'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`${isDark ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3`}>
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm text-blue-800 font-medium">What this scan will do:</p>
                    <ul className="text-xs text-blue-700 mt-1 space-y-1">
                      <li>• Check for software vulnerabilities</li>
                      <li>• Analyze system security configuration</li>
                      {scanType === 'full' && (
                        <>
                          <li>• Perform malware detection</li>
                          <li>• Check for suspicious network activity</li>
                          <li>• Validate security patches</li>
                        </>
                      )}
                      <li>• Update your security score</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
                <div className="flex items-center mb-4">
                  {getStatusIcon()}
                  <div className="ml-3">
                    <p className="font-medium">{message}</p>
                    {status === 'scanning' && (
                      <p className="text-sm mt-1">Please keep this window open...</p>
                    )}
                    {status === 'success' && (
                      <p className="text-sm mt-1">This window will close automatically.</p>
                    )}
                  </div>
                </div>
                
                {status === 'scanning' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {status === 'idle' && (
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className={`flex-1 px-4 py-2 border rounded-lg transition-colors ${
                isDark
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start {scanType === 'quick' ? 'Quick' : 'Full'} Scan
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanModal;