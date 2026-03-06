import React from 'react';

/* ===== BASE CARD ===== */
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hoverable = false,
  onClick 
}) => {
  return (
    <div
      className={`
        card
        ${hoverable ? 'card-hover cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

/* ===== CARD HEADER ===== */
interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ 
  title, 
  subtitle, 
  action, 
  className = '' 
}) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-200/80 bg-gradient-to-r from-gray-50 to-white ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
};

/* ===== CARD BODY ===== */
interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const CardBody: React.FC<CardBodyProps> = ({ 
  children, 
  className = '', 
  noPadding = false 
}) => {
  return (
    <div className={`${noPadding ? '' : 'p-6'} ${className}`}>
      {children}
    </div>
  );
};

/* ===== CARD FOOTER ===== */
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 bg-gray-50/80 border-t border-gray-200 rounded-b-2xl ${className}`}>
      {children}
    </div>
  );
};

/* ===== STAT CARD ===== */
interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo' | 'orange';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  trend, 
  color = 'blue',
  className = '' 
}) => {
  const colorClasses = {
    blue: 'bg-primary-100 text-primary-700',
    green: 'bg-success-100 text-success-700',
    red: 'bg-danger-100 text-danger-700',
    yellow: 'bg-warning-100 text-warning-700',
    purple: 'bg-purple-100 text-purple-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    orange: 'bg-orange-100 text-orange-700',
  };

  return (
    <Card className={`h-full min-w-0 border-l-4 border-l-primary-200 ${className}`}>
      <CardBody className="p-3 sm:p-4 md:p-5">
        <div className="flex flex-col gap-2 min-w-0">
          {icon && (
            <div className="flex-shrink-0 self-start">
              <div className={`${colorClasses[color]} rounded-lg p-2`}>
                <div className="[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5">
                  {icon}
                </div>
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <dt className="text-[10px] sm:text-[11px] font-medium text-gray-600 uppercase tracking-wide leading-tight break-words">
              {title}
            </dt>
            <dd className="mt-1 flex items-end gap-2 flex-wrap min-w-0">
              <span className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight tabular-nums">
                {value}
              </span>
              {trend && (
                <span
                  className={`text-xs font-medium ${
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
              )}
            </dd>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

/* ===== INFO CARD (for dashboard info blocks) ===== */
interface InfoCardProps {
  icon: React.ReactNode;
  iconColor?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  label: string;
  value: string;
  className?: string;
}

export const InfoCard: React.FC<InfoCardProps> = ({ 
  icon, 
  iconColor = 'blue', 
  label, 
  value, 
  className = '' 
}) => {
  const iconColorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className={`flex items-start space-x-4 ${className}`}>
      <div className="flex-shrink-0">
        <div className={`w-12 h-12 ${iconColorClasses[iconColor]} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
          {label}
        </p>
        <p className="text-base font-semibold text-gray-900 truncate">
          {value}
        </p>
      </div>
    </div>
  );
};
