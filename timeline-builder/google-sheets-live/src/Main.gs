/**
 * Runtime orchestration — REQUIRED for live editing.
 *
 * Forensics: run diagnoseLivePipeline_() then edit STATUS date columns; read View → Executions.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Timeline Planner')
    .addItem('Setup workbook (first time)', 'setupLivePlanner')
    .addItem('Rebuild Timeline structure', 'rebuildTimelineV2Structure_')
    .addSeparator()
    .addItem('Refresh Timeline (legacy)', 'refreshTimeline')
    .addItem('Install edit triggers (legacy)', 'installTriggers_')
    .addItem('Remove all triggers', 'uninstallAllTriggers_')
    .addItem('Diagnose live pipeline', 'diagnoseLivePipeline_')
    .addToUi();
}

/**
 * Re-run Timeline V2 setup after STATUS structure changes (new departments/tasks).
 * Does not run on date edits — those recalculate via formulas.
 */
function rebuildTimelineV2Structure_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (typeof uninstallAllTriggers_ === 'function') {
    uninstallAllTriggers_();
  }
  setupTimelineV2Production_(ss);
  ss.toast('Timeline structure rebuilt from STATUS.', 'Timeline Planner', 4);
}

function refreshTimeline(execType) {
  QA004_TRACE_BUFFER_ = [];
  setRuntimeDiagExecType_(execType || 'Manual');
  appendRuntimeDiag_('ENTRY', 'OK', '');
  Logger.log('REFRESH_TIMELINE: ENTRY');

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log(
    'REFRESH_TIMELINE: activeSpreadsheet=%s',
    ss ? ss.getId() : 'NULL'
  );
  appendRuntimeDiag_('activeSpreadsheet', 'OK', ss ? ss.getId() : 'NULL');

  if (!ss) {
    Logger.log(
      'REFRESH_TIMELINE: EXIT reason=no_active_spreadsheet'
    );
    appendRuntimeDiag_('EXIT', 'FAILURE', 'no_active_spreadsheet');
    return;
  }

  ss.toast('Refreshing timeline…', 'Timeline Planner', 3);

  const config = loadConfig(ss);

  const result = validateDataSheet(ss);
  Logger.log(
    'REFRESH_TIMELINE: validatedTasks=%s',
    result.tasks.length
  );
  appendRuntimeDiag_('validatedTasks', 'OK', result.tasks.length);
  result.report.updatedAt = new Date();

  writeValidationSheet(ss, result.report);

  if (!result.tasks.length) {
    Logger.log('REFRESH_TIMELINE: EXIT reason=no_valid_tasks');
    appendRuntimeDiag_('EXIT', 'FAILURE', 'no_valid_tasks');
    ss.toast('No valid tasks on STATUS tab.', 'Timeline Planner', 5);
    return;
  }

  Logger.log(
    'REFRESH_TIMELINE: before buildTimelineSheet'
  );
  appendRuntimeDiag_('before buildTimelineSheet', 'OK', '');
  buildTimelineSheet(ss, result.tasks, config);
  if (QA004_TRACE_BUFFER_.length) {
    PropertiesService.getScriptProperties().setProperty(
      'QA004_LAST_TRACE',
      JSON.stringify(QA004_TRACE_BUFFER_)
    );
  }
  Logger.log(
    'REFRESH_TIMELINE: after buildTimelineSheet'
  );
  appendRuntimeDiag_('after buildTimelineSheet', 'OK', '');
  result.report.timelineGenerated = true;
  writeValidationSheet(ss, result.report);

  ss.toast(
    'Timeline updated — ' + result.tasks.length + ' tasks, ' + result.report.warningCount + ' warnings',
    'Timeline Planner',
    4
  );
  Logger.log(
    'REFRESH_TIMELINE: EXIT success'
  );
  appendRuntimeDiag_('EXIT', 'SUCCESS', '');
}

