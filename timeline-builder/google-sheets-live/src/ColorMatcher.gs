/**
 * Word-boundary color matching (ported from color_matcher.py).
 */

function escapeRegex_(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternMatches_(taskName, pattern) {
  const parts = pattern.toLowerCase().split(/\s+/).filter(function (p) { return p; });
  let body;
  if (parts.length > 1) {
    body = parts.map(escapeRegex_).join('\\s+');
  } else {
    body = escapeRegex_(pattern.toLowerCase());
  }
  const regex = new RegExp('(?<![a-z0-9])' + body + '(?![a-z0-9])', 'i');
  return regex.test(taskName);
}

function buildCategoryLookup_(categories) {
  const lookup = {};
  categories.forEach(function (cat) {
    lookup[cat.name] = cat;
  });
  return lookup;
}

function taskStyle(taskName, categories, theme) {
  const lookup = buildCategoryLookup_(categories);
  const defaultStyle = { fill: theme.defaultFill, font: theme.defaultFont };
  for (let i = 0; i < CATEGORY_PRECEDENCE.length; i++) {
    const categoryName = CATEGORY_PRECEDENCE[i];
    const rule = lookup[categoryName];
    if (!rule) continue;
    for (let j = 0; j < rule.patterns.length; j++) {
      if (patternMatches_(taskName, rule.patterns[j])) {
        return { fill: rule.fill, font: rule.font };
      }
    }
  }
  return defaultStyle;
}
