#!/usr/bin/env node

/**
 * perf-check.js
 *
 * Unified baseline comparison tool. Reads current perf data and compares
 * against committed baselines.
 *
 * Usage:
 *   node scripts/perf-check.js [--ci]
 *
 * Flags:
 *   --ci  Exit with code 1 on any regression (for CI pipelines)
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PERF_DIR = path.join(PROJECT_ROOT, ".perf");
const BASELINES_DIR = path.join(PERF_DIR, "baselines");

const CHECKS = [
  {
    name: "Frontend Bundle Size",
    current: path.join(PERF_DIR, "frontend.json"),
    baseline: path.join(BASELINES_DIR, "frontend.baseline.json"),
  },
];

function formatKb(kb) {
  return `${kb.toFixed(1)} KB`;
}

function formatPct(pct) {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function compareFrontend(current, baseline) {
  const results = [];

  // Total JS size
  const totalDelta = current.total_js_kb - baseline.total_js_kb;
  const totalPct = (totalDelta / baseline.total_js_kb) * 100;
  results.push({
    metric: "Total JS",
    baseline: formatKb(baseline.total_js_kb),
    current: formatKb(current.total_js_kb),
    delta: formatKb(totalDelta),
    change: formatPct(totalPct),
    severity: Math.abs(totalPct) > 10 ? "FAIL" : Math.abs(totalPct) > 5 ? "WARN" : "OK",
  });

  // Shared framework size
  const sharedDelta =
    current.shared_framework_kb - baseline.shared_framework_kb;
  const sharedPct =
    (sharedDelta / (baseline.shared_framework_kb || 1)) * 100;
  results.push({
    metric: "Shared Framework",
    baseline: formatKb(baseline.shared_framework_kb),
    current: formatKb(current.shared_framework_kb),
    delta: formatKb(sharedDelta),
    change: formatPct(sharedPct),
    severity: Math.abs(sharedPct) > 10 ? "FAIL" : Math.abs(sharedPct) > 5 ? "WARN" : "OK",
  });

  // Chunk count
  const chunkDelta = current.chunk_count - baseline.chunk_count;
  results.push({
    metric: "Chunk Count",
    baseline: String(baseline.chunk_count),
    current: String(current.chunk_count),
    delta: String(chunkDelta),
    change: chunkDelta === 0 ? "0" : `${chunkDelta > 0 ? "+" : ""}${chunkDelta}`,
    severity: "INFO",
  });

  return results;
}

function printTable(rows) {
  // Column widths
  const cols = ["metric", "baseline", "current", "delta", "change", "severity"];
  const headers = ["Metric", "Baseline", "Current", "Delta", "Change", "Status"];
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[cols[i]]).length))
  );

  const separator = widths.map((w) => "-".repeat(w + 2)).join("+");
  const formatRow = (vals) =>
    vals.map((v, i) => ` ${String(v).padEnd(widths[i])} `).join("|");

  console.log(formatRow(headers));
  console.log(separator);
  for (const row of rows) {
    console.log(formatRow(cols.map((c) => row[c])));
  }
}

// --- Main ---
const args = process.argv.slice(2);
const ciMode = args.includes("--ci");
let hasRegression = false;

console.log("Performance Baseline Comparison");
console.log("================================\n");

for (const check of CHECKS) {
  console.log(`--- ${check.name} ---\n`);

  if (!fs.existsSync(check.current)) {
    console.log(
      `  [SKIP] No current data. Run 'make perf-frontend' first.\n`
    );
    continue;
  }

  if (!fs.existsSync(check.baseline)) {
    console.log(
      `  [SKIP] No baseline. Run 'make perf-update-baseline' first.\n`
    );
    continue;
  }

  const current = JSON.parse(fs.readFileSync(check.current, "utf-8"));
  const baseline = JSON.parse(fs.readFileSync(check.baseline, "utf-8"));

  console.log(
    `  Baseline: ${baseline.git_sha} (${baseline.timestamp})`
  );
  console.log(
    `  Current:  ${current.git_sha} (${current.timestamp})\n`
  );

  const results = compareFrontend(current, baseline);
  printTable(results);

  const failures = results.filter((r) => r.severity === "FAIL");
  const warnings = results.filter((r) => r.severity === "WARN");

  if (failures.length > 0) {
    console.log(
      `\n  FAIL: ${failures.length} metric(s) exceeded +10% threshold`
    );
    hasRegression = true;
  }
  if (warnings.length > 0) {
    console.log(
      `\n  WARN: ${warnings.length} metric(s) exceeded +5% threshold`
    );
  }
  if (failures.length === 0 && warnings.length === 0) {
    console.log("\n  PASS: All metrics within acceptable range");
  }
  console.log();
}

// JSON summary for Agent consumption
const summary = {
  timestamp: new Date().toISOString(),
  has_regression: hasRegression,
  checks: CHECKS.map((c) => c.name),
};
console.log("--- JSON Summary ---");
console.log(JSON.stringify(summary, null, 2));

if (ciMode && hasRegression) {
  console.log("\nCI mode: Exiting with code 1 due to regressions.");
  process.exit(1);
}
