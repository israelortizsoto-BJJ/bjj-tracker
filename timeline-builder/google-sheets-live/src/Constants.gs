/**
 * Sheet names and layout constants (matches Python Timeline Builder spec).
 */
const SHEET_DATA = 'Data';
const SHEET_CONFIG = 'Config';
const SHEET_TIMELINE = 'Timeline';
const SHEET_VALIDATION = 'Validation';
const SHEET_RUNTIME_DIAGNOSTICS = 'Runtime Diagnostics';

const DATA_HEADERS = [
  'Project',
  'Task Name',
  'Start Date',
  'Finish Date',
  'Critical Date',
];

const INFO_COLUMN_COUNT = 5;
const FIRST_WEEK_COLUMN = 6; // column F

const HEADER_ROWS = 3;
const DATA_START_ROW = 4;

const DEBOUNCE_MS = 2000;
const DEBOUNCE_HANDLER = 'debouncedRefreshTimeline';

/** Fixed category precedence (first match wins). */
const CATEGORY_PRECEDENCE = [
  'Delivery / Air / Live',
  'Review / Approval',
  'Edit / Post / VFX / Color',
  'Shoot',
  'Pre Pro / Prep',
  'Concepting',
];
