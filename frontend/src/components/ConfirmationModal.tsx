import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmationContextType {
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
};

interface ConfirmationProviderProps {
  children: ReactNode;
}

export const ConfirmationProvider: React.FC<ConfirmationProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = (options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(options);
      setResolver(() => resolve);
      setIsOpen(true);
    });
  };

  const handleConfirm = () => {
    if (resolver) {
      resolver(true);
    }
    handleClose();
  };

  const handleCancel = () => {
    if (resolver) {
      resolver(false);
    }
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setOptions(null);
    setResolver(null);
  };

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <ConfirmationModal
          options={options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmationContext.Provider>
  );
};

interface ConfirmationModalProps {
  options: ConfirmationOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  options,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const modalBg = isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const overlayBg = isDark ? 'bg-black bg-opacity-75' : 'bg-black bg-opacity-50';

  const getTypeStyles = () => {
    switch (options.type) {
      case 'danger':
        return {
          icon: (
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          iconBg: 'bg-red-100',
          confirmButton: 'bg-red-600 hover:bg-red-700 text-white',
        };
      case 'warning':
        return {
          icon: (
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          iconBg: 'bg-yellow-100',
          confirmButton: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        };
      default:
        return {
          icon: (
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          iconBg: 'bg-blue-100',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
        };
    }
  };

  const typeStyles = getTypeStyles();

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${overlayBg}`}>
      <div className={`${modalBg} rounded-lg shadow-xl max-w-md w-full mx-4 p-6`}>
        {/* Header */}
        <div className="flex items-center mb-4">
          <div className={`p-2 ${typeStyles.iconBg} rounded-lg mr-3`}>
            {typeStyles.icon}
          </div>
          <h3 className={`text-lg font-semibold ${textPrimary}`}>
            {options.title}
          </h3>
        </div>

        {/* Message */}
        <div className="mb-6">
          <p className={`${textSecondary}`}>
            {options.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 justify-end">
          <button
            onClick={onCancel}
            className={`px-4 py-2 border rounded-lg transition-colors ${
              isDark
                ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {options.cancelText || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg transition-colors ${typeStyles.confirmButton}`}
          >
            {options.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};