/**
 * Initial workbook setup and sample data.
 */

function assertTimelineV2SetupPresent_() {
  if (typeof setupTimelineV2Production_ !== 'function') {
    throw new Error(
      'Missing setupTimelineV2Production_ — copy TimelineV2.gs into this Apps Script project.'
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

  buildStatusSheetFromTemplate_(ss);

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

  // Formula timeline — no edit triggers; STATUS edits recalculate natively.
  if (typeof uninstallAllTriggers_ === 'function') {
    uninstallAllTriggers_();
  }

  setupTimelineV2Production_(ss);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Timeline V2 ready — edit STATUS dates; bars update instantly via formulas.',
    'Setup',
    5
  );
}

function buildStatusSheetFromTemplate_(spreadsheet) {
  const existingStatus = spreadsheet.getSheetByName(SHEET_STATUS);
  if (existingStatus) {
    spreadsheet.deleteSheet(existingStatus);
  }

  const sheet = spreadsheet.insertSheet(SHEET_STATUS, 0);
  const rowCount = STATUS_TEMPLATE_ROWS.length;
  const colCount = STATUS_COLUMN_COUNT;

  const values = STATUS_TEMPLATE_ROWS.map(function (row) {
    return row.values;
  });
  const backgrounds = STATUS_TEMPLATE_ROWS.map(function (row) {
    return row.backgrounds;
  });
  const fontColors = STATUS_TEMPLATE_ROWS.map(function (row) {
    return row.fontColors;
  });

  const dataRange = sheet.getRange(1, 1, rowCount, colCount);
  dataRange.setValues(values);
  dataRange.setBackgrounds(backgrounds);
  dataRange.setFontColors(fontColors);

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const boldFlags = STATUS_TEMPLATE_ROWS[rowIndex].bold;
    for (let colIndex = 0; colIndex < colCount; colIndex++) {
      if (boldFlags[colIndex]) {
        sheet.getRange(rowIndex + 1, colIndex + 1).setFontWeight('bold');
      }
    }
  }

  for (let rowIndex = 0; rowIndex < STATUS_ROW_HEIGHTS.length; rowIndex++) {
    sheet.setRowHeight(rowIndex + 1, STATUS_ROW_HEIGHTS[rowIndex]);
  }

  STATUS_MERGED_RANGES.forEach(function (merge) {
    const numCols = merge.endCol - merge.startCol + 1;
    const templateRow = STATUS_TEMPLATE_ROWS[merge.row - 1];
    const range = sheet.getRange(merge.row, merge.startCol, 1, numCols);
    range.merge();
    range.setBackground(templateRow.backgrounds[merge.startCol - 1]);
    range.setFontColor(templateRow.fontColors[merge.startCol - 1]);
    if (templateRow.bold[merge.startCol - 1]) {
      range.setFontWeight('bold');
    }
  });

  sheet.getRange(1, 1, 1, colCount).setHorizontalAlignment('center');
  sheet.getRange(2, 1, 1, colCount).setHorizontalAlignment('center');
  sheet.getRange(4, 1, 1, colCount).setWrap(true);

  sheet.setFrozenRows(STATUS_FROZEN_ROWS);

  STATUS_ROW_GROUPS.forEach(function (group) {
    const numRows = group.endRow - group.startRow + 1;
    sheet.getRange(group.startRow, 1, numRows, colCount).shiftRowGroupDepth(1);
  });

  spreadsheet.setActiveSheet(sheet);
  return sheet;
}

function protectDataSheetEditing_(spreadsheet) {
  spreadsheet.getSheets().forEach(function (sheet) {
    if (sheet.getName() === SHEET_STATUS) return;
    if (sheet.getName() === SHEET_CONFIG) {
      sheet.protect().setDescription('Config — edit with care').setWarningOnly(true);
    }
  });
}
