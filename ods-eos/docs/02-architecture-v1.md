# ODS-EOS Architecture v0.1

## Overview

ODS-EOS v0.1 is a linear pipeline: the user invokes a CLI, which runs collectors to gather data, writes that data to a knowledge store, and runs generators to produce markdown documents. Each layer has a single responsibility. Layers communicate through the knowledge store only.

## System Flow

```text
User
↓
CLI
↓
Collectors
↓
Knowledge Store
↓
Generators
↓
Markdown Documents
```

## Layer Responsibilities

### User

The operator who invokes commands, reviews generated documents, and validates output against known activity. The user does not edit the knowledge store directly in normal operation.

### CLI

The entry point for all operations. The CLI parses commands, orchestrates collectors and generators in sequence, and reports success or failure. It does not contain business logic for collection or generation.

### Collectors

Components that gather engineering signals from defined sources and normalize them into records suitable for storage. In v0.1, collectors read from local session and activity data. Each collector produces structured output; it does not write documents.

### Knowledge Store

A JSON-based persistence layer that holds collected records. It is the single source of truth between collection and generation. All collectors write to it; all generators read from it. The store is human-inspectable and versionable.

### Generators

Components that read from the knowledge store and render markdown documents. Each generator targets a specific document type (EOD report, morning brief). Generators do not collect data and do not modify the store.

### Markdown Documents

The output artifacts produced by generators. These are read-only from the system's perspective once written. The user reviews and uses them; they are not fed back into the pipeline in v0.1.

## Boundaries

| Boundary | Rule |
|----------|------|
| CLI ↔ Collectors | CLI invokes collectors; collectors return structured records. |
| Collectors ↔ Knowledge Store | Collectors write records; they do not read from generators. |
| Knowledge Store ↔ Generators | Generators read records; they do not invoke collectors. |
| Generators ↔ Markdown | Generators write files; markdown is not parsed back into the store. |

## v0.1 Scope

This architecture covers only:

- CLI command dispatch
- JSON knowledge store read/write
- EOD generator
- Morning brief generator

Collectors beyond basic session capture, cross-document linking, and search are out of scope for v0.1 and are not represented in this diagram.
