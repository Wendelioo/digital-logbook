import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

/* ===== BADGE COMPONENT ===== */
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'gray', 
  size = 'md',
  rounded = false,
  className = '' 
}) => {
  const variantClasses = {
    primary: 'bg-primary-100 text-primary-800 border border-primary-200',
    success: 'bg-success-100 text-success-800 border border-success-200',
    danger: 'bg-danger-100 text-danger-800 border border-danger-200',
    warning: 'bg-warning-100 text-warning-800 border border-warning-200',
    info: 'bg-info-100 text-info-800 border border-info-200',
    gray: 'bg-gray-100 text-gray-800 border border-gray-200',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  return (
    <span 
      className={`
        inline-flex items-center font-medium
        ${rounded ? 'rounded-full' : 'rounded'}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

/* ===== STATUS BADGE (with dot indicator) ===== */
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'success' | 'error';
  label?: string;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  label,
  showDot = true 
}) => {
  const statusConfig = {
    active: {
      color: 'bg-success-100 text-success-800 border-success-200',
      dotColor: 'bg-success-500',
      label: label || 'Active',
    },
    inactive: {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      dotColor: 'bg-gray-500',
      label: label || 'Inactive',
    },
    pending: {
      color: 'bg-warning-100 text-warning-800 border-warning-200',
      dotColor: 'bg-warning-500',
      label: label || 'Pending',
    },
    success: {
      color: 'bg-success-100 text-success-800 border-success-200',
      dotColor: 'bg-success-500',
      label: label || 'Success',
    },
    error: {
      color: 'bg-danger-100 text-danger-800 border-danger-200',
      dotColor: 'bg-danger-500',
      label: label || 'Error',
    },
  };

  const config = statusConfig[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {showDot && (
        <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`}></span>
      )}
      {config.label}
    </span>
  );
};

/* ===== ALERT COMPONENT ===== */
interface AlertProps {
  variant?: 'success' | 'danger' | 'warning' | 'info';
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
  className = '',
}) => {
  const variantConfig = {
    success: {
      bg: 'bg-success-50',
      border: 'border-success-200',
      icon: <CheckCircle className="h-5 w-5 text-success-600" />,
      titleColor: 'text-success-800',
      messageColor: 'text-success-700',
    },
    danger: {
      bg: 'bg-danger-50',
      border: 'border-danger-200',
      icon: <AlertCircle className="h-5 w-5 text-danger-600" />,
      titleColor: 'text-danger-800',
      messageColor: 'text-danger-700',
    },
    warning: {
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      icon: <AlertTriangle className="h-5 w-5 text-warning-600" />,
      titleColor: 'text-warning-800',
      messageColor: 'text-warning-700',
    },
    info: {
      bg: 'bg-info-50',
      border: 'border-info-200',
      icon: <Info className="h-5 w-5 text-info-600" />,
      titleColor: 'text-info-800',
      messageColor: 'text-info-700',
    },
  };

  const config = variantConfig[variant];

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">{config.icon}</div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-semibold ${config.titleColor} mb-1`}>
              {title}
            </h3>
          )}
          <p className={`text-sm ${config.messageColor}`}>{message}</p>
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

/* ===== NOTIFICATION TOAST (for fixed position notifications) ===== */
interface NotificationProps {
  variant?: 'success' | 'danger' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const Notification: React.FC<NotificationProps> = ({
  variant = 'info',
  title,
  message,
  onClose,
  position = 'top-right',
}) => {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const variantConfig = {
    success: {
      bg: 'bg-white',
      border: 'border-l-4 border-success-500',
      icon: <CheckCircle className="h-6 w-6 text-success-500" />,
    },
    danger: {
      bg: 'bg-white',
      border: 'border-l-4 border-danger-500',
      icon: <AlertCircle className="h-6 w-6 text-danger-500" />,
    },
    warning: {
      bg: 'bg-white',
      border: 'border-l-4 border-warning-500',
      icon: <AlertTriangle className="h-6 w-6 text-warning-500" />,
    },
    info: {
      bg: 'bg-white',
      border: 'border-l-4 border-info-500',
      icon: <Info className="h-6 w-6 text-info-500" />,
    },
  };

  const config = variantConfig[variant];

  return (
    <div className={`fixed ${positionClasses[position]} z-50 max-w-sm w-full ${config.bg} shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden animate-slide-in`}>
      <div className={`p-4 ${config.border}`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">{config.icon}</div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            {title && (
              <p className="text-sm font-semibold text-gray-900">{title}</p>
            )}
            <p className={`text-sm text-gray-600 ${title ? 'mt-1' : ''}`}>
              {message}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-4 flex-shrink-0 inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
