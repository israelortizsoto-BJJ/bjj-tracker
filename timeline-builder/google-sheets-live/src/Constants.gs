/**
 * Sheet names and layout constants (matches Python Timeline Builder spec).
 */
const SHEET_STATUS = 'STATUS';
const SHEET_DATA = SHEET_STATUS;
const SHEET_CONFIG = 'Config';
const SHEET_TIMELINE = 'Timeline';
const SHEET_VALIDATION = 'Validation';
const SHEET_RUNTIME_DIAGNOSTICS = 'Runtime Diagnostics';

/** STATUS sheet layout — column indices (1-based, matches Nx5StatusTemplate headers row 2). */
const STATUS_HEADER_ROW = 2;
const STATUS_FIRST_DATA_ROW = 5;
const STATUS_COL_IUS_POC = 1;
const STATUS_COL_PROJECT = 4;
const STATUS_COL_START_DATE = 8;
const STATUS_COL_FINISH_DATE = 9;

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

/**
 * Production Timeline V2 layout — formula-driven, setup writes structure once.
 */
const TIMELINE_V2_MAX_WEEKS = 52;
const TIMELINE_V2_MONTH_ROW = 1;
const TIMELINE_V2_WEEK_ROW = 2;
const TIMELINE_V2_HEADER_ROW = 3;
const TIMELINE_V2_DATA_START_ROW = 4;
const TIMELINE_V2_FIRST_WEEK_COL = FIRST_WEEK_COLUMN;
const TIMELINE_V2_LAST_WEEK_COL = TIMELINE_V2_FIRST_WEEK_COL + TIMELINE_V2_MAX_WEEKS - 1;
/** Hidden helper column for date-bound formulas (min/max from STATUS). */
const TIMELINE_V2_META_COL = TIMELINE_V2_LAST_WEEK_COL + 2;
