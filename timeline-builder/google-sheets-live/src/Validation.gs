/**
 * Validate Master Schedule rows and extract timeline tasks.
 */

function masterRowValues_(row) {
  return {
    'Phase / Task': normalizeText(row[MASTER_COL_PHASE_TASK - 1]),
    Duration: normalizeText(row[MASTER_COL_DURATION - 1]),
    'Start Date': formatIsoDate(parseCellDate(row[MASTER_COL_START_DATE - 1])),
    'Finish Date': formatIsoDate(parseCellDate(row[MASTER_COL_FINISH_DATE - 1])),
    'Include in Timeline': row[MASTER_COL_INCLUDE - 1],
    'Client Label': normalizeText(row[MASTER_COL_CLIENT_LABEL - 1]),
  };
}

function createEmptyReport_() {
  return {
    schemaVersion: '1.0',
    sourceSheet: SHEET_DATA,
    totalRows: 0,
    validRows: 0,
    skippedRows: 0,
    warningCount: 0,
    errorCount: 0,
    timelineGenerated: false,
    updatedAt: new Date(),
    issues: [],
  };
}

function validateDataSheet(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SHEET_DATA);
  const report = createEmptyReport_();
  const tasks = [];

  if (!sheet || sheet.getLastRow() < MASTER_FIRST_DATA_ROW) {
    return { tasks: tasks, report: report };
  }

  const lastRow = sheet.getLastRow();
  const numRows = Math.min(lastRow, MASTER_LAST_SETUP_ROW) - MASTER_FIRST_DATA_ROW + 1;
  const values = sheet.getRange(MASTER_FIRST_DATA_ROW, 1, numRows, MASTER_COLUMN_COUNT).getValues();
  report.totalRows = values.length;

  values.forEach(function (row, index) {
    const rowNumber = index + MASTER_FIRST_DATA_ROW;
    const taskName = normalizeText(row[MASTER_COL_PHASE_TASK - 1]);
    const include = row[MASTER_COL_INCLUDE - 1];

    if (!taskName) {
      return;
    }

    if (include === false) {
      return;
    }

    const hasStart = !isBlankText(row[MASTER_COL_START_DATE - 1]);
    const hasFinish = !isBlankText(row[MASTER_COL_FINISH_DATE - 1]);
    if (!hasStart && !hasFinish) {
      return;
    }

    const valuesSnapshot = masterRowValues_(row);

    if (!hasStart) {
      report.issues.push({
        rowNumber: rowNumber,
        kind: 'error',
        reason: 'missing_start_date',
        values: valuesSnapshot,
      });
      report.errorCount += 1;
      return;
    }
    if (!hasFinish) {
      report.issues.push({
        rowNumber: rowNumber,
        kind: 'error',
        reason: 'missing_finish_date',
        values: valuesSnapshot,
      });
      report.errorCount += 1;
      return;
    }

    let startDate = parseCellDate(row[MASTER_COL_START_DATE - 1]);
    if (!startDate) {
      report.issues.push({
        rowNumber: rowNumber,
        kind: 'error',
        reason: 'invalid_start_date',
        values: valuesSnapshot,
      });
      report.errorCount += 1;
      return;
    }

    if (rowNumber === QA004_SOURCE_ROW && taskName === QA004_TASK_NAME) {
      qa004Log_(1, row[MASTER_COL_FINISH_DATE - 1]);
    }

    let finishDate = parseCellDate(row[MASTER_COL_FINISH_DATE - 1]);
    if (rowNumber === QA004_SOURCE_ROW && taskName === QA004_TASK_NAME) {
      qa004Log_(2, finishDate);
    }
    if (!finishDate) {
      report.issues.push({
        rowNumber: rowNumber,
        kind: 'error',
        reason: 'invalid_finish_date',
        values: valuesSnapshot,
      });
      report.errorCount += 1;
      return;
    }

    if (finishDate < startDate) {
      report.issues.push({
        rowNumber: rowNumber,
        kind: 'warning',
        reason: 'finish_before_start',
        values: valuesSnapshot,
      });
      report.warningCount += 1;
      const tmp = startDate;
      startDate = finishDate;
      finishDate = tmp;
    }

    tasks.push({
      project: taskName,
      taskName: taskName,
      startDate: startDate,
      finishDate: finishDate,
      criticalDate: null,
      sourceRow: rowNumber,
    });
  });

  report.skippedRows = report.errorCount;
  report.validRows = tasks.length;
  return { tasks: tasks, report: report };
}

function writeValidationSheet(spreadsheet, report) {
  let sheet = spreadsheet.getSheetByName(SHEET_VALIDATION);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_VALIDATION);
  }
  sheet.clear();

  const COLS = 8;
  const summary = [
    ['Validation Summary', ''],
    ['Updated At', report.updatedAt || new Date()],
    ['Source Sheet', report.sourceSheet || SHEET_DATA],
    ['Total Rows', report.totalRows],
    ['Valid Rows', report.validRows],
    ['Skipped Rows', report.skippedRows],
    ['Warnings', report.warningCount],
    ['Errors', report.errorCount],
    ['Timeline Generated', report.timelineGenerated ? 'Yes' : 'No'],
    [''],
    ['Row Number', 'Kind', 'Reason', 'Phase / Task', 'Duration', 'Start Date', 'Finish Date', 'Client Label'],
  ];

  report.issues.forEach(function (issue) {
    summary.push([
      issue.rowNumber,
      issue.kind,
      issue.reason,
      issue.values['Phase / Task'] || '',
      issue.values.Duration || '',
      issue.values['Start Date'] || '',
      issue.values['Finish Date'] || '',
      issue.values['Client Label'] || '',
    ]);
  });

  const normalized = normalizeGrid2D_(summary, COLS, '');
  sheet.getRange(1, 1, normalized.length, COLS).setValues(normalized);
  sheet.getRange(2, 2).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.setFrozenRows(11);
}

function validateMasterSchedule_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = validateDataSheet(ss);
  result.report.updatedAt = new Date();
  writeValidationSheet(ss, result.report);
  ss.toast(
    'Master Schedule validated - ' + result.report.warningCount + ' warnings, ' +
      result.report.errorCount + ' errors.',
    'Timeline Planner',
    5
  );
}
