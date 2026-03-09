# RnR Mermaid Standard

> Canonical style guide for all engineering diagrams in this repo.
> Every `docs/engineering/*.md` file must follow this standard.

---

## Rules

| Rule         | Requirement                                                                           |
| ------------ | ------------------------------------------------------------------------------------- |
| **Chart**    | Every module doc must contain at least one Mermaid diagram                            |
| **Legend**   | Every diagram must have a legend table defining all acronyms and abbreviations        |
| **Theme**    | All diagrams must use the RnR Neo Dark init block below — no deviations               |
| **Scope**    | Subgraph names must map 1:1 to actual directories in the codebase                     |
| **Scale**    | Max 20 nodes per diagram — split into sub-diagrams if larger                          |
| **No drift** | No speculative future nodes in current-state diagrams (use a Phase N diagram instead) |
| **No micro** | Minimum scope is a module — never diagram a single function                           |
| **No tree**  | Never use a diagram to show a directory tree — use a code block instead               |

---

## RnR Neo Dark Theme

Copy the init block exactly. Do not alter values.

```
%%{init: {'theme': 'base', 'themeVariables': {'background': '#0b0f17', 'primaryColor': '#111827', 'primaryTextColor': '#e6edf3', 'primaryBorderColor': '#22d3ee', 'lineColor': '#94a3b8', 'secondaryColor': '#0f172a', 'tertiaryColor': '#111827', 'clusterBkg': '#0f172a', 'clusterBorder': '#22d3ee', 'fontFamily': 'Avenir Next, Avenir, Segoe UI, sans-serif'}}}%%
```

Source of truth: `docs/architecture.md` (exec deck) uses this theme — the two doc families share the same visual identity.

**Do not** use inline `style` overrides. All color intent is expressed through `classDef`.

---

## Semantic Class Definitions

Include only the classes you use. Paste the block at the bottom of every `flowchart` / `graph` diagram.

```
classDef title    fill:#020617,color:#e6edf3,stroke:#22d3ee,stroke-width:2px;
classDef complete fill:#166534,color:#fff;
classDef active   fill:#713f12,color:#fff;
classDef pending  fill:#1e3a5f,color:#ccc;
classDef warn     fill:#7f1d1d,color:#fff;
```

| Class      | Semantic meaning                            |
| ---------- | ------------------------------------------- |
| `title`    | Title/header node — cyan-bordered dark card |
| `complete` | Shipped, stable, in production              |
| `active`   | Current sprint / in-progress                |
| `pending`  | Planned but not started                     |
| `warn`     | Deprecated, removed, or needs attention     |

Apply with triple-colon syntax: `NodeID:::complete`

---

## Diagram Type → Use Case

| Type              | When to use                                      |
| ----------------- | ------------------------------------------------ |
| `flowchart LR`    | Roadmaps, phase timelines, horizontal flows      |
| `flowchart TD`    | Decision trees, routing logic                    |
| `graph TB`        | Layer/tier architecture (top-to-bottom stacks)   |
| `sequenceDiagram` | Async request/response, dev workflows            |
| `stateDiagram-v2` | State machines — order lifecycle, session states |

---

## Node Naming Convention

| Element          | Convention                         | Example                        |
| ---------------- | ---------------------------------- | ------------------------------ |
| External service | `ALL_CAPS`                         | `FIREBASE`, `CLOVER`, `STRIPE` |
| Internal module  | Short `ABBREV` — defined in legend | `REPO`, `COMP`, `SEO`          |
| File path        | Quoted label                       | `"src/lib/firebase/admin.ts"`  |
| Process / action | Verb phrase                        | `"Validate Content"`           |
| Decision node    | Question form `{"...?"}`           | `{"isEmulator?"}`              |

---

## Required Doc Structure

Every `docs/engineering/*.md` file must contain:

```markdown
# Module Name — Short Description

> One-line purpose statement.

---

## Diagram Title

Brief context sentence.

\`\`\`mermaid
%%{init: ...}%%
...diagram...
\`\`\`

### Legend

| Abbrev | Meaning |
| ------ | ------- |
| ...    | ...     |

### Key Paths

- ...3–5 bullets...
```

---

## Auto-inject: VS Code Snippet

Install [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) for local preview.

The `.vscode/mermaid.code-snippets` file defines two snippets:

| Prefix      | Expands to                                                |
| ----------- | --------------------------------------------------------- |
| `rnr-chart` | Flowchart skeleton with RnR Neo Dark init + all classDefs |
| `rnr-seq`   | Sequence diagram skeleton with RnR Neo Dark init          |

Type the prefix in any `.md` file and press Tab — the full themed skeleton drops in. No manual copy-paste required.

---

## Anti-patterns

```
❌ Inline style override
   style NodeA fill:#ff0000   ← never do this, use classDef

❌ Future node in current-state diagram
   CLOVER["Phase 2: Clover Sync"]   ← belongs in a Phase 2 diagram only

❌ Directory tree as diagram
   Use a fenced code block instead

❌ Single-function diagram
   A["getAdminFirestore()"] --> B["return adminDb"]   ← too granular

❌ Unlabeled acronym
   REPO --> ADMIN --> ENV   ← legend required if abbreviations are used
```
