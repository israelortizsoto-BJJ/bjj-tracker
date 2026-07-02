/**
 * Validate STATUS sheet rows and extract timeline tasks.
 */

function statusRowValues_(row, department) {
  return {
    Project: department || '',
    'Task Name': normalizeText(row[STATUS_COL_PROJECT - 1]),
    'Start Date': formatIsoDate(parseCellDate(row[STATUS_COL_START_DATE - 1])),
    'Finish Date': formatIsoDate(parseCellDate(row[STATUS_COL_FINISH_DATE - 1])),
    'Critical Date': '',
  };
}

function normalizeDepartmentLabel_(label) {
  return String(label).replace(/:$/, '').trim();
}

function isStatusDepartmentHeaderRow_(row) {
  const label = normalizeText(row[STATUS_COL_IUS_POC - 1]);
  if (!label) {
    return false;
  }
  if (/^HOT ITEMS:?$/i.test(label)) {
    return true;
  }
  const projectCell = normalizeText(row[STATUS_COL_PROJECT - 1]);
  return !projectCell;
}

function isStatusInstructionRow_(row) {
  const poc = normalizeText(row[STATUS_COL_IUS_POC - 1]);
  const project = normalizeText(row[STATUS_COL_PROJECT - 1]);
  if (poc && poc.indexOf('[DROPDOWN]') === 0) {
    return true;
  }
  if (project && project.indexOf('[PROJECT NAME]') === 0) {
    return true;
  }
  return false;
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

  if (!sheet || sheet.getLastRow() < STATUS_FIRST_DATA_ROW) {
    return { tasks: tasks, report: report };
  }

  const lastRow = sheet.getLastRow();
  const numRows = lastRow - STATUS_FIRST_DATA_ROW + 1;
  const values = sheet.getRange(STATUS_FIRST_DATA_ROW, 1, numRows, STATUS_COLUMN_COUNT).getValues();
  report.totalRows = values.length;

  let currentDepartment = null;

  values.forEach(function (row, index) {
    const rowNumber = index + STATUS_FIRST_DATA_ROW;

    if (isStatusInstructionRow_(row)) {
      return;
    }

    if (isStatusDepartmentHeaderRow_(row)) {
      currentDepartment = normalizeDepartmentLabel_(row[STATUS_COL_IUS_POC - 1]);
      return;
    }

    const taskName = normalizeText(row[STATUS_COL_PROJECT - 1]);
    if (!taskName) {
      return;
    }

    const hasStart = !isBlankText(row[STATUS_COL_START_DATE - 1]);
    const hasFinish = !isBlankText(row[STATUS_COL_FINISH_DATE - 1]);
    if (!hasStart && !hasFinish) {
      return;
    }

    const valuesSnapshot = statusRowValues_(row, currentDepartment);
    const project = currentDepartment || taskName;

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

    let startDate = parseCellDate(row[STATUS_COL_START_DATE - 1]);
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
      qa004Log_(1, row[STATUS_COL_FINISH_DATE - 1]);
    }

    let finishDate = parseCellDate(row[STATUS_COL_FINISH_DATE - 1]);
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
      project: project,
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
