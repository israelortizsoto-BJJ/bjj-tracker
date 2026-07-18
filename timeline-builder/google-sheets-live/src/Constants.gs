/**
 * Sheet names and layout constants.
 */
const SHEET_MASTER_SCHEDULE = 'NX5 Raw Timeline';
const SHEET_STATUS = 'STATUS';
const SHEET_DATA = SHEET_MASTER_SCHEDULE;
const SHEET_CONFIG = 'Config';
const SHEET_TIMELINE = 'Timeline';
const SHEET_VALIDATION = 'Validation';
const SHEET_RUNTIME_DIAGNOSTICS = 'Runtime Diagnostics';

/** Master Schedule layout - the only editable scheduling source. */
const MASTER_HEADER_ROW = 3;
const MASTER_FIRST_DATA_ROW = 4;
const MASTER_LAST_SETUP_ROW = 1000;
const MASTER_COL_PHASE_TASK = 1;
const MASTER_COL_DURATION = 2;
const MASTER_COL_START_DATE = 3;
const MASTER_COL_FINISH_DATE = 4;
const MASTER_COL_INCLUDE = 5;
const MASTER_COL_CLIENT_LABEL = 6;
const MASTER_COLUMN_COUNT = 6;

/** STATUS sheet layout - column indices (1-based, matches Nx5StatusTemplate headers row 2). */
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
 * Production Timeline V2 layout - formula-driven, setup writes structure once.
 */
const TIMELINE_V2_MAX_WEEKS = 52;
const TIMELINE_V2_MONTH_ROW = 1;
const TIMELINE_V2_WEEK_ROW = 2;
const TIMELINE_V2_HEADER_ROW = 3;
const TIMELINE_V2_DATA_START_ROW = 4;
const TIMELINE_V2_FIRST_WEEK_COL = FIRST_WEEK_COLUMN;
const TIMELINE_V2_LAST_WEEK_COL = TIMELINE_V2_FIRST_WEEK_COL + TIMELINE_V2_MAX_WEEKS - 1;
const TIMELINE_V2_MAX_DATA_ROWS = MASTER_LAST_SETUP_ROW - MASTER_FIRST_DATA_ROW + 1;
/** Hidden helper column for date-bound formulas (min/max from Master Schedule). */
const TIMELINE_V2_META_COL = TIMELINE_V2_LAST_WEEK_COL + 2;
