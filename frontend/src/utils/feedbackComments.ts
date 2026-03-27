/**
 * Parses feedback comments to detect when a report was submitted for another PC
 * and from which machine it was submitted (stored by backend when reporting for another PC).
 */
export function parseReportContext(comments: string | null | undefined): {
  reportedForAnotherPC: boolean;
  submittedFrom: string | null;
} {
  if (!comments) return { reportedForAnotherPC: false, submittedFrom: null };
  const reportedForAnotherPC = comments.includes('Report Context: Another PC');
  const m = comments.match(/Submitted from:\s*([^;\n]+)/);
  const submittedFrom = m ? m[1].trim() : null;
  return { reportedForAnotherPC, submittedFrom };
}
