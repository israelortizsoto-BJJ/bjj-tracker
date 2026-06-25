/**
 * Validate Data sheet rows (ported from validation.py — MVP subset).
 */

function rowValues_(row) {
  return {
    Project: normalizeText(row[0]),
    'Task Name': normalizeText(row[1]),
    'Start Date': formatIsoDate(parseCellDate(row[2])),
    'Finish Date': formatIsoDate(parseCellDate(row[3])),
    'Critical Date': formatIsoDate(parseCellDate(row[4])),
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

  if (!sheet || sheet.getLastRow() < 2) {
    return { tasks: tasks, report: report };
  }

  const lastRow = sheet.getLastRow();
  const numDataRows = lastRow - 1;
  const values = sheet.getRange(2, 1, numDataRows, DATA_HEADERS.length).getValues();
  report.totalRows = values.length;

  values.forEach(function (row, index) {
    const rowNumber = index + 2;
    const valuesSnapshot = rowValues_(row);

    const project = normalizeText(row[0]);
    if (!project) {
      report.issues.push({ rowNumber: rowNumber, kind: 'error', reason: 'missing_project', values: valuesSnapshot });
      report.errorCount += 1;
      return;
    }

    const taskName = normalizeText(row[1]);
    if (!taskName) {
      report.issues.push({ rowNumber: rowNumber, kind: 'error', reason: 'missing_task_name', values: valuesSnapshot });
      report.errorCount += 1;
      return;
    }

    if (isBlankText(row[2])) {
      report.issues.push({ rowNumber: rowNumber, kind: 'error', reason: 'missing_start_date', values: valuesSnapshot });
      report.errorCount += 1;
      return;
    }
    if (isBlankText(row[3])) {
      report.issues.push({ rowNumber: rowNumber, kind: 'error', reason: 'missing_finish_date', values: valuesSnapshot });
      report.errorCount += 1;
      return;
    }

    let startDate = parseCellDate(row[2]);
    if (!startDate) {
      report.issues.push({ rowNumber: rowNumber, kind: 'error', reason: 'invalid_start_date', values: valuesSnapshot });
      report.errorCount += 1;
      return;
    }

    let finishDate = parseCellDate(row[3]);
    if (!finishDate) {
      report.issues.push({ rowNumber: rowNumber, kind: 'error', reason: 'invalid_finish_date', values: valuesSnapshot });
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

    let criticalDate = null;
    if (!isBlankText(row[4])) {
      criticalDate = parseCellDate(row[4]);
      if (!criticalDate) {
        report.issues.push({ rowNumber: rowNumber, kind: 'warning', reason: 'invalid_critical_date', values: valuesSnapshot });
        report.warningCount += 1;
      }
    }

    tasks.push({
      project: project,
      taskName: taskName,
      startDate: startDate,
      finishDate: finishDate,
      criticalDate: criticalDate,
      sourceRow: rowNumber,
    });
  });

  report.skippedRows = report.errorCount;
  report.validRows = report.totalRows - report.skippedRows;
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
    ['Row Number', 'Kind', 'Reason', 'Project', 'Task Name', 'Start Date', 'Finish Date', 'Critical Date'],
  ];

  report.issues.forEach(function (issue) {
    summary.push([
      issue.rowNumber,
      issue.kind,
      issue.reason,
      issue.values.Project || '',
      issue.values['Task Name'] || '',
      issue.values['Start Date'] || '',
      issue.values['Finish Date'] || '',
      issue.values['Critical Date'] || '',
    ]);
  });

  const normalized = normalizeGrid2D_(summary, COLS, '');
  sheet.getRange(1, 1, normalized.length, COLS).setValues(normalized);
  sheet.getRange(2, 2).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.setFrozenRows(11);
}
