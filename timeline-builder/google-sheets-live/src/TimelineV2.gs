/**
 * Phase B - Production Timeline V2.
 *
 * Spreadsheet-native timeline: Master Schedule is the only editable source.
 * Setup writes formulas, conditional formatting, and row groups once.
 * Editing Master Schedule dates/includes recalculates instantly - no Apps Script on edit.
 */

/** Short tokens emitted in week cells; drive conditional formatting. */
const TIMELINE_V2_CATEGORY_TOKENS = [
  'DELIVERY',
  'REVIEW',
  'EDIT',
  'SHOOT',
  'PREPRO',
  'CONCEPT',
];

/** Maps Config category names to week-cell tokens. */
const TIMELINE_V2_CATEGORY_TOKEN_MAP = {
  'Delivery / Air / Live': 'DELIVERY',
  'Review / Approval': 'REVIEW',
  'Edit / Post / VFX / Color': 'EDIT',
  'Shoot': 'SHOOT',
  'Pre Pro / Prep': 'PREPRO',
  'Concepting': 'CONCEPT',
};

const TIMELINE_V2_DEFAULT_TOKEN_STYLES = {
  DELIVERY: { fill: '#006B6B', font: '#FFFFFF' },
  REVIEW: { fill: '#A6A6A6', font: '#FFFFFF' },
  EDIT: { fill: '#00B0A8', font: '#FFFFFF' },
  SHOOT: { fill: '#9DC3E6', font: '#1F3864' },
  PREPRO: { fill: '#2F75B5', font: '#FFFFFF' },
  CONCEPT: { fill: '#1F3864', font: '#FFFFFF' },
};

const TIMELINE_V2_DEPT_HEADER_FILL = '#A4C2F4';
const TIMELINE_V2_DEPT_HEADER_FONT = '#000000';
const TIMELINE_V2_ALT_ROW_FILL = '#F9F9F9';

// ---------------------------------------------------------------------------
// Formula builders - pure string generation, no runtime rendering
// ---------------------------------------------------------------------------

function timelineV2MetaColLetter_() {
  return columnToLetter_(TIMELINE_V2_META_COL);
}

