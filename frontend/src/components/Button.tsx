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
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus:ring-primary-500 shadow-sm hover:shadow',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800 focus:ring-gray-500 shadow-sm hover:shadow',
    danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 focus:ring-danger-500 shadow-sm hover:shadow',
    success: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-800 focus:ring-success-500 shadow-sm hover:shadow',
    warning: 'bg-warning-600 text-white hover:bg-warning-700 active:bg-warning-800 focus:ring-warning-500 shadow-sm hover:shadow',
    outline: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus:ring-primary-500 shadow-sm',
    ghost: 'text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-300',
    link: 'text-primary-600 hover:text-primary-700 underline-offset-4 hover:underline focus:ring-primary-500',
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
