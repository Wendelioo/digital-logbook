import { SaveFileDialog } from '../../wailsjs/go/backend/App';

export type ExportFormat = 'csv' | 'pdf' | 'docx';

const FILTERS: Record<ExportFormat, [string, string]> = {
  csv: ['CSV files', '*.csv'],
  pdf: ['PDF files', '*.pdf'],
  docx: ['Word documents', '*.docx'],
};

/**
 * Opens the native Save As dialog so the user can choose where to save (e.g. Documents).
 * Returns the chosen path, or null if cancelled or on error.
 */
export async function openExportSaveDialog(
  title: string,
  defaultFilename: string,
  format: ExportFormat
): Promise<string | null> {
  const [filterName, filterPattern] = FILTERS[format];
  try {
    const path = await SaveFileDialog(title, defaultFilename, filterName, filterPattern);
    return path && path.trim() ? path : null;
  } catch {
    return null;
  }
}

/** Suggested default filename for classlist export (include extension, e.g. .csv) */
export function defaultClasslistFilename(ext: string): string {
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  return `classlist_${ts}.${ext}`;
}

/** Suggested default filename for attendance export */
export function defaultAttendanceFilename(date: string, ext: string, archived = false): string {
  const prefix = archived ? 'archived_attendance' : 'attendance';
  const ts = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  return `${prefix}_${date}_${ts}.${ext}`;
}

/** Suggested default filename for log entries range export */
export function defaultLogsRangeFilename(start: string, end: string, ext: string): string {
  const ts = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  return `log_entries_${start}_to_${end}_${ts}.${ext}`;
}

/** Suggested default filename for feedback range export */
export function defaultFeedbackRangeFilename(start: string, end: string, ext: string): string {
  const ts = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  return `feedback_${start}_to_${end}_${ts}.${ext}`;
}

/** Suggested default filename for active log count export */
export function defaultLogsCountFilename(count: number, ext: string): string {
  const ts = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  return `log_entries_latest_${count}_${ts}.${ext}`;
}

/** Suggested default filename for active feedback count export */
export function defaultFeedbackCountFilename(count: number, ext: string): string {
  const ts = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  return `feedback_latest_${count}_${ts}.${ext}`;
}

/** Suggested default filename for active log row-range export */
export function defaultLogsRowRangeFilename(fromRow: number, toRow: number, ext: string): string {
  const ts = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  return `log_entries_rows_${fromRow}_to_${toRow}_${ts}.${ext}`;
}

/** Suggested default filename for active feedback row-range export */
export function defaultFeedbackRowRangeFilename(fromRow: number, toRow: number, ext: string): string {
  const ts = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  return `feedback_rows_${fromRow}_to_${toRow}_${ts}.${ext}`;
}

/** Suggested default filename for archived log sheet (single date) */
export function defaultArchivedLogFilename(date: string, ext: string): string {
  return `log_entries_${date}.${ext}`;
}

/** Suggested default filename for archived feedback sheet (single date) */
export function defaultArchivedFeedbackFilename(date: string, ext: string): string {
  return `equipment_reports_${date}.${ext}`;
}

/** Get directory from a full file path (for saving multiple files to the same folder). */
export function getDirectoryFromPath(fullPath: string): string {
  const lastSep = Math.max(fullPath.lastIndexOf('\\'), fullPath.lastIndexOf('/'));
  return lastSep >= 0 ? fullPath.slice(0, lastSep) : fullPath;
}
