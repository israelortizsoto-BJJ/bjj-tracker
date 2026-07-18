/**
 * Runtime orchestration - formula timeline setup and compatibility helpers.
 *
 * Formula Timeline is live after setup; no onEdit trigger is required for scheduling changes.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Timeline Planner')
    .addItem('Setup Master Schedule timeline', 'setupLivePlanner')
    .addItem('Rebuild formula Timeline', 'rebuildTimelineV2Structure_')
    .addSeparator()
    .addItem('Validate Master Schedule', 'validateMasterSchedule_')
    .addItem('Remove legacy triggers', 'uninstallAllTriggers_')
    .addToUi();
}

/**
 * Re-run Timeline V2 setup after formula/layout changes.
 * Does not run on Master Schedule edits - those recalculate via formulas.
 */
function rebuildTimelineV2Structure_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (typeof uninstallAllTriggers_ === 'function') {
    uninstallAllTriggers_();
  }
  setupTimelineV2Production_(ss);
  ss.toast('Formula Timeline rebuilt from Master Schedule.', 'Timeline Planner', 4);
}

function refreshTimeline(execType) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setRuntimeDiagExecType_(execType || 'Manual');
  appendRuntimeDiag_('REFRESH_TIMELINE_DEPRECATED', 'OK', 'Formula rebuild only');
  ensureMasterScheduleV1Columns_(ss);
  setupTimelineV2Production_(ss);
  const result = validateDataSheet(ss);
  result.report.updatedAt = new Date();
  result.report.timelineGenerated = true;
  writeValidationSheet(ss, result.report);
  ss.toast(
    'Formula Timeline rebuilt - future Master Schedule edits recalculate automatically.',
    'Timeline Planner',
    4
  );
}

function handleDataEdit(e) {
  Logger.log('HANDLE_DATA_EDIT: no-op; Timeline is formula-driven from Master Schedule.');
}

function scheduleDebouncedRefresh_() {
  Logger.log('SCHEDULE_DEBOUNCE: no-op; Timeline is formula-driven from Master Schedule.');
}

function debouncedRefreshTimeline() {
  Logger.log('DEBOUNCED_REFRESH: no-op; Timeline is formula-driven from Master Schedule.');
  uninstallDebounceTriggers_();
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
  uninstallAllTriggers_();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'No edit triggers installed - Timeline updates through formulas.',
    'Timeline Planner',
    4
  );
}

/**
 * Legacy diagnostic helper.
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

  if (hasHandleDataEditTrigger || pendingClockTriggers) {
    Logger.log('DIAGNOSE: legacy triggers present; run uninstallAllTriggers_.');
  } else {
    Logger.log('DIAGNOSE: OK - no edit/clock triggers required for formula Timeline.');
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

  Logger.log('DIAGNOSE: nextStep=edit Master Schedule dates/includes and confirm Timeline recalculates without execution.');
  Logger.log('DIAGNOSE: ========== END AUDIT ==========');

  if (active) {
    active.toast(
      'Diagnose complete - hasHandleDataEditTrigger=' + hasHandleDataEditTrigger +
      '. See Apps Script > Executions.',
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
  ensureMasterScheduleV1Columns_(ss);
  setupTimelineV2Production_(ss);
  SpreadsheetApp.flush();
  const result = validateDataSheet(ss);
  result.report.updatedAt = new Date();
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