function handleDataEdit(e) {
  Logger.log('HANDLE_DATA_EDIT: ENTRY');
  if (!e || !e.range) {
    Logger.log('HANDLE_DATA_EDIT: EXIT reason=no_event_or_range');
    return;
  }

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const row = e.range.getRow();
  const col = e.range.getColumn();
  Logger.log('HANDLE_DATA_EDIT: sheet name=' + sheetName);
  Logger.log('HANDLE_DATA_EDIT: row=' + row);
  Logger.log('HANDLE_DATA_EDIT: column=' + col);

  if (sheetName !== SHEET_DATA) {
    Logger.log('HANDLE_DATA_EDIT: EXIT reason=wrong_sheet expected=' + SHEET_DATA);
    return;
  }

  const startCol = col;
  const endCol = col + e.range.getNumColumns() - 1;
  const passesDateFilter = !(endCol < STATUS_COL_START_DATE || startCol > STATUS_COL_FINISH_DATE);
  Logger.log('HANDLE_DATA_EDIT: date-column filter result=' + passesDateFilter);

  if (!passesDateFilter) {
    Logger.log('HANDLE_DATA_EDIT: EXIT reason=outside_date_columns_H_I');
    return;
  }

  Logger.log('HANDLE_DATA_EDIT: before calling scheduleDebouncedRefresh_');
  PropertiesService.getScriptProperties().setProperty('RUNTIME_DIAG_SS_ID', sheet.getParent().getId());
  scheduleDebouncedRefresh_();
  Logger.log('HANDLE_DATA_EDIT: EXIT');
}

function scheduleDebouncedRefresh_() {
  Logger.log('SCHEDULE_DEBOUNCE: ENTRY');
  const pendingBefore = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === DEBOUNCE_HANDLER;
  }).length;
  Logger.log('SCHEDULE_DEBOUNCE: pending trigger count before removal=' + pendingBefore);

  const removed = uninstallDebounceTriggers_();
  Logger.log('SCHEDULE_DEBOUNCE: pending trigger count removed=' + removed);

  try {
    const trigger = ScriptApp.newTrigger(DEBOUNCE_HANDLER)
      .timeBased()
      .after(DEBOUNCE_MS)
      .create();
    Logger.log('SCHEDULE_DEBOUNCE: new trigger id=' + trigger.getUniqueId());
  } catch (err) {
    Logger.log('SCHEDULE_DEBOUNCE: new trigger failed error=' + err);
    Logger.log('SCHEDULE_DEBOUNCE: fallback calling refreshTimeline');
    refreshTimeline('Automatic');
  }
  Logger.log('SCHEDULE_DEBOUNCE: EXIT');
}

function debouncedRefreshTimeline() {
  Logger.log('DEBOUNCED_REFRESH: ENTRY');
  Logger.log('DEBOUNCED_REFRESH: activeSpreadsheet=' + (SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getActiveSpreadsheet().getId() : 'NULL'));
  uninstallDebounceTriggers_();
  Logger.log('DEBOUNCED_REFRESH: before calling refreshTimeline');
  refreshTimeline('Automatic');
  Logger.log('DEBOUNCED_REFRESH: after refreshTimeline');
  Logger.log('DEBOUNCED_REFRESH: EXIT');
}

function uninstallDebounceTriggers_() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === DEBOUNCE_HANDLER) {
      Logger.log('SCHEDULE_DEBOUNCE: removing clock trigger uniqueId=' + trigger.getUniqueId());
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });
  return removed;
}

function installTriggers_() {
  uninstallDebounceTriggers_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No spreadsheet bound to this script. Open the spreadsheet and run again.');
  }

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    const fn = trigger.getHandlerFunction();
    if (fn === 'handleDataEdit' || fn === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  const editTrigger = ScriptApp.newTrigger('handleDataEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  const hasEditTrigger = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'handleDataEdit';
  });
  if (!hasEditTrigger) {
    throw new Error('Failed to install handleDataEdit onEdit trigger.');
  }

  Logger.log(
    'INSTALL_TRIGGERS: handleDataEdit onEdit installed' +
    ' uniqueId=' + editTrigger.getUniqueId() +
    ' spreadsheetId=' + ss.getId()
  );
  ss.toast('Edit triggers installed — date changes on STATUS refresh the Timeline.', 'Timeline Planner', 4);
}

/**
 * Stage 1 forensics — run from editor or Timeline Planner → Diagnose live pipeline.
 * Read output in View → Executions.
 */
