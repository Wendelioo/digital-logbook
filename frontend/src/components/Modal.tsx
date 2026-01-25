import React, { ReactNode, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  footer?: ReactNode;
  variant?: 'default' | 'danger' | 'success' | 'warning' | 'info';
}

/**
 * Enhanced Modal component with improved styling and variants.
 * 
 * Features:
 * - Multiple sizes (sm to full)
 * - Variant support (default, danger, success, warning, info)
 * - Custom footer
 * - Keyboard navigation (ESC to close)
 * - Overlay click handling
 * - Smooth animations
 * - Accessibility features
 * 
 * @example
 * ```tsx
 * <Modal 
 *   isOpen={isOpen} 
 *   onClose={() => setIsOpen(false)} 
 *   title="Add User"
 *   footer={
 *     <>
 *       <Button variant="outline" onClick={onClose}>Cancel</Button>
 *       <Button variant="primary" onClick={handleSave}>Save</Button>
 *     </>
 *   }
 * >
 *   <form>...</form>
 * </Modal>
 * ```
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'lg',
  showCloseButton = true,
  closeOnOverlayClick = true,
  footer,
  variant = 'default',
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-[95vw]',
  };

  const variantIcons = {
    default: null,
    danger: <AlertCircle className="h-6 w-6 text-danger-600" />,
    success: <CheckCircle className="h-6 w-6 text-success-600" />,
    warning: <AlertTriangle className="h-6 w-6 text-warning-600" />,
    info: <Info className="h-6 w-6 text-info-600" />,
  };

  const variantHeaderColors = {
    default: 'border-gray-200',
    danger: 'border-danger-200 bg-danger-50',
    success: 'border-success-200 bg-success-50',
    warning: 'border-warning-200 bg-warning-50',
    info: 'border-info-200 bg-info-50',
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={`relative bg-white rounded-card shadow-lg-soft w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col animate-slide-in`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${variantHeaderColors[variant]}`}>
          <div className="flex items-center gap-3">
            {variantIcons[variant]}
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-white/50"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ===== CONFIRMATION MODAL ===== */
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant = 'warning',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      variant={variant}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button 
            variant={variant === 'danger' ? 'danger' : 'primary'} 
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  );
};

export default Modal;
