import { Archive, ArchiveRestore, type LucideProps } from 'lucide-react';

const SIZES = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

export type ArchiveIconSize = keyof typeof SIZES;

type Props = LucideProps & { size?: ArchiveIconSize };

function cn(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** Consistent archive glyph + stroke weight across the app. */
export function ArchiveIcon({ size = 'sm', className, strokeWidth = 1.75, ...props }: Props) {
  return (
    <Archive
      className={cn(SIZES[size], 'shrink-0', className)}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}

export function ArchiveRestoreIcon({ size = 'sm', className, strokeWidth = 1.75, ...props }: Props) {
  return (
    <ArchiveRestore
      className={cn(SIZES[size], 'shrink-0', className)}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}
