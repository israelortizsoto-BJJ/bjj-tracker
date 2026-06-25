/**
 * Load presentation theme and color rules from Config sheet.
 *
 * Config layout:
 *   Row 1: Category | Patterns | Fill | Font
 *   Rows 2+: color categories
 *   Blank row
 *   Section "Theme" with Key | Value rows
 */

function defaultTheme_() {
  return {
    headerFill: '#203864',
    headerFont: '#FFFFFF',
    projectHeaderFill: '#E7E6E6',
    projectHeaderFont: '#203864',
    monthHeaderFill: '#F2F2F2',
    monthHeaderFont: '#404040',
    weekHeaderFill: '#FAFAFA',
    weekHeaderFont: '#595959',
    altRowFill: '#F9F9F9',
    criticalFill: '#C00000',
    criticalFont: '#FFFFFF',
    defaultFill: '#D9D9D9',
    defaultFont: '#404040',
  };
}

function defaultCategories_() {
  return [
    { name: 'Concepting', patterns: ['concept', 'concepting', 'ideation'], fill: '#1F3864', font: '#FFFFFF' },
    { name: 'Pre Pro / Prep', patterns: ['pre pro', 'pre-pro', 'prep', 'preproduction', 'pre production', 'planning'], fill: '#2F75B5', font: '#FFFFFF' },
    { name: 'Shoot', patterns: ['shoot', 'filming', 'production day', 'on set'], fill: '#9DC3E6', font: '#1F3864' },
    { name: 'Edit / Post / VFX / Color', patterns: ['edit', 'post', 'vfx', 'color', 'grade', 'finishing', 'compositing'], fill: '#00B0A8', font: '#FFFFFF' },
    { name: 'Review / Approval', patterns: ['review', 'approval', 'approve', 'feedback', 'sign-off', 'sign off'], fill: '#A6A6A6', font: '#FFFFFF' },
    { name: 'Delivery / Air / Live', patterns: ['delivery', 'deliver', 'air', 'live', 'launch', 'publish', 'release'], fill: '#006B6B', font: '#FFFFFF' },
  ];
}

function loadConfig(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SHEET_CONFIG);
  if (!sheet || sheet.getLastRow() < 2) {
    return {
      categories: defaultCategories_(),
      theme: defaultTheme_(),
    };
  }

  const values = sheet.getDataRange().getValues();
  const categories = [];
  const theme = defaultTheme_();
  let inTheme = false;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const col0 = row[0] ? String(row[0]).trim() : '';
    if (!col0) continue;
    if (col0.toLowerCase() === 'theme') {
      inTheme = true;
      continue;
    }
    if (inTheme) {
      const key = col0;
      const val = row[1] ? String(row[1]).trim() : '';
      if (key === 'criticalFill') theme.criticalFill = val;
      else if (key === 'criticalFont') theme.criticalFont = val;
      else if (key === 'defaultFill') theme.defaultFill = val;
      else if (key === 'defaultFont') theme.defaultFont = val;
      else if (key === 'headerFill') theme.headerFill = val;
      else if (key === 'headerFont') theme.headerFont = val;
      else if (key === 'projectHeaderFill') theme.projectHeaderFill = val;
      else if (key === 'projectHeaderFont') theme.projectHeaderFont = val;
      else if (key === 'monthHeaderFill') theme.monthHeaderFill = val;
      else if (key === 'monthHeaderFont') theme.monthHeaderFont = val;
      else if (key === 'weekHeaderFill') theme.weekHeaderFill = val;
      else if (key === 'weekHeaderFont') theme.weekHeaderFont = val;
      else if (key === 'altRowFill') theme.altRowFill = val;
      continue;
    }
    if (String(row[1] || '').toLowerCase() === 'patterns') continue;
    const patterns = String(row[1] || '')
      .split('|')
      .map(function (p) { return p.trim().toLowerCase(); })
      .filter(function (p) { return p; });
    categories.push({
      name: col0,
      patterns: patterns,
      fill: hexBackground(row[2] || '#D9D9D9'),
      font: hexBackground(row[3] || '#404040'),
    });
  }

  return {
    categories: categories.length ? categories : defaultCategories_(),
    theme: theme,
  };
}

function writeDefaultConfigSheet_(sheet) {
  sheet.clear();
  const rows = [
    ['Category', 'Patterns (pipe-separated)', 'Fill', 'Font'],
  ];
  defaultCategories_().forEach(function (cat) {
    rows.push([cat.name, cat.patterns.join('|'), cat.fill, cat.font]);
  });
  rows.push(['', '', '', '']);
  rows.push(['Theme', 'Value']);
  rows.push(['criticalFill', '#C00000']);
  rows.push(['criticalFont', '#FFFFFF']);
  rows.push(['defaultFill', '#D9D9D9']);
  rows.push(['defaultFont', '#404040']);
  rows.push(['headerFill', '#203864']);
  rows.push(['headerFont', '#FFFFFF']);
  rows.push(['projectHeaderFill', '#E7E6E6']);
  rows.push(['projectHeaderFont', '#203864']);
  rows.push(['monthHeaderFill', '#F2F2F2']);
  rows.push(['monthHeaderFont', '#404040']);
  rows.push(['weekHeaderFill', '#FAFAFA']);
  rows.push(['weekHeaderFont', '#595959']);
  rows.push(['altRowFill', '#F9F9F9']);
  const normalized = normalizeGrid2D_(rows, 4, '');
  sheet.getRange(1, 1, normalized.length, 4).setValues(normalized);
  sheet.setFrozenRows(1);
}
