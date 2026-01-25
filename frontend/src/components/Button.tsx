import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps {
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'outline' | 'ghost' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}

/**
 * Enhanced Button component with consistent styling across the application.
 * 
 * Features:
 * - Multiple variants (primary, secondary, danger, success, warning, outline, ghost, link)
 * - Multiple sizes (xs, sm, md, lg, xl)
 * - Loading state with spinner
 * - Icon support with position control
 * - Full width option
 * - Disabled state
 * - Accessible with focus states
 * 
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleSave}>Save</Button>
 * <Button variant="danger" icon={<Trash2 />}>Delete</Button>
 * <Button loading={isSubmitting} disabled={!isValid}>Submit</Button>
 * <Button variant="outline" size="sm" icon={<Plus />}>Add New</Button>
 * ```
 */
const Button: React.FC<ButtonProps> = ({
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  title,
  children,
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';
  
  const variantClasses = {
    primary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 active:bg-gray-100 focus:ring-gray-400 shadow-sm',
    secondary: 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 active:bg-gray-100 focus:ring-gray-300 shadow-sm',
    danger: 'bg-white text-danger-600 border border-danger-300 hover:bg-danger-50 hover:border-danger-400 hover:text-danger-700 active:bg-danger-100 focus:ring-danger-400 shadow-sm',
    success: 'bg-white text-success-600 border border-success-300 hover:bg-success-50 hover:border-success-400 hover:text-success-700 active:bg-success-100 focus:ring-success-400 shadow-sm',
    warning: 'bg-white text-warning-600 border border-warning-300 hover:bg-warning-50 hover:border-warning-400 hover:text-warning-700 active:bg-warning-100 focus:ring-warning-400 shadow-sm',
    outline: 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300 active:bg-gray-100 focus:ring-gray-300',
    ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200 focus:ring-gray-300',
    link: 'text-gray-600 hover:text-gray-800 underline-offset-4 hover:underline focus:ring-gray-400',
  };
  
  const sizeClasses = {
    xs: 'px-2.5 py-1.5 text-xs gap-1',
    sm: 'px-3 py-2 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-5 py-3 text-base gap-2',
    xl: 'px-6 py-3.5 text-base gap-2.5',
  };

  const iconSizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
    xl: 'h-5 w-5',
  };
  
  const buttonClasses = `
    ${baseClasses} 
    ${variantClasses[variant]} 
    ${sizeClasses[size]} 
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.trim();

  const renderIcon = (iconElement: React.ReactNode) => {
    return (
      <span className={`inline-flex ${iconSizeClasses[size]}`}>
        {iconElement}
      </span>
    );
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={buttonClasses}
      title={title}
    >
      {loading ? (
        <>
          {renderIcon(<Loader2 className="animate-spin" />)}
          {children && <span>Loading...</span>}
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && renderIcon(icon)}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && renderIcon(icon)}
        </>
      )}
    </button>
  );
};

export default Button;
