/**
 * Build executive Timeline sheet from validated tasks.
 */

function groupTasksByProject_(tasks) {
  if (!tasks.length) return [];
  const blocks = [];
  let currentProject = tasks[0].project;
  let currentTasks = [tasks[0]];
  for (let i = 1; i < tasks.length; i++) {
    if (tasks[i].project === currentProject) {
      currentTasks.push(tasks[i]);
    } else {
      blocks.push({ project: currentProject, tasks: currentTasks });
      currentProject = tasks[i].project;
      currentTasks = [tasks[i]];
    }
  }
  blocks.push({ project: currentProject, tasks: currentTasks });
  return blocks;
}

function timelineBounds_(tasks) {
  let earliest = tasks[0].startDate;
  let latest = tasks[0].finishDate;
  tasks.forEach(function (task) {
    if (task.startDate < earliest) earliest = task.startDate;
    if (task.finishDate > latest) latest = task.finishDate;
    if (task.criticalDate) {
      if (task.criticalDate < earliest) earliest = task.criticalDate;
      if (task.criticalDate > latest) latest = task.criticalDate;
    }
  });
  return { earliest: earliest, latest: latest };
}

function buildWeekColumns_(tasks) {
  const bounds = timelineBounds_(tasks);
  let cursor = weekStart(bounds.earliest);
  const lastWeek = weekStart(bounds.latest);
  const weeks = [];
  while (cursor.getTime() <= lastWeek.getTime()) {
    weeks.push({
      index: weeks.length,
      start: new Date(cursor),
      end: weekEnd(cursor),
      monthKey: cursor.getFullYear() + '-' + (cursor.getMonth() + 1),
    });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function weeksForRange_(start, finish, weeks) {
  const active = [];
  weeks.forEach(function (week) {
    if (week.end < start || week.start > finish) return;
    active.push(week.index);
  });
  return active;
}

function criticalWeekIndex_(task, weeks) {
  if (!task.criticalDate) return null;
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    if (task.criticalDate >= week.start && task.criticalDate <= week.end) {
      return week.index;
    }
  }
  return null;
}

function buildMonthSpans_(weeks) {
  if (!weeks.length) return [];
  const spans = [];
  let spanStart = 0;
  let currentKey = weeks[0].monthKey;
  for (let offset = 1; offset < weeks.length; offset++) {
    if (weeks[offset].monthKey !== currentKey) {
      spans.push({
        start: spanStart,
        end: offset - 1,
        label: monthLabel(weeks[spanStart].start),
      });
      spanStart = offset;
      currentKey = weeks[offset].monthKey;
    }
  }
  spans.push({
    start: spanStart,
    end: weeks.length - 1,
    label: monthLabel(weeks[spanStart].start),
  });
  return spans;
}

function newGridRow_(totalCols, fill, font, bold) {
  return {
    cells: new Array(totalCols).fill(''),
    bg: new Array(totalCols).fill(fill),
    fg: new Array(totalCols).fill(font),
    wt: new Array(totalCols).fill(bold ? 'bold' : 'normal'),
  };
}

function buildTimelineSheet(spreadsheet, tasks, config) {
  Logger.log(
    'BUILD_TIMELINE: ENTRY spreadsheet=%s taskCount=%s',
    spreadsheet ? spreadsheet.getId() : 'NULL',
    tasks.length
  );
  let sheet = spreadsheet.getSheetByName(SHEET_TIMELINE);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_TIMELINE);
  }

  const theme = config.theme;
  const weeks = buildWeekColumns_(tasks);
  const grouped = groupTasksByProject_(tasks);
  const totalCols = INFO_COLUMN_COUNT + weeks.length;
  const monthSpans = buildMonthSpans_(weeks);

  const values = [];
  const backgrounds = [];
  const fontColors = [];
  const fontWeights = [];
  const rowGroups = [];

  function appendRow(row) {
    values.push(row.cells);
    backgrounds.push(row.bg);
    fontColors.push(row.fg);
    fontWeights.push(row.wt);
  }

  // Row 1 — month headers
  (function () {
    const row = newGridRow_(totalCols, theme.monthHeaderFill, theme.monthHeaderFont, true);
    monthSpans.forEach(function (span) {
      const colIndex = FIRST_WEEK_COLUMN - 1 + span.start;
      row.cells[colIndex] = span.label;
    });
    appendRow(row);
  })();

  // Row 2 — week date ranges
  (function () {
    const row = newGridRow_(totalCols, theme.weekHeaderFill, theme.weekHeaderFont, true);
    weeks.forEach(function (week, offset) {
      const colIndex = FIRST_WEEK_COLUMN - 1 + offset;
      row.cells[colIndex] = shortDate(week.start) + '\n' + shortDate(week.end);
    });
    appendRow(row);
  })();

  // Row 3 — column headers
  (function () {
    const row = newGridRow_(totalCols, theme.headerFill, theme.headerFont, true);
    for (let i = 0; i < DATA_HEADERS.length; i++) {
      row.cells[i] = DATA_HEADERS[i];
    }
    weeks.forEach(function (_week, offset) {
      row.cells[FIRST_WEEK_COLUMN - 1 + offset] = 'W' + (offset + 1);
    });
    appendRow(row);
  })();

  // Project blocks and tasks
  let altToggle = false;
  grouped.forEach(function (block) {
    const projectRow = newGridRow_(totalCols, theme.projectHeaderFill, theme.projectHeaderFont, true);
    projectRow.cells[0] = block.project;
    appendRow(projectRow);

    const taskStartRow = values.length + 1;
    block.tasks.forEach(function (task) {
      altToggle = !altToggle;
      const rowFill = altToggle ? theme.altRowFill : '#FFFFFF';
      const style = taskStyle(task.taskName, config.categories, theme);
      const activeWeeks = weeksForRange_(task.startDate, task.finishDate, weeks);
      const criticalIndex = criticalWeekIndex_(task, weeks);
      let renderWeeks = activeWeeks.slice();
      if (criticalIndex !== null && renderWeeks.indexOf(criticalIndex) === -1) {
        renderWeeks.push(criticalIndex);
        renderWeeks.sort(function (a, b) { return a - b; });
      }
      const labelWeek = activeWeeks.length ? activeWeeks[0] : criticalIndex;

      const row = newGridRow_(totalCols, rowFill, '#404040', false);
      row.cells[1] = task.taskName;
      row.cells[2] = task.startDate;
      row.cells[3] = task.finishDate;
      row.cells[4] = task.criticalDate || '';
      if (task.criticalDate) {
        row.fg[4] = theme.criticalFill;
        row.wt[4] = 'bold';
      }

      renderWeeks.forEach(function (offset) {
        const colIndex = FIRST_WEEK_COLUMN - 1 + offset;
        const isCritical = criticalIndex !== null && offset === criticalIndex;
        const isDuration = activeWeeks.indexOf(offset) !== -1;
        let cellStyle = style;
        if (isCritical) {
          cellStyle = { fill: theme.criticalFill, font: theme.criticalFont };
        } else if (!isDuration) {
          cellStyle = { fill: theme.criticalFill, font: theme.criticalFont };
        }
        row.bg[colIndex] = cellStyle.fill;
        row.fg[colIndex] = cellStyle.font;
        if (labelWeek !== null && offset === labelWeek) {
          row.cells[colIndex] = task.taskName;
          row.wt[colIndex] = 'bold';
        }
      });

      appendRow(row);
    });

    const taskEndRow = values.length;
    if (taskEndRow >= taskStartRow) {
      rowGroups.push({ start: taskStartRow, end: taskEndRow });
    }
  });

  sheet.clear();
  if (!values.length || !totalCols) {
    Logger.log('BUILD_TIMELINE: EXIT reason=empty_grid');
    protectTimelineSheet_(sheet);
    return;
  }

  const normalizedValues = normalizeGrid2D_(values, totalCols, '');
  const normalizedBackgrounds = normalizeGrid2D_(backgrounds, totalCols, '#FFFFFF');
  const normalizedFontColors = normalizeGrid2D_(fontColors, totalCols, '#000000');
  const normalizedFontWeights = normalizeGrid2D_(fontWeights, totalCols, 'normal');

  const range = sheet.getRange(1, 1, normalizedValues.length, totalCols);
  Logger.log('BUILD_TIMELINE: before write');
  range.setValues(normalizedValues);
  range.setBackgrounds(normalizedBackgrounds);
  range.setFontColors(normalizedFontColors);
  range.setFontWeights(normalizedFontWeights);
  Logger.log('BUILD_TIMELINE: after write');

  if (normalizedValues.length >= DATA_START_ROW) {
    const dateRows = normalizedValues.length - DATA_START_ROW + 1;
    sheet.getRange(DATA_START_ROW, 3, dateRows, 3).setNumberFormat('mmm d, yyyy');
  }

  monthSpans.forEach(function (span) {
    const startCol = FIRST_WEEK_COLUMN + span.start;
    const endCol = FIRST_WEEK_COLUMN + span.end;
    if (endCol > startCol) {
      sheet.getRange(1, startCol, 1, endCol - startCol + 1).merge();
    }
  });

  sheet.setFrozenRows(HEADER_ROWS);
  sheet.setFrozenColumns(INFO_COLUMN_COUNT);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 100);
  for (let c = FIRST_WEEK_COLUMN; c <= totalCols; c++) {
    sheet.setColumnWidth(c, 80);
  }

  rowGroups.forEach(function (group) {
    sheet.getRange(group.start, 1, group.end - group.start + 1, totalCols).shiftRowGroupDepth(1);
  });

  protectTimelineSheet_(sheet);
  Logger.log('BUILD_TIMELINE: COMPLETE');
}

function protectTimelineSheet_(sheet) {
  sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
    p.remove();
  });
  sheet.protect().setDescription('Timeline presentation — edit Data tab, then Refresh Timeline').setWarningOnly(true);
}
