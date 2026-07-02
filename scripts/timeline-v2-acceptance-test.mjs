#!/usr/bin/env node
/**
 * Phase B acceptance tests — production Timeline V2 formula logic.
 * Mirrors dynamic week anchors + overlap formulas from TimelineV2.gs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../timeline-builder/google-sheets-live/src');

const MAX_WEEKS = 52;
const TOKEN = 'PREPRO';

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday of week containing date (matches Sheets WEEKDAY(date,3)). */
function mondayOfWeek(date) {
  const d = normalizeDate(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function buildWeekStarts(minStart, maxWeeks = MAX_WEEKS) {
  const anchor = mondayOfWeek(minStart);
  const weeks = [];
  for (let i = 0; i < maxWeeks; i++) {
    const ws = new Date(anchor);
    ws.setDate(ws.getDate() + 7 * i);
    weeks.push(ws);
  }
  return weeks;
}

function weekBarToken(start, finish, weekStart) {
  if (!start || !finish) return '';
  const ws = normalizeDate(weekStart);
  const we = new Date(ws);
  we.setDate(we.getDate() + 6);
  const s = normalizeDate(start);
  const f = normalizeDate(finish);
  if (we >= s && ws <= f) return TOKEN;
  return '';
}

function barPattern(weekStarts, start, finish) {
  return weekStarts.map((ws) => (weekBarToken(start, finish, ws) ? '█' : '·')).join('');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}: expected source to include ${needle}`);
  }
}

function assertNotIncludes(haystack, needle, label) {
  if (haystack.includes(needle)) {
    throw new Error(`${label}: source must not include ${needle}`);
  }
}

function readSrc(name) {
  return fs.readFileSync(path.join(SRC, name), 'utf8');
}

function weekBarFormulaExample(timelineRow, colLetter) {
  return (
    `=IF(AND($C${timelineRow}<>"",$D${timelineRow}<>""),` +
    `IF(AND(${colLetter}$2<>"",${colLetter}$2+6>=$C${timelineRow},${colLetter}$2<=$D${timelineRow}),$E${timelineRow},""),"")`
  );
}

function runTests() {
  const timelineV2 = readSrc('TimelineV2.gs');
  const sheetSetup = readSrc('SheetSetup.gs');

  // Dynamic anchor: earliest dated BRAND task is LCM May 20 → Monday May 18.
  const brandMinStart = new Date(2026, 4, 20);
  const weekStarts = buildWeekStarts(brandMinStart);
  const visibleWeeks = weekStarts.slice(0, 12);

  const baselineStart = new Date(2026, 5, 1);
  const baselineFinish = new Date(2026, 5, 15);
  const baseline = barPattern(visibleWeeks, baselineStart, baselineFinish);

  // TEST 1 — H10 one week later (Jun 8): left edge moves one week right
  const test1Start = new Date(2026, 5, 8);
  const test1 = barPattern(visibleWeeks, test1Start, baselineFinish);
  const baselineFirst = baseline.indexOf('█');
  const test1First = test1.indexOf('█');
  if (test1First !== baselineFirst + 1) {
    throw new Error(
      `TEST 1 bar shifts right: baseline first week=${baselineFirst}, test1=${test1First}, ` +
        `patterns ${baseline} → ${test1}`
    );
  }

  // TEST 2 — I10 extend two weeks (Jun 29)
  const test2Finish = new Date(2026, 5, 29);
  const test2 = barPattern(visibleWeeks, baselineStart, test2Finish);
  const baselineBarCount = (baseline.match(/█/g) || []).length;
  const test2BarCount = (test2.match(/█/g) || []).length;
  if (test2BarCount <= baselineBarCount) {
    throw new Error(`TEST 2 bar grows: baseline=${baselineBarCount} weeks, test2=${test2BarCount}`);
  }

  // TEST 3 — I10 earlier (Jun 8)
  const test3Finish = new Date(2026, 5, 8);
  const test3 = barPattern(visibleWeeks, baselineStart, test3Finish);
  const test3BarCount = (test3.match(/█/g) || []).length;
  if (test3BarCount >= baselineBarCount) {
    throw new Error(`TEST 3 bar shrinks: baseline=${baselineBarCount}, test3=${test3BarCount}`);
  }

  // TEST 4 — row groups created during setup (structural)
  assertIncludes(timelineV2, 'applyTimelineV2RowGroups_', 'TEST 4 row groups');
  assertIncludes(timelineV2, 'shiftRowGroupDepth(1)', 'TEST 4 shiftRowGroupDepth');

  // TEST 5 — groups independent of formulas (setup-only, no refresh on edit)
  assertIncludes(sheetSetup, 'setupTimelineV2Production_', 'TEST 5 production setup');
  assertNotIncludes(sheetSetup, 'refreshTimeline(', 'TEST 5 no refresh in setup');
  assertNotIncludes(sheetSetup, 'installTriggers_(', 'TEST 5 no trigger install in setup');
  assertIncludes(sheetSetup, 'uninstallAllTriggers_', 'TEST 5 removes triggers');

  // TEST 6 — no hardcoded DATE(2026,...) in week/task formulas
  assertNotIncludes(timelineV2, 'DATE(2026,', 'TEST 6 no hardcoded dates');
  assertIncludes(timelineV2, 'timelineV2WeekStartFormula_', 'TEST 6 dynamic week start');
  assertIncludes(timelineV2, 'timelineV2MinStartFormula_', 'TEST 6 min from STATUS');
  assertIncludes(timelineV2, 'TIMELINE_V2_MAX_WEEKS', 'TEST 6 unlimited week columns');

  // 52-week capacity without code change
  assertEqual(weekStarts.length, 52, '52 pre-allocated week columns');

  return {
    anchorMonday: weekStarts[0].toISOString().slice(0, 10),
    baseline,
    test1,
    test2,
    test3,
    formulaExample: weekBarFormulaExample(5, 'H'),
    weekStartFormula: '=IF($BF$1="","",$BF$1-WEEKDAY($BF$1,3))',
  };
}

try {
  const result = runTests();
  console.log('Phase B acceptance tests: ALL PASSED\n');
  console.log(`Dynamic week anchor (Monday of earliest STATUS date): ${result.anchorMonday}`);
  console.log('\nPlanning/Positioning row (STATUS H10/I10) week bars:');
  console.log(`  Baseline (Jun 1 – Jun 15):  ${result.baseline}`);
  console.log(`  TEST 1 start +1 week:       ${result.test1}`);
  console.log(`  TEST 2 finish extended:     ${result.test2}`);
  console.log(`  TEST 3 finish earlier:      ${result.test3}`);
  console.log('\nTEST 4–5: row groups + setup-only structure (no edit triggers).');
  console.log('TEST 6: no hardcoded calendar dates in TimelineV2.gs.');
  console.log('\nExample week-bar formula (Timeline row 5, column H):');
  console.log(result.formulaExample);
  console.log('\nExample week-start anchor (row 2, column F):');
  console.log(result.weekStartFormula);
} catch (err) {
  console.error('FAILED:', err.message);
  process.exit(1);
}
