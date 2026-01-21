# Lambic Log Parser

This tool parses Lambic log files into structured reports. It reads a log line
by line, extracts combat, economy, error, performance, serf, and faction AI
signals, then writes a human-readable report plus a structured JSON report that
is ready for automation and AI analysis. A meta report mode aggregates multiple
runs to show trends over time. A lightweight GUI is included for local usage.

## What it does

- Parses a single log file into:
  - `report.txt` for humans
  - `report.json` for automation/AI
  - `metadata.json` with run metadata only
- Aggregates past runs into a meta report with trend deltas.
- Captures evidence (events, errors, samples) alongside summary stats.
- Tracks a time range inferred from timestamps embedded in the log.
- Tracks unrecognized lines so gaps are visible.

Reports are stored under a `reports/` directory in your current working
directory, with one folder per run.

## How it works

1. `LogParser` streams the log file line by line.
2. It tracks context (`lineNumber`, `currentDay`, `currentHour`,
   `firstTimestamp`, `lastTimestamp`).
3. Each extractor inspects the line and updates its own stats, events, and
   evidence.
4. `ReportGenerator` composes both `report.txt` and `report.json`.
5. `MetaReportGenerator` loads prior runs from `reports/run_*` and computes
   trends.

### Context parsing

- **Tempus context** is parsed from lines matching:
  - `"[TEMPUS] Day <N>, Hour: <value>"`
- **Timestamps** are parsed from any ISO-8601 `YYYY-MM-DDTHH:MM:SS(.sss)Z`
  substring. The first and last timestamp seen define the time range.

### Extractors

Each extractor extends `BaseExtractor` and writes:

- `stats`: summarized counters/aggregates
- `events`: structured events suitable for timelines
- `errors`: structured error records
- `samples`: raw samples (performance metrics, combat recorder lines, etc.)
- `highlights` and `anomalies`: notable items for reports

Extractor output is capped by `maxEntries` in `config.json`.

#### Combat (`CombatExtractor`)

Matches:

- `"[COMBAT] <attacker> attacked <target> for <damage> damage at [x,y] z=z"`
- `"[DEATH] <victim> killed by <killer> at [x,y] z=z"`
- `"[COMBAT RECORDER] <faction>: <message>"`

Stats:

- `totalAttacks`, `totalDeaths`, `totalDamage`
- `attacksByActor`, `deathsByKiller`

Events and samples include position, day/hour, and line number.

#### Economy (`EconomicExtractor`)

Matches:

- `"[ECONOMIC] ... deposited <amount> <resource> to <faction>"`

Stats:

- `totalDeposits`
- `depositsByFaction`, `depositsByResource`
- `amountByFactionResource`

#### Errors (`ErrorExtractor`)

Detects severity via:

- `[SerfLogger:WARN]` or `[WARN]` → `WARN`
- `[ERROR]`, `ERROR`, `Exception`, `exception`, or `"Error"` inside a bracketed
  category → `ERROR`

Stats:

- `totalErrors`, `totalWarnings`
- `byCategory`, `byMessage`

An anomaly is raised when the same warning message is seen 10 times.

#### Performance (`PerformanceExtractor`)

Extracts numeric samples from lines containing:

- `fps: <n>` or `fps=<n>`
- `frame time: <n> ms`
- `packet size: <n> [kb|mb|bytes]`
- `memory: <n> [kb|mb|gb]`

Stats are reported as averages: `avgFps`, `avgFrameMs`, `avgPacketBytes`,
`avgMemoryMb`.

#### Serf (`SerfExtractor`)

Matches:

- `"[SERF WORK] <faction>: <message>"`
- `"[SerfLogger:WARN] <message>"`

Stats:

- `workEvents`, `warnings`
- `workByFaction`, `workByBuilding`
- `warningByMessage`

Building type is inferred from the message (lumbermill, mine, farm, mill, smith).

#### Faction AI (`FactionAIExtractor`)

Matches:

- `[FactionAI]`, `[GoalExecutor]`, `[COMBAT RECORDER]`
- `Goal chain` or `Chain creation errors`

Stats:

- `totalEvents`, `chainErrors`, `decisions`
- `byComponent`

#### Unrecognized (`UnrecognizedExtractor`)

Any line that no other extractor claims is recorded here. This makes coverage
gaps visible and provides samples so new extractors can be added.

Stats:

- `totalUnrecognized`
- `byPrefix` (log prefix or first token)

## How to use

### CLI

From the repo root:

```
node tools/logParser/index.js --input /path/to/log.txt
```

With a custom config:

```
node tools/logParser/index.js --input /path/to/log.txt --config /path/to/config.json
```

Generate a meta report from saved runs:

```
node tools/logParser/index.js --meta
node tools/logParser/index.js --meta --from 2026-01-19 --to 2026-01-20
```

### GUI

