import React, { ReactNode, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import Button from './Button';

/** Use on modals with filters or variable-length lists so the shell height stays stable. */
export const MODAL_BODY_MIN_HEIGHT_CLASS = 'min-h-[min(480px,72vh)]';

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
  showVariantIcon?: boolean;
  /** Applied to the scrollable body so short filtered results do not shrink the dialog. */
  contentMinHeightClassName?: string;
  contentClassName?: string;
  /** Merged with `modal-backdrop` (e.g. `!z-[60]` to stack above another modal). */
  backdropClassName?: string;
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
  showVariantIcon = true,
  contentMinHeightClassName,
  contentClassName,
  backdropClassName,
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
    danger: <AlertCircle className="h-5 w-5 text-danger-600 shrink-0" strokeWidth={1.75} />,
    success: <CheckCircle className="h-5 w-5 text-success-600 shrink-0" strokeWidth={1.75} />,
    warning: <AlertTriangle className="h-5 w-5 text-warning-600 shrink-0" strokeWidth={1.75} />,
    info: <Info className="h-5 w-5 text-info-600 shrink-0" strokeWidth={1.75} />,
  };

  const variantHeaderColors = {
    default: 'border-primary-200/80 bg-gradient-to-r from-primary-50/95 via-white to-gray-50/90',
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

  const backdropClasses = ['modal-backdrop', backdropClassName].filter(Boolean).join(' ');

  return (
    <div
      className={backdropClasses}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`relative modal-surface w-full ${sizeClasses[size]} max-h-[calc(100vh-2rem)] min-h-0 flex flex-col animate-slideIn`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b shrink-0 ${variantHeaderColors[variant]}`}>
          <div className={`flex items-center min-w-0 ${showVariantIcon ? 'gap-2.5' : ''}`}>
            {showVariantIcon ? variantIcons[variant] : null}
            <h2 id="modal-title" className="text-base font-semibold text-gray-900 truncate tracking-tight">
              {title}
            </h2>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-primary-500 hover:text-primary-800 transition-colors p-2 rounded-lg hover:bg-primary-100/80 shrink-0"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Content */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 sm:py-5 ${contentMinHeightClassName ?? ''} ${contentClassName ?? ''}`.trim()}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-3.5 bg-primary-50/50 border-t border-primary-200/80 rounded-b-xl shrink-0">
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
  showVariantIcon?: boolean;
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
  showVariantIcon = true,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      variant={variant}
      showVariantIcon={showVariantIcon}
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
