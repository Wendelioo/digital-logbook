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
  title: React.ReactNode;
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
    <div className={`px-5 py-3.5 border-b border-gray-200/90 bg-gray-50/90 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-semibold text-gray-900 tracking-tight">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600 leading-snug">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
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
    <div className={`${noPadding ? '' : 'p-5 sm:p-6'} ${className}`}>
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
    <div className={`px-5 py-3.5 bg-gray-50/90 border-t border-gray-200/90 rounded-b-2xl ${className}`}>
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
    // Keep non-neutral dashboard tones subtle and consistent.
    purple: 'bg-primary-100 text-primary-700',
    indigo: 'bg-primary-100 text-primary-700',
    orange: 'bg-warning-100 text-warning-700',
  };

  const borderLClasses = {
    blue: 'border-l-primary-200',
    green: 'border-l-success-200',
    red: 'border-l-danger-200',
    yellow: 'border-l-warning-200',
    purple: 'border-l-primary-200',
    indigo: 'border-l-primary-200',
    orange: 'border-l-warning-200',
  };

  return (
    <Card className={`min-w-0 border-l-4 ${borderLClasses[color]} ${className}`}>
      <CardBody noPadding className="p-3 sm:p-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="flex-shrink-0">
              <div className={`${colorClasses[color]} rounded-xl p-2`}>
                <div className="[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5">
                  {icon}
                </div>
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <dt className="text-[10px] sm:text-xs font-medium text-gray-600 uppercase tracking-wide leading-snug whitespace-normal break-words">
              {title}
            </dt>
            <dd className="mt-0.5 flex items-baseline gap-1.5 flex-wrap min-w-0">
              <span className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight tabular-nums">
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
  iconColor?: 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'red';
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
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="flex-shrink-0">
        <div
          className={`w-10 h-10 ${iconColorClasses[iconColor]} rounded-lg flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5`}
        >
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
          {label}
        </p>
        <p className="text-sm sm:text-base font-semibold text-gray-900 leading-snug whitespace-normal break-words">
          {value}
        </p>
      </div>
    </div>
  );
};