Start the GUI server:

```
node tools/logParser/gui/server.js
```

Then open `http://localhost:3333`. You can submit:

- `inputPath` and optional `configPath` for parsing
- `from`/`to` for meta reports

The GUI calls the same parser and writes reports under `reports/` in your
current working directory.

## Output structure

Each run creates:

```
reports/
  run_YYYYMMDD_HHMMSS/
    report.txt
    report.json
    metadata.json
```

### `report.json` shape

`report.json` is the AI-friendly output that includes:

- `meta`: log file path, run timestamp, line count, time range, parser version
- `stats`: extractor-level stats
- `highlights` and `anomalies`
- `evidence`: `events`, `errors`, `samples`
- `runSummary`: derived narrative and key risks

### `report.txt` contents

`report.txt` is a readable summary containing:

- processed time and log file
- overall error/warning/combat/economy counts
- per-extractor stats in JSON format
- anomalies list (if any)

### `metadata.json`

Just the `meta` portion of the report for quick indexing.

## Meta reports

Meta reports summarize multiple runs and compute deltas between the earliest
and latest runs in the filtered range. Output includes:

- `reportCount`
- `dateRange`
- trend deltas for error/warning/combat/economy rates and average FPS
- per-run metrics history

Meta reports are written to:

```
reports/meta_report_YYYYMMDD.json
```

## Configuration

`config.json` controls:

- `parserVersion`: stored in report metadata
- `extractors`: per-extractor `enabled` flags and `maxEntries` limits
- `customPatterns` and `reportSettings` placeholders for future extension

Example:

```
{
  "parserVersion": "1.0.0",
  "extractors": {
    "combat": { "enabled": true, "maxEntries": 1000 },
    "economy": { "enabled": true, "maxEntries": 1000 },
    "errors": { "enabled": true, "maxEntries": 1000 },
    "performance": { "enabled": true, "maxEntries": 500 },
    "serf": { "enabled": true, "maxEntries": 1000 },
    "factionAI": { "enabled": true, "maxEntries": 1000 },
    "unrecognized": { "enabled": true, "maxEntries": 500 }
  }
}
```

## Extending the parser

1. Create a new extractor by extending `BaseExtractor`.
2. Implement `extract(line, context)` and optionally `initializeStats()`.
3. Add it to `buildExtractors()` in both `index.js` and `gui/server.js`.
4. Add config defaults to `config.json`.

## Event Manager System Integration

The log parser fully integrates with the Event Manager system (`server/js/core/EventManager.js`). Event Manager events are logged in a structured format:

```
[EVENT] {"id":...,"ts":...,"category":"Combat","action":"dealt 10 damage",...}
```

The `EventManagerExtractor` handles all 11 event categories:
- **ECONOMIC**: Resource gathering, serf spawning, deposits
- **BUILDING**: Construction completions, starts, failures
- **COMBAT**: Attacks, escapes, miniboss upgrades
- **ENVIRONMENT**: Day/night transitions, hour changes, daily recaps, zone/cave entries
- **SOCIAL**: NPC speech, player interactions, UI feedback
- **DEATH**: Entity deaths, respawns
- **STEALTH**: Reserved for future use
- **FACTION**: Scouting missions, expansion activities, conflict zones
- **MILITARY**: Unit recruitment, upgrades
- **ITEM**: Item drops, pickups
- **AI**: AI system events, decision patterns

### Dual Format Handling

The parser handles both Event Manager structured events (`[EVENT]`) and legacy log formats:

- **EventManagerExtractor**: Processes structured `[EVENT]` JSON events from Event Manager
- **Legacy Extractors**: Handle old-style log formats:
  - `BuildingExtractor`: `[BUILDING] buildingtype completed at [x,y]`
  - `CombatExtractor`: `[COMBAT] attacker attacked target for X damage`
  - `EnvironmentExtractor`: `[ENVIRONMENT] Nightfall`
  - `EconomicExtractor`: `[ECONOMIC] ... deposited X resource`

**Priority**: Event Manager events are processed first. Legacy formats are only matched if no Event Manager event exists for the same line. This ensures consistency and avoids duplication.

**Coverage**: All Event Manager categories are tracked with detailed statistics including:
- Category-specific metrics (combat damage, death locations, building completions, etc.)
- Position-based hotspots (512x512 tile regions)
- Entity relationships (kills, attacks, interactions)
- Temporal patterns (by day, by hour)
- Communication modes (which events reach players vs system-only)
- Anomaly detection (spikes, missing events, pattern anomalies)

## Notes and limitations

- The parser relies on stable log formats; pattern changes require extractor
  updates.
- Timestamp coverage depends on ISO timestamps existing in the log.
- Some stats (performance averages) only appear if matching samples are found.
- Event Manager events take priority over legacy formats to avoid duplication.
- Both format types can coexist in logs during transition periods.

