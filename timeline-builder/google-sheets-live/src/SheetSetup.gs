/**
 * Initial workbook setup and sample data.
 */

function assertOrchestrationPresent_() {
  if (typeof refreshTimeline !== 'function') {
    throw new Error(
      'Missing refreshTimeline — copy Main.gs into this Apps Script project. ' +
      'Main.gs contains the live refresh pipeline (validate → Timeline → Validation).'
    );
  }
  if (typeof handleDataEdit !== 'function' || typeof installTriggers_ !== 'function') {
    throw new Error('Missing edit trigger handlers — copy Main.gs into this Apps Script project.');
  }
}

function setupLivePlanner() {
  assertOrchestrationPresent_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let dataSheet = ss.getSheetByName(SHEET_DATA);
  if (!dataSheet) {
    dataSheet = ss.insertSheet(SHEET_DATA, 0);
  }
  dataSheet.clear();
  dataSheet.getRange(1, 1, 1, DATA_HEADERS.length).setValues([DATA_HEADERS]);
  dataSheet.setFrozenRows(1);

  const sampleRows = [
    ['Brand Campaign Q1', 'Concepting', new Date('2026-01-06'), new Date('2026-01-17'), ''],
    ['Brand Campaign Q1', 'Pre Pro / Prep', new Date('2026-01-20'), new Date('2026-01-31'), ''],
    ['Brand Campaign Q1', 'Shoot', new Date('2026-02-03'), new Date('2026-02-07'), ''],
    ['Brand Campaign Q1', 'Edit / Post', new Date('2026-02-10'), new Date('2026-03-07'), ''],
    ['Brand Campaign Q1', 'Client Review', new Date('2026-03-10'), new Date('2026-03-14'), new Date('2026-03-14')],
    ['Brand Campaign Q1', 'Delivery', new Date('2026-03-17'), new Date('2026-03-21'), new Date('2026-03-21')],
    ['Product Launch Video', 'Concepting', new Date('2026-02-03'), new Date('2026-02-14'), ''],
    ['Product Launch Video', 'Shoot', new Date('2026-03-03'), new Date('2026-03-07'), ''],
    ['Product Launch Video', 'VFX / Color', new Date('2026-03-10'), new Date('2026-04-04'), ''],
    ['Product Launch Video', 'Air / Live', new Date('2026-04-14'), new Date('2026-04-18'), new Date('2026-04-18')],
  ];
  const normalizedSample = normalizeGrid2D_(sampleRows, DATA_HEADERS.length, '');
  dataSheet.getRange(2, 1, normalizedSample.length, DATA_HEADERS.length).setValues(normalizedSample);
  dataSheet.getRange(2, 3, sampleRows.length, 3).setNumberFormat('yyyy-mm-dd');

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

  installTriggers_();
  refreshTimeline();

  SpreadsheetApp.getActiveSpreadsheet().toast('Live planner ready. Edit dates on Data tab.', 'Setup', 5);
}

function protectDataSheetEditing_(spreadsheet) {
  spreadsheet.getSheets().forEach(function (sheet) {
    if (sheet.getName() === SHEET_DATA) return;
    if (sheet.getName() === SHEET_CONFIG) {
      sheet.protect().setDescription('Config — edit with care').setWarningOnly(true);
    }
  });
}
