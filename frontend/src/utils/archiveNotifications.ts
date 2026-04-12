export type ArchiveEntity = 'class' | 'classlist' | 'attendance';
export type ArchiveAction = 'archive' | 'restore';

const ENTITY_LABEL: Record<ArchiveEntity, string> = {
  class: 'Class',
  classlist: 'Classlist',
  attendance: 'Attendance',
};

const ENTITY_NOUN: Record<ArchiveEntity, string> = {
  class: 'class',
  classlist: 'classlist',
  attendance: 'attendance',
};

const ACTION_PAST_TENSE: Record<ArchiveAction, string> = {
  archive: 'archived',
  restore: 'restored',
};

const ACTION_VERB: Record<ArchiveAction, string> = {
  archive: 'archive',
  restore: 'restore',
};

export const getArchiveSuccessMessage = (entity: ArchiveEntity, action: ArchiveAction): string => {
  return `${ENTITY_LABEL[entity]} ${ACTION_PAST_TENSE[action]} successfully.`;
};

export const getArchiveErrorMessage = (entity: ArchiveEntity, action: ArchiveAction, error?: unknown): string => {
  const detail = error instanceof Error ? error.message : 'Please try again.';
  return `Failed to ${ACTION_VERB[action]} ${ENTITY_NOUN[entity]}. ${detail}`;
};
