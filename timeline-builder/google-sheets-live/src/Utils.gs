/**
 * Date and formatting helpers.
 */

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseCellDate(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return normalizeDate(value);
  }
  if (typeof value === 'number') {
    // Sheets serial date
    const d = normalizeDate(new Date(Math.round((value - 25569) * 86400 * 1000)));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' && value.trim()) {
    const d = normalizeDate(new Date(value.trim()));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatIsoDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function weekStart(date) {
  const d = normalizeDate(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekEnd(weekStartDate) {
  const d = new Date(weekStartDate);
  d.setDate(d.getDate() + 6);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function monthLabel(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMMM yyyy');
}

function shortDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM dd');
}

function hexBackground(hex) {
  if (!hex) return null;
  const cleaned = String(hex).replace('#', '').toUpperCase();
  return '#' + cleaned.substring(cleaned.length - 6);
}

function isBlankText(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  return false;
}

function normalizeText(value) {
  if (isBlankText(value)) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'nan') return null;
  return text;
}

/**
 * Pad or trim each row so a 2D array matches numCols before setValues / setBackgrounds etc.
 */
function normalizeGrid2D_(grid, numCols, defaultCell) {
  if (!grid || !grid.length) {
    throw new Error('normalizeGrid2D_: empty grid');
  }
  const fill = defaultCell !== undefined ? defaultCell : '';
  return grid.map(function (row) {
    const source = row || [];
    const out = source.slice(0, numCols);
    while (out.length < numCols) {
      out.push(fill);
    }
    return out;
  });
}

/** Temporary forensic helper — remove after live-refresh investigation. */
var RUNTIME_DIAG_EXEC_TYPE_ = 'Manual';

function setRuntimeDiagExecType_(execType) {
  RUNTIME_DIAG_EXEC_TYPE_ = execType || 'Manual';
}

function runtimeDiagSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    PropertiesService.getScriptProperties().setProperty('RUNTIME_DIAG_SS_ID', active.getId());
    return active;
  }
  const id = PropertiesService.getScriptProperties().getProperty('RUNTIME_DIAG_SS_ID');
  return id ? SpreadsheetApp.openById(id) : null;
}

function ensureRuntimeDiagnosticsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_RUNTIME_DIAGNOSTICS);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_RUNTIME_DIAGNOSTICS);
    sheet.getRange(1, 1, 1, 5).setValues([[
      'Timestamp', 'Execution Type', 'Checkpoint', 'Status', 'Details',
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendRuntimeDiag_(checkpoint, status, details) {
  try {
    const ss = runtimeDiagSpreadsheet_();
    if (!ss) {
      return;
    }
    ensureRuntimeDiagnosticsSheet_(ss).appendRow([
      new Date(),
      RUNTIME_DIAG_EXEC_TYPE_ || 'Manual',
      checkpoint,
      status,
      details !== undefined && details !== null ? String(details) : '',
    ]);
  } catch (err) {
    Logger.log('RUNTIME_DIAG: append failed ' + err);
  }
}
