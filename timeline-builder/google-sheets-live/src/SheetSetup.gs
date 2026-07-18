/**
 * Initial workbook setup and sample data.
 */

function assertTimelineV2SetupPresent_() {
  if (typeof setupTimelineV2Production_ !== 'function') {
    throw new Error(
      'Missing setupTimelineV2Production_ - copy TimelineV2.gs into this Apps Script project.'
    );
  }
}

function setupLivePlanner() {
  assertTimelineV2SetupPresent_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const legacyData = ss.getSheetByName('Data');
  if (legacyData) {
    ss.deleteSheet(legacyData);
  }

  ensureMasterScheduleV1Columns_(ss);

  let configSheet = ss.getSheetByName(SHEET_CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEET_CONFIG);
  }
  writeDefaultConfigSheet_(configSheet);

  if (!ss.getSheetByName(SHEET_VALIDATION)) {
    ss.insertSheet(SHEET_VALIDATION);
  }
  if (!ss.getSheetByName(SHEET_TIMELINE)) {
    ss.insertSheet(SHEET_TIMELINE);
  }

  // Formula timeline - no edit triggers; Master Schedule edits recalculate natively.
  if (typeof uninstallAllTriggers_ === 'function') {
    uninstallAllTriggers_();
  }

  setupTimelineV2Production_(ss);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Timeline ready - edit Master Schedule dates/includes; bars update instantly via formulas.',
    'Setup',
    5
  );
}

function ensureMasterScheduleV1Columns_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SHEET_MASTER_SCHEDULE);
  if (!sheet) {
    throw new Error('Missing source sheet: ' + SHEET_MASTER_SCHEDULE);
  }

  const requiredHeaders = [
    { col: MASTER_COL_PHASE_TASK, label: 'Phase' },
    { col: MASTER_COL_DURATION, label: 'Duration' },
    { col: MASTER_COL_START_DATE, label: 'Start' },
    { col: MASTER_COL_FINISH_DATE, label: 'Finish' },
    { col: MASTER_COL_INCLUDE, label: 'Include in Timeline' },
    { col: MASTER_COL_CLIENT_LABEL, label: 'Client Label' },
  ];

  requiredHeaders.forEach(function (header) {
    const cell = sheet.getRange(MASTER_HEADER_ROW, header.col);
    if (!normalizeText(cell.getValue())) {
      cell.setValue(header.label);
    }
  });

  const setupRows = MASTER_LAST_SETUP_ROW - MASTER_FIRST_DATA_ROW + 1;
  const includeRange = sheet.getRange(MASTER_FIRST_DATA_ROW, MASTER_COL_INCLUDE, setupRows, 1);
  const includeValues = includeRange.getValues();
  includeRange.insertCheckboxes();
  const nextValues = includeValues.map(function (row) {
    const existing = row[0];
    if (existing === '' || existing === null) {
      return [true];
    }
    return [existing];
  });
  includeRange.setValues(nextValues);

  sheet.getRange(MASTER_HEADER_ROW, 1, 1, MASTER_COLUMN_COUNT)
    .setFontWeight('bold')
    .setWrap(true);
  sheet.setFrozenRows(MASTER_HEADER_ROW);
}

function buildStatusSheetFromTemplate_(spreadsheet) {
  throw new Error('STATUS template setup is deprecated. Use setupLivePlanner with Master Schedule.');
}

function protectDataSheetEditing_(spreadsheet) {
  spreadsheet.getSheets().forEach(function (sheet) {
    if (sheet.getName() === SHEET_MASTER_SCHEDULE) return;
    if (sheet.getName() === SHEET_CONFIG) {
      sheet.protect().setDescription('Config - edit with care').setWarningOnly(true);
    }
  });
}
