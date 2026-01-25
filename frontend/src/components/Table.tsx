import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  hoverable?: boolean;
  striped?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  onRowClick?: (item: T, index: number) => void;
}

/**
 * Professional Table Component with modern styling
 * 
 * Features:
 * - Sortable columns
 * - Striped rows
 * - Hover effects
 * - Sticky header
 * - Loading state
 * - Custom cell rendering
 * - Responsive design
 * 
 * @example
 * ```tsx
 * <Table
 *   data={users}
 *   columns={[
 *     { key: 'name', label: 'Name', sortable: true },
 *     { key: 'email', label: 'Email', sortable: true },
 *     { key: 'actions', label: 'Actions', render: (user) => <Button>Edit</Button> }
 *   ]}
 *   sortKey={sortKey}
 *   sortDirection={sortDirection}
 *   onSort={handleSort}
 * />
 * ```
 */
function Table<T extends Record<string, any>>({
  data,
  columns,
  sortKey,
  sortDirection = 'asc',
  onSort,
  loading = false,
  emptyMessage = 'No data available',
  hoverable = true,
  striped = true,
  compact = false,
  stickyHeader = false,
  onRowClick,
}: TableProps<T>) {
  const handleHeaderClick = (column: Column<T>) => {
    if (column.sortable && onSort) {
      onSort(column.key);
    }
  };

  const getCellValue = (item: T, column: Column<T>) => {
    if (column.render) {
      return column.render(item, data.indexOf(item));
    }
    return item[column.key] ?? '-';
  };

  const getAlignmentClass = (align?: string) => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
      <div className={`overflow-x-auto ${stickyHeader ? 'max-h-[600px] overflow-y-auto' : ''}`}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className={`bg-gray-50 ${stickyHeader ? 'sticky top-0 z-10 shadow-sm' : ''}`}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`
                    px-6 ${compact ? 'py-2' : 'py-3'}
                    text-xs font-semibold text-gray-600 uppercase tracking-wider
                    ${getAlignmentClass(column.align)}
                    ${column.sortable ? 'cursor-pointer select-none hover:bg-gray-100 transition-colors' : ''}
                    ${column.width ? column.width : ''}
                  `}
                  style={column.width ? { width: column.width } : undefined}
                  onClick={() => column.sortable && handleHeaderClick(column)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="inline-flex flex-col">
                        {sortKey === column.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-4 w-4 text-primary-600" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-primary-600" />
                          )
                        ) : (
                          <div className="flex flex-col opacity-30">
                            <ChevronUp className="h-3 w-3 -mb-1" />
                            <ChevronDown className="h-3 w-3" />
                          </div>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`bg-white divide-y divide-gray-200 ${striped ? '' : ''}`}>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      className="h-12 w-12 text-gray-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={index}
                  className={`
                    ${striped && index % 2 === 0 ? 'bg-white' : striped ? 'bg-gray-50' : 'bg-white'}
                    ${hoverable ? 'hover:bg-primary-50 transition-colors' : ''}
                    ${onRowClick ? 'cursor-pointer' : ''}
                  `}
                  onClick={() => onRowClick && onRowClick(item, index)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`
                        px-6 ${compact ? 'py-2' : 'py-4'}
                        text-sm text-gray-900
                        ${getAlignmentClass(column.align)}
                      `}
                    >
                      {getCellValue(item, column)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
