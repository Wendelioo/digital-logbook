/**
 * Parses feedback comments to detect when a report was submitted for another PC
 * and from which machine it was submitted (stored by backend when reporting for another PC).
 */
export function parseReportContext(comments: string | null | undefined): {
  reportedForAnotherPC: boolean;
  submittedFrom: string | null;
} {
  if (!comments) return { reportedForAnotherPC: false, submittedFrom: null };

  const m = comments.match(/Submitted from:\s*([^;\n]+)/);
  const submittedFrom = m ? m[1].trim() : null;

  const reportedForAnotherPC =
    comments.includes('Report Context: Another PC') ||
    /Computer Lab\s*&\s*PC Number:/i.test(comments) ||
    !!submittedFrom;

  return { reportedForAnotherPC, submittedFrom };
}

const INTERNAL_COMMENT_PREFIXES: RegExp[] = [
  /^Computer:/i,
  /^Monitor:/i,
  /^Keyboard:/i,
  /^Mouse:/i,
  /^Submitted from:/i,
  /^Report Context:\s*Another PC/i,
  /^Computer Lab\s*&\s*PC Number:/i,
];

function splitCommentParts(comments: string): string[] {
  return comments
    .split(/;\s*/)
    .flatMap((part) => part.split(/\r?\n/))
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Extracts only the free-form optional comment entered by the user.
 * Hides auto-generated metadata and equipment issue fragments.
 */
export function getOptionalUserComment(comments: string | null | undefined): string | null {
  if (!comments) return null;

  const extracted: string[] = [];

  for (const part of splitCommentParts(comments)) {
    const additionalMatch = part.match(/^(?:Additional comments|Additional):\s*(.+)$/i);
    if (additionalMatch) {
      const value = additionalMatch[1].trim();
      if (value && !/^Computer Lab\s*&\s*PC Number:/i.test(value)) {
        extracted.push(value);
      }
      continue;
    }

    if (INTERNAL_COMMENT_PREFIXES.some((pattern) => pattern.test(part))) {
      continue;
    }

    extracted.push(part);
  }

  if (extracted.length === 0) return null;
  return extracted.join('\n');
}

export function hasOptionalUserComment(comments: string | null | undefined): boolean {
  return !!getOptionalUserComment(comments);
}
