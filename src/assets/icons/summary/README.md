# MatMind Summary Icon System

Custom SVG assets for the MatMind Summary screen. These are designed for a dark React Native UI and use `currentColor` where possible so the same source can render active, muted, and accent states.

## Folder

`/assets/icons/summary/`

## Usage Snippet

```tsx
import TrainingSessionsIcon from "../../../assets/icons/summary/training-sessions.svg";

<TrainingSessionsIcon width={18} height={18} color="#7ED957" />
```

Use the project SVG transformer or `react-native-svg` pipeline already configured in the app. Render initials in athlete chips as native `Text`, not inside the SVG.

## Naming Convention

- `summary/<surface>-<concept>.svg`
- Metric icons use the metric label: `training-sessions.svg`, `top-system.svg`
- Action icons use the action intent: `add-competitions.svg`, `quick-add-record.svg`
- Product-specific icons avoid generic library names.

## Asset Manifest

| File | Usage | Size | Color Behavior |
| --- | --- | --- | --- |
| `training-sessions.svg` | `MetricTile` → Training Sessions | 18px | Accent green `#7ED957`; muted `#6B7280`; active glow via tile background |
| `top-system.svg` | `MetricTile` → Top System | 18px | Accent blue `#2F8CFF`; muted `#6B7280`; active stroke `#60A5FA` |
| `top-technique.svg` | `MetricTile` → Top Technique | 18px | Accent blue `#2F8CFF`; optional secondary yellow from container |
| `fourteen-day-focus.svg` | `MetricTile` → 14-Day Focus | 18px | Accent blue `#2F8CFF`; muted ring opacity comes from SVG |
| `gi-vs-nogi.svg` | `MetricTile` → Gi vs No-Gi | 18px | Accent green `#7ED957`; muted `#6B7280` |
| `competition-trophy.svg` | `CompetitionPerformanceCard` header | 22px | Accent blue `#2F8CFF` or yellow `#FACC15` depending context |
| `insight-analysis.svg` | `CompetitionPerformanceCard` insight block | 18px | Accent blue `#2F8CFF`; active dot can be green from container |
| `identity-badge.svg` | `IdentityHero` left badge | 22px | Accent blue `#2F8CFF`; muted border state `#243244` |
| `confidence-ring.svg` | `IdentityHero` confidence visual | 72px | Fixed teal/blue/green ring colors; use as visual asset, not a color-inherited icon |
| `add-competitions.svg` | `DataSeedCard` → Add Competitions | 22px | Accent yellow `#FACC15`; active button border yellow |
| `add-techniques-taxonomy.svg` | `DataSeedCard` → Add Techniques | 22px | Accent blue `#2F8CFF`; maps to technique taxonomy picker |
| `quick-add-record.svg` | `DataSeedCard` → Quick Add Record | 22px | Accent green `#7ED957`; muted baseline `#6B7280` |
| `avatar-placeholder.svg` | `AthleteSwitcher` avatar fallback | 30-32px | Active blue `#60A5FA`; inactive gray `#6B7280`; initials should be native text overlay or replacement |

## Color Tokens

- Base background: `#0B0D10`
- Card: `#12161C`
- Inset surface: `#0D1218`
- Border: `#243244`
- Blue accent: `#2F8CFF`
- Soft blue: `#60A5FA`
- Teal accent: `#38BDF8`
- Green accent: `#7ED957`
- Success green: `#34D399`
- Yellow accent: `#FACC15`
- Muted icon: `#6B7280`
- Primary text/icon: `#F9FAFB`