function quotedSheetName_(sheetName) {
  return "'" + String(sheetName).replace(/'/g, "''") + "'";
}

function masterRange_(colIndex) {
  const col = columnToLetter_(colIndex);
  return (
    quotedSheetName_(SHEET_MASTER_SCHEDULE) + '!' +
    col + MASTER_FIRST_DATA_ROW + ':' + col + MASTER_LAST_SETUP_ROW
  );
}

function masterIncludedCondition_() {
  const includeRange = masterRange_(MASTER_COL_INCLUDE);
  return '(((' + includeRange + '=TRUE)+(' + includeRange + '=""))>0)';
}

function timelineV2MinStartFormula_() {
  return (
    '=IFERROR(MIN(FILTER(' + masterRange_(MASTER_COL_START_DATE) + ',' +
    masterRange_(MASTER_COL_PHASE_TASK) + '<>"",' +
    masterRange_(MASTER_COL_START_DATE) + '<>"",' +
    masterIncludedCondition_() + ')),"")'
  );
}

function timelineV2MaxFinishFormula_() {
  return (
    '=IFERROR(MAX(FILTER(' + masterRange_(MASTER_COL_FINISH_DATE) + ',' +
    masterRange_(MASTER_COL_PHASE_TASK) + '<>"",' +
    masterRange_(MASTER_COL_FINISH_DATE) + '<>"",' +
    masterIncludedCondition_() + ')),"")'
  );
}

function timelineV2SourceRowsFormula_() {
  const sourceLabel = masterRange_(MASTER_COL_PHASE_TASK);
  const duration = masterRange_(MASTER_COL_DURATION);
  const start = masterRange_(MASTER_COL_START_DATE);
  const finish = masterRange_(MASTER_COL_FINISH_DATE);
  const clientLabel = masterRange_(MASTER_COL_CLIENT_LABEL);
  return (
    '=IFERROR(FILTER({' +
    'IF(LEN(' + clientLabel + '),' + clientLabel + ',' + sourceLabel + '),' +
    duration + ',' + start + ',' + finish + '},' +
    sourceLabel + '<>"",' +
    masterIncludedCondition_() +
    '),{"","","",""})'
  );
}

/** Monday of the week containing the earliest Master Schedule start date. */
function timelineV2FirstWeekStartFormula_() {
  const meta = '$' + timelineV2MetaColLetter_() + '$1';
  return '=IF(' + meta + '="","",' + meta + '-WEEKDAY(' + meta + ',3))';
}

/** Week start for column colIndex (1-based); chains from column F anchor. */
function timelineV2WeekStartFormula_(colIndex) {
  if (colIndex === TIMELINE_V2_FIRST_WEEK_COL) {
    return timelineV2FirstWeekStartFormula_();
  }
  const anchor = columnToLetter_(TIMELINE_V2_FIRST_WEEK_COL) + '$' + TIMELINE_V2_WEEK_ROW;
  return '=IF(' + anchor + '="","",' + anchor + '+7*(COLUMN()-' + TIMELINE_V2_FIRST_WEEK_COL + '))';
}

/** Month label shown when the month changes across week columns. */
function timelineV2MonthLabelFormula_(colIndex) {
  const weekRow = TIMELINE_V2_WEEK_ROW;
  const weekCell = columnToLetter_(colIndex) + weekRow;
  if (colIndex === TIMELINE_V2_FIRST_WEEK_COL) {
    return '=IF(' + weekCell + '="","",TEXT(' + weekCell + ',"MMMM yyyy"))';
  }
  const prevWeekCell = columnToLetter_(colIndex - 1) + weekRow;
  return (
    '=IF(' + weekCell + '="","",' +
    'IF(TEXT(' + weekCell + ',"YYYY-MM")<>TEXT(' + prevWeekCell + ',"YYYY-MM"),' +
    'TEXT(' + weekCell + ',"MMMM yyyy"),""))'
  );
}

/** Row 3 week column header: week number + Monday date from row-2 anchor. */
function timelineV2WeekHeaderFormula_(colIndex) {
  const weekCell = columnToLetter_(colIndex) + '$' + TIMELINE_V2_WEEK_ROW;
  const weekNum = colIndex - TIMELINE_V2_FIRST_WEEK_COL + 1;
  return (
    '=IF(' + weekCell + '="","",' +
    '"W' + weekNum + '"&CHAR(10)&TEXT(' + weekCell + ',"mmm d"))'
  );
}

function timelineV2WeekBarFormula_(timelineRow, colIndex) {
  const weekCell = columnToLetter_(colIndex) + '$' + TIMELINE_V2_WEEK_ROW;
  return (
    '=IF(AND($C' + timelineRow + '<>"",$D' + timelineRow + '<>""),' +
    'IF(AND(' + weekCell + '<>"",' + weekCell + '+6>=$C' + timelineRow + ',' +
    weekCell + '<=$D' + timelineRow + '),$E' + timelineRow + ',""),"")'
  );
}

/**
 * Nested REGEXMATCH formula classifying project name into a category token.
 */
function timelineV2CategoryFormula_(projectCellA1, categories) {
  let inner = '""';
  const ordered = CATEGORY_PRECEDENCE.slice().reverse();
  ordered.forEach(function (catName) {
    const cat = categories.filter(function (c) { return c.name === catName; })[0];
    if (!cat || !cat.patterns.length) {
      return;
    }
    const token = TIMELINE_V2_CATEGORY_TOKEN_MAP[catName] || 'OTHER';
    const pattern = cat.patterns.join('|').toLowerCase();
    inner =
      'IF(REGEXMATCH(LOWER(' + projectCellA1 + '),"' + escapeFormulaPattern_(pattern) + '"),"' +
      token + '",' + inner + ')';
  });
  return '=IF(' + projectCellA1 + '="","",' + inner + ')';
}

function escapeFormulaPattern_(pattern) {
  return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function columnToLetter_(column) {
  let letter = '';
  let col = column;
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

// ---------------------------------------------------------------------------
// Conditional formatting - paints category tokens only
// ---------------------------------------------------------------------------

function timelineV2CategoryStyles_(categories) {
  const styles = {};
  TIMELINE_V2_CATEGORY_TOKENS.forEach(function (token) {
    styles[token] = TIMELINE_V2_DEFAULT_TOKEN_STYLES[token];
  });
  categories.forEach(function (cat) {
    const token = TIMELINE_V2_CATEGORY_TOKEN_MAP[cat.name];
    if (token) {
      styles[token] = { fill: cat.fill, font: cat.font };
    }
  });
  return styles;
}

function applyTimelineV2ConditionalFormatting_(sheet, firstDataRow, lastDataRow) {
  if (lastDataRow < firstDataRow) {
    sheet.clearConditionalFormatRules();
    return;
  }

  const numRows = lastDataRow - firstDataRow + 1;
  const numWeekCols = TIMELINE_V2_MAX_WEEKS;
  const weekRange = sheet.getRange(
    firstDataRow,
    TIMELINE_V2_FIRST_WEEK_COL,
    numRows,
    numWeekCols
  );
  const styles = timelineV2CategoryStyles_(loadConfig(sheet.getParent()).categories);
  const rules = [];

  TIMELINE_V2_CATEGORY_TOKENS.forEach(function (token) {
    const style = styles[token];
    if (!style) {
      return;
    }
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(token)
        .setBackground(style.fill)
        .setFontColor(style.font)
        .setRanges([weekRange])
        .build()
    );
  });

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($A' + firstDataRow + '<>"",$C' + firstDataRow + '="",$D' + firstDataRow + '="")')
      .setBackground(TIMELINE_V2_DEPT_HEADER_FILL)
      .setFontColor(TIMELINE_V2_DEPT_HEADER_FONT)
      .setBold(true)
      .setRanges([sheet.getRange(firstDataRow, 1, numRows, INFO_COLUMN_COUNT)])
      .build()
  );

  sheet.setConditionalFormatRules(rules);
}

// ---------------------------------------------------------------------------
// Row groups - structural metadata, created once during setup
// ---------------------------------------------------------------------------

function applyTimelineV2RowGroups_(sheet, groups, totalCols) {
  groups.forEach(function (group) {
    if (group.endRow < group.startRow) {
      return;
    }
    const numRows = group.endRow - group.startRow + 1;
    sheet.getRange(group.startRow, 1, numRows, totalCols).shiftRowGroupDepth(1);
  });
}

// ---------------------------------------------------------------------------
// Setup - writes sheet structure; never runs on Master Schedule edit
// ---------------------------------------------------------------------------

function setupTimelineV2Production_(spreadsheet) {
  const config = loadConfig(spreadsheet);
  const theme = config.theme;

  let sheet = spreadsheet.getSheetByName(SHEET_TIMELINE);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_TIMELINE);
  }

  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (protection) {
    protection.remove();
  });
  sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (protection) {
    protection.remove();
  });

  sheet.clear();
  sheet.clearConditionalFormatRules();

  const totalCols = TIMELINE_V2_META_COL;

  // Hidden meta: earliest start / latest finish from Master Schedule (drives week columns).
  sheet.getRange(TIMELINE_V2_MONTH_ROW, TIMELINE_V2_META_COL).setFormula(timelineV2MinStartFormula_());
  sheet.getRange(TIMELINE_V2_MONTH_ROW + 1, TIMELINE_V2_META_COL).setFormula(timelineV2MaxFinishFormula_());
  sheet.hideColumns(TIMELINE_V2_META_COL);

  // Row 1 - month headers (formula-derived from week starts).
  for (let col = TIMELINE_V2_FIRST_WEEK_COL; col <= TIMELINE_V2_LAST_WEEK_COL; col++) {
    sheet.getRange(TIMELINE_V2_MONTH_ROW, col).setFormula(timelineV2MonthLabelFormula_(col));
  }
  const monthRange = sheet.getRange(
    TIMELINE_V2_MONTH_ROW,
    TIMELINE_V2_FIRST_WEEK_COL,
    1,
    TIMELINE_V2_MAX_WEEKS
  );
  monthRange.setBackground(theme.monthHeaderFill);
  monthRange.setFontColor(theme.monthHeaderFont);
  monthRange.setFontWeight('bold');
  monthRange.setHorizontalAlignment('center');

  // Row 2 - week start dates (Monday anchors); all bar formulas reference this row.
  for (let col = TIMELINE_V2_FIRST_WEEK_COL; col <= TIMELINE_V2_LAST_WEEK_COL; col++) {
    sheet.getRange(TIMELINE_V2_WEEK_ROW, col).setFormula(timelineV2WeekStartFormula_(col));
  }
  const weekRange = sheet.getRange(
    TIMELINE_V2_WEEK_ROW,
    TIMELINE_V2_FIRST_WEEK_COL,
    1,
    TIMELINE_V2_MAX_WEEKS
  );
  weekRange.setBackground(theme.weekHeaderFill);
  weekRange.setFontColor(theme.weekHeaderFont);
  weekRange.setFontWeight('bold');
  weekRange.setHorizontalAlignment('center');
  weekRange.setWrap(true);
  weekRange.setNumberFormat('mmm d');

  // Row 3 - frozen column headers.
  const headerLabels = ['Phase / Task', 'Duration', 'Start', 'Finish', 'Category'];
  sheet.getRange(TIMELINE_V2_HEADER_ROW, 1, 1, headerLabels.length).setValues([headerLabels]);
  for (let w = 0; w < TIMELINE_V2_MAX_WEEKS; w++) {
    const col = TIMELINE_V2_FIRST_WEEK_COL + w;
    sheet.getRange(TIMELINE_V2_HEADER_ROW, col).setFormula(timelineV2WeekHeaderFormula_(col));
  }
  const headerRange = sheet.getRange(TIMELINE_V2_HEADER_ROW, 1, 1, TIMELINE_V2_LAST_WEEK_COL);
  headerRange.setBackground(theme.headerFill);
  headerRange.setFontColor(theme.headerFont);
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setWrap(true);

  const lastDataRow = TIMELINE_V2_DATA_START_ROW + TIMELINE_V2_MAX_DATA_ROWS - 1;
  const dataRows = lastDataRow - TIMELINE_V2_DATA_START_ROW + 1;

  // Data rows - compact live projection from Master Schedule. Add/delete/include changes recalculate natively.
  sheet.getRange(TIMELINE_V2_DATA_START_ROW, 1).setFormula(timelineV2SourceRowsFormula_());

  for (let row = TIMELINE_V2_DATA_START_ROW; row <= lastDataRow; row++) {
    sheet.getRange(row, 5).setFormula(
      timelineV2CategoryFormula_('$A' + row, config.categories)
    );
    for (let col = TIMELINE_V2_FIRST_WEEK_COL; col <= TIMELINE_V2_LAST_WEEK_COL; col++) {
      sheet.getRange(row, col).setFormula(timelineV2WeekBarFormula_(row, col));
    }
  }

  sheet.getRange(TIMELINE_V2_DATA_START_ROW, 3, dataRows, 2)
    .setNumberFormat('yyyy-mm-dd');
  sheet.getRange(TIMELINE_V2_DATA_START_ROW, 1, dataRows, INFO_COLUMN_COUNT)
    .setBackground('#FFFFFF')
    .setFontColor('#404040')
    .setFontWeight('normal');

  applyTimelineV2ConditionalFormatting_(sheet, TIMELINE_V2_DATA_START_ROW, lastDataRow);

  sheet.setColumnWidths(1, 1, 120);
  sheet.setColumnWidths(2, 1, 200);
  sheet.setColumnWidths(3, 2, 100);
  sheet.setColumnWidths(5, 1, 90);
  sheet.setColumnWidths(TIMELINE_V2_FIRST_WEEK_COL, TIMELINE_V2_MAX_WEEKS, 72);

  sheet.setFrozenRows(TIMELINE_V2_HEADER_ROW);
  sheet.setFrozenColumns(INFO_COLUMN_COUNT);

  protectTimelineV2Sheet_(sheet);

  spreadsheet.setActiveSheet(sheet);
}

function protectTimelineV2Sheet_(sheet) {
  sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
    p.remove();
  });
  sheet
    .protect()
    .setDescription('Timeline - edit Master Schedule only; bars update via formulas')
    .setWarningOnly(true);
}

/** @deprecated Phase A prototype - use setupTimelineV2Production_. */
function setupTimelineV2Prototype_(spreadsheet) {
  setupTimelineV2Production_(spreadsheet);
}
