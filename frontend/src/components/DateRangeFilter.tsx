import React, { useState } from 'react';
import Button from './Button';
import { Calendar } from 'lucide-react';

interface DateRangeFilterProps {
  onApply: (startDate: string, endDate: string) => void;
  maxDate?: string;
  className?: string;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ 
  onApply, 
  maxDate, 
  className = '' 
}) => {
  const getYesterdayDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  const get30DaysAgoDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(get30DaysAgoDate());
  const [endDate, setEndDate] = useState(getYesterdayDate());

  const handleApply = () => {
    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        alert('Start date cannot be after end date');
        return;
      }
      onApply(startDate, endDate);
    }
  };

  const defaultMaxDate = maxDate || getYesterdayDate();

  return (
    <div className={`flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 ${className}`}>
      <div className="flex items-center gap-2 text-gray-700">
        <Calendar className="h-5 w-5 text-gray-500" />
        <label className="text-sm font-medium">Date Range:</label>
      </div>
      <div className="flex items-center gap-3">
        <input 
          type="date" 
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          max={defaultMaxDate}
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <span className="text-gray-500 text-sm font-medium">to</span>
        <input 
          type="date" 
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          max={defaultMaxDate}
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>
      <Button 
        variant="primary" 
        onClick={handleApply}
        className="ml-2"
      >
        Apply Filter
      </Button>
    </div>
  );
};

export default DateRangeFilter;
