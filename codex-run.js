const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_KEY_FILE_CHARS = 3000;

const IGNORED_REPO_DIRS = new Set([
  'node_modules',
  '.git',
  '.expo',
  'dist',
  'build',
  '.next',
]);

/**
 * Reads a UTF-8 file relative to cwd (or absolute path). Never throws.
 * @returns {{ content: string | null, truncated?: boolean, missing?: boolean, error?: string }}
 */
function safeRead(filePath) {
  const cwd = process.cwd();
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(cwd, filePath);
  try {
    if (!fs.existsSync(abs)) {
      return { content: null, missing: true };
    }
    const stat = fs.statSync(abs);
    if (!stat.isFile()) {
      return { content: null, error: 'not_a_file' };
    }
    const text = fs.readFileSync(abs, 'utf8');
    if (text.length <= MAX_KEY_FILE_CHARS) {
      return { content: text };
    }
    return {
      content: text.slice(0, MAX_KEY_FILE_CHARS),
      truncated: true,
    };
  } catch (err) {
    return { content: null, error: String(err.message) };
  }
}

/**
 * @returns {Array<{ type: string, name: string, path: string, children?: unknown } | { error: string, path: string }>}
 */
function readRepoStructure(dir, depth) {
  if (depth <= 0) {
    return [];
  }
  const cwd = process.cwd();
  const absDir = path.isAbsolute(dir) ? dir : path.join(cwd, dir);
  try {
    if (!fs.existsSync(absDir)) {
      return [{ error: 'path_missing', path: path.relative(cwd, absDir) }];
    }
    if (!fs.statSync(absDir).isDirectory()) {
      return [{ error: 'not_a_directory', path: path.relative(cwd, absDir) }];
    }
    const entries = fs.readdirSync(absDir);
    const rows = [];

    for (const name of entries) {
      if (IGNORED_REPO_DIRS.has(name)) {
        continue;
      }
      const fullPath = path.join(absDir, name);
      try {
        const relPath = path.relative(cwd, fullPath);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const children =
            depth > 1 ? readRepoStructure(fullPath, depth - 1) : [];
          rows.push({
            type: 'directory',
            name,
            path: relPath || name,
            children,
          });
        } else if (stat.isFile()) {
          rows.push({
            type: 'file',
            name,
            path: relPath || name,
          });
        }
      } catch (err) {
        rows.push({
          type: 'error',
          name,
          path: path.relative(cwd, fullPath) || name,
          error: String(err.message),
        });
      }
    }

    rows.sort((a, b) => {
      const order = (t) => (t.type === 'directory' ? 0 : 1);
      const od = order(a) - order(b);
      return od !== 0 ? od : a.name.localeCompare(b.name);
    });
    return rows;
  } catch (err) {
    return [{ error: String(err.message), path: path.relative(cwd, absDir) }];
  }
}

function collectKeyFileEntries() {
  const cwd = process.cwd();
  const trainingIndex = 'app/(tabs)/training/index.tsx';
  const trainingFallback = 'app/(tabs)/training.tsx';
  const remainder = [
    'src/storage/sessionsStore.ts',
    'src/types.ts',
    'src/features/summary_v2/SummaryScreenV2.tsx',
    'app/(tabs)/this-week/index.tsx',
    'app/(tabs)/training/[id].tsx',
  ];

  const list = [];

  const hasIndex = fs.existsSync(path.join(cwd, trainingIndex));
  const hasFallback = fs.existsSync(path.join(cwd, trainingFallback));
  let trainingChosen = null;
  if (hasIndex) trainingChosen = trainingIndex;
  else if (hasFallback) trainingChosen = trainingFallback;

  if (trainingChosen) {
    const meta = safeRead(trainingChosen);
    list.push({ path: trainingChosen, ...meta });
  } else {
    list.push({ path: trainingIndex, ...safeRead(trainingIndex) });
    list.push({ path: trainingFallback, ...safeRead(trainingFallback) });
  }

  for (const rel of remainder) {
    list.push({ path: rel, ...safeRead(rel) });
  }

  return list;
}

async function run() {
  try {
    const repoRoot = process.cwd();
    const repoTree = readRepoStructure(repoRoot, 2);
    const keyFiles = collectKeyFileEntries();

    const repoTreeJson = JSON.stringify(repoTree, null, 2);
    const keyFilesJson = JSON.stringify(keyFiles, null, 2);

    const prompt = ` You are working inside a real Expo React Native production repo.

REPO STRUCTURE:
${repoTreeJson}

KEY FILE CONTENTS:
${keyFilesJson}

Now apply this PATCH REQUEST:

PATCH REQUEST — TRAINING SESSION BUILDER (REPO-ALIGNED)

Implement the Training Session Builder using the EXISTING architecture.

---

1. ROUTING

Create new screens:

- app/(tabs)/training/calendar.tsx
- app/(tabs)/training/session-builder.tsx

Navigation:
- From Training tab → router.push("/training/calendar")
- From Calendar → router.push("/training/session-builder")

---

2. TRAINING FLOW

Flow must be:

Training Tab
→ Calendar (select date)
→ Session Builder
→ Save
→ Return to Training Tab

---

3. SESSION BUILDER REQUIREMENTS

Fields:

- Mat Type (Gi / No-Gi)
- System (must align with existing taxonomy)
- Technique of the Day (single)
- Add Technique (multi)
- Custom Technique
- Notes

MEDIA:

- Local media (camera roll) → device only
- Shared links (YouTube / Instagram)

UI must clearly label:

- “Saved on this device”
- “Shared with coach/athlete”

---

4. STORAGE (CRITICAL)

DO NOT create new AsyncStorage keys.

You MUST integrate with existing:

- sessionsStore
- session persistence logic

New session must match existing Session type and be appended correctly.

---

5. SIGNAL UPDATE

After saving:
- Trigger existing refresh / invalidate mechanism
- Ensure Training tab updates
- Ensure Summary signals can update

DO NOT create new hooks.

---

6. UI SYSTEM

- Reuse existing components
- Match Training tab hierarchy
- Do NOT use raw Button/TextInput
- Follow spacing and layout patterns

---

7. DO NOT TOUCH

- Coach system
- Competition system
- Identity system

---

OUTPUT:

- Show exact files to create/update
- Show real code (not pseudo)
- Keep changes minimal and aligned to repo

IMPORTANT:
- DO NOT invent architecture
- MUST align to existing patterns
- MUST reuse session store and existing training flows
`;

    const response = await client.responses.create({
      model: 'gpt-4.1',
      input: prompt,
    });

    console.log(response.output[0].content[0].text);
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

run();