function diagnoseLivePipeline_() {
  Logger.log('DIAGNOSE: ========== LIVE PIPELINE AUDIT ==========');

  Logger.log('DIAGNOSE: functions refreshTimeline=' + typeof refreshTimeline);
  Logger.log('DIAGNOSE: functions handleDataEdit=' + typeof handleDataEdit);
  Logger.log('DIAGNOSE: functions debouncedRefreshTimeline=' + typeof debouncedRefreshTimeline);
  Logger.log('DIAGNOSE: constants DEBOUNCE_HANDLER=' + DEBOUNCE_HANDLER);
  Logger.log('DIAGNOSE: constants DEBOUNCE_MS=' + DEBOUNCE_MS);
  Logger.log('DIAGNOSE: constants SHEET_DATA=' + SHEET_DATA);

  const triggers = ScriptApp.getProjectTriggers();
  Logger.log('DIAGNOSE: installableTriggerCount=' + triggers.length);

  let hasHandleDataEditTrigger = false;
  let pendingClockTriggers = 0;

  triggers.forEach(function (trigger, i) {
    const handler = trigger.getHandlerFunction();
    const eventType = trigger.getEventType();
    const source = trigger.getTriggerSource();
    const uniqueId = trigger.getUniqueId();
    Logger.log(
      'DIAGNOSE: trigger[' + i + ']' +
      ' handler=' + handler +
      ' eventType=' + eventType +
      ' source=' + source +
      ' uniqueId=' + uniqueId
    );
    if (handler === 'handleDataEdit' && eventType === ScriptApp.EventType.ON_EDIT) {
      hasHandleDataEditTrigger = true;
    }
    if (handler === DEBOUNCE_HANDLER && eventType === ScriptApp.EventType.CLOCK) {
      pendingClockTriggers += 1;
    }
  });

  Logger.log('DIAGNOSE: hasHandleDataEditTrigger=' + hasHandleDataEditTrigger);
  Logger.log('DIAGNOSE: pendingClockTriggers handler=' + DEBOUNCE_HANDLER + ' count=' + pendingClockTriggers);

  if (!hasHandleDataEditTrigger) {
    Logger.log('DIAGNOSE: STOP — no handleDataEdit onEdit trigger. Run installTriggers_ or setupLivePlanner.');
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('DIAGNOSE: activeSpreadsheet=' + (active ? active.getId() + ' name=' + active.getName() : 'NULL'));

  const props = PropertiesService.getScriptProperties().getProperties();
  const propKeys = Object.keys(props);
  Logger.log('DIAGNOSE: scriptPropertyCount=' + propKeys.length);
  if (!propKeys.length) {
    Logger.log('DIAGNOSE: scriptProperties=NONE');
  }
  propKeys.forEach(function (key) {
    Logger.log('DIAGNOSE: scriptProperty ' + key + '=' + props[key]);
  });

  Logger.log('DIAGNOSE: nextStep=edit STATUS Project Timeline or Live Dates then inspect Executions for HANDLE_DATA_EDIT');
  Logger.log('DIAGNOSE: ========== END AUDIT ==========');

  if (active) {
    active.toast(
      'Diagnose complete — hasHandleDataEditTrigger=' + hasHandleDataEditTrigger +
      '. See Apps Script → Executions.',
      'Timeline Planner',
      8
    );
  }
}

function qa004LiveRefresh_() {
  QA004_TRACE_BUFFER_ = [];
  const spreadsheetId = '1PKrGas_0owMrjVKJTD725JpuKibn7K4emeLCJIcHU90';
  PropertiesService.getScriptProperties().setProperty('RUNTIME_DIAG_SS_ID', spreadsheetId);
  setRuntimeDiagExecType_('QA004');
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const status = ss.getSheetByName(SHEET_DATA);
  status.getRange(QA004_SOURCE_ROW, STATUS_COL_FINISH_DATE).setValue(new Date('2026-06-24'));
  SpreadsheetApp.flush();
  const config = loadConfig(ss);
  const result = validateDataSheet(ss);
  result.report.updatedAt = new Date();
  writeValidationSheet(ss, result.report);
  if (!result.tasks.length) {
    appendRuntimeDiag_('QA004-EXIT', 'FAILURE', 'no_valid_tasks');
    return QA004_TRACE_BUFFER_;
  }
  buildTimelineSheet(ss, result.tasks, config);
  result.report.timelineGenerated = true;
  writeValidationSheet(ss, result.report);
  appendRuntimeDiag_('QA004-EXIT', 'SUCCESS', '');
  PropertiesService.getScriptProperties().setProperty(
    'QA004_LAST_TRACE',
    JSON.stringify(QA004_TRACE_BUFFER_)
  );
  return QA004_TRACE_BUFFER_;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.run === '1') {
    qa004LiveRefresh_();
  }
  const stored = PropertiesService.getScriptProperties().getProperty('QA004_LAST_TRACE');
  return ContentService.createTextOutput(stored || '[]')
    .setMimeType(ContentService.MimeType.JSON);
}

function uninstallAllTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
}
