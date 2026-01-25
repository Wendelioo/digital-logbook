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
    <div className={`px-6 py-4 border-b border-gray-200 bg-gray-50 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
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
    <div className={`px-6 py-4 bg-gray-50 border-t border-gray-200 ${className}`}>
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
    blue: 'bg-blue-500 text-white',
    green: 'bg-green-500 text-white',
    red: 'bg-red-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    purple: 'bg-purple-500 text-white',
    indigo: 'bg-indigo-500 text-white',
    orange: 'bg-orange-500 text-white',
  };

  return (
    <Card className={className}>
      <CardBody>
        <div className="flex items-center">
          {icon && (
            <div className="flex-shrink-0">
              <div className={`${colorClasses[color]} rounded-lg p-3 shadow-md`}>
                {icon}
              </div>
            </div>
          )}
          <div className={`${icon ? 'ml-5' : ''} flex-1`}>
            <dt className="text-sm font-medium text-gray-500 uppercase tracking-wide truncate">
              {title}
            </dt>
            <dd className="mt-1 flex items-baseline">
              <span className="text-3xl font-bold text-gray-900">
                {value}
              </span>
              {trend && (
                <span
                  className={`ml-2 text-sm font-medium ${
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
