# ODS-EOS Architecture v0.1 (Superseded)

> **Superseded by `02-architecture-v0.2.md` on 2026-06-30.**
>
> This document is preserved for architectural lineage. Do not implement against v0.1.

---

## Overview

ODS-EOS v0.1 was a linear pipeline: the user invokes a CLI, which runs collectors to gather data, writes that data to a knowledge store, and runs generators to produce markdown documents.

```text
User → CLI → Collectors → Knowledge Store → Generators → Markdown Documents
```

v0.2 reframes canonical authority to the Event Store and introduces Mission Engine, Projection Engine, Mission State, and Automation Engine. See `02-architecture-v0.2.md`, `00-architecture-review-2026-06-30.md`, and `07-changelog.md`.
