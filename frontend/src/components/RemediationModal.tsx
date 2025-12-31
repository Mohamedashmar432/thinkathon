import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface RemediationModalProps {
  isOpen: boolean;
  onClose: () => void;
  software: {
    name: string;
    version: string;
    deviceId: string;
    deviceName?: string;
  };
  onConfirm: (softwareName: string, deviceId: string) => Promise<void>;
}

const RemediationModal: React.FC<RemediationModalProps> = ({
  isOpen,
  onClose,
  software,
  onConfirm,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'progress' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const overlayBg = isDark ? 'bg-black bg-opacity-75' : 'bg-black bg-opacity-50';

  const handleConfirm = async () => {
    setLoading(true);
    setStatus('progress');
    setMessage('Initiating software removal...');

    try {
      await onConfirm(software.name, software.deviceId);
      setStatus('success');
      setMessage(`${software.name} has been successfully uninstalled from ${software.deviceName || software.deviceId}`);
      
      // Auto-close after 3 seconds on success
      setTimeout(() => {
        onClose();
        resetModal();
      }, 3000);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'Failed to uninstall software. The agent may be offline or the software cannot be removed.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStatus('idle');
    setMessage('');
    setLoading(false);
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      resetModal();
    }
  };

  if (!isOpen) return null;

  const getStatusColor = () => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'progress': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return (
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'progress':
        return (
          <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
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
            {status === 'idle' ? 'Confirm Software Removal' : 'Software Removal Status'}
          </h3>
          {!loading && (
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
                <div className="p-2 bg-orange-100 rounded-lg mr-3">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h4 className={`font-medium ${textPrimary}`}>Remove Software</h4>
                  <p className={`text-sm ${textSecondary}`}>This action cannot be undone</p>
                </div>
              </div>

              <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4 mb-4`}>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSecondary}`}>Software:</span>
                    <span className={`text-sm font-medium ${textPrimary}`}>{software.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSecondary}`}>Version:</span>
                    <span className={`text-sm ${textPrimary}`}>{software.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${textSecondary}`}>Device:</span>
                    <span className={`text-sm ${textPrimary}`}>{software.deviceName || software.deviceId}</span>
                  </div>
                </div>
              </div>

              <div className={`${isDark ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3`}>
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">Important Notes:</p>
                    <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                      <li>• The software will be completely removed from the device</li>
                      <li>• This may affect other applications that depend on it</li>
                      <li>• The agent must be online for this action to work</li>
                      <li>• Some software may require a system restart</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
              <div className="flex items-center">
                {getStatusIcon()}
                <div className="ml-3">
                  <p className="font-medium">{message}</p>
                  {status === 'progress' && (
                    <p className="text-sm mt-1">Please wait while the agent processes this request...</p>
                  )}
                  {status === 'success' && (
                    <p className="text-sm mt-1">This window will close automatically.</p>
                  )}
                </div>
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
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Removing...' : 'Remove Software'}
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

export default RemediationModal;