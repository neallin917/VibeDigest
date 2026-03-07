#!/usr/bin/env node

/**
 * parse-build-output.js
 *
 * Analyzes Next.js build artifacts (.next/) to produce structured JSON
 * with bundle size data. Works with Next.js 16+ (Turbopack) which no
 * longer prints per-route sizes to stdout.
 *
 * Usage:
 *   node scripts/parse-build-output.js [--check-baseline]
 *
 * Output: JSON to stdout (or .perf/frontend.json when piped via Makefile)
 *
 * Flags:
 *   --check-baseline  Compare against .perf/baselines/frontend.baseline.json
 *                     Warn at +5% total size, fail at +10%
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(PROJECT_ROOT, "frontend");
const NEXT_DIR = path.join(FRONTEND_DIR, ".next");
const CHUNKS_DIR = path.join(NEXT_DIR, "static", "chunks");
const BASELINE_PATH = path.join(
  PROJECT_ROOT,
  ".perf",
  "baselines",
  "frontend.baseline.json"
);

const WARN_THRESHOLD = 0.05; // +5%
const FAIL_THRESHOLD = 0.10; // +10%

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: PROJECT_ROOT })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

/**
 * Recursively collect all .js files under a directory with their sizes.
 */
function collectJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(fullPath));
    } else if (entry.name.endsWith(".js")) {
      const stat = fs.statSync(fullPath);
      results.push({ path: fullPath, name: entry.name, size: stat.size });
    }
  }
  return results;
}

/**
 * Analyze .next/static/chunks/ for bundle size data.
 */
function analyzeBuild() {
  if (!fs.existsSync(NEXT_DIR)) {
    console.error(
      "Error: .next/ directory not found. Run 'npm run build' in frontend/ first."
    );
    process.exit(1);
  }

  const chunks = collectJsFiles(CHUNKS_DIR);
  const totalBytes = chunks.reduce((sum, f) => sum + f.size, 0);
  const totalKb = totalBytes / 1024;

  // Read build manifest for shared/framework chunks
  const buildManifestPath = path.join(NEXT_DIR, "build-manifest.json");
  let sharedChunks = [];
  if (fs.existsSync(buildManifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf-8"));
    const rootMain = manifest.rootMainFiles || [];
    const polyfill = manifest.polyfillFiles || [];
    sharedChunks = [...rootMain, ...polyfill];
  }

  // Calculate shared (framework) size
  const sharedBytes = chunks
    .filter((f) =>
      sharedChunks.some((sc) => sc.includes(f.name))
    )
    .reduce((sum, f) => sum + f.size, 0);
  const sharedKb = sharedBytes / 1024;

  // Read app-paths-manifest for route list
  const appPathsPath = path.join(
    NEXT_DIR,
    "server",
    "app-paths-manifest.json"
  );
  let routes = {};
  if (fs.existsSync(appPathsPath)) {
    const appPaths = JSON.parse(fs.readFileSync(appPathsPath, "utf-8"));
    // Filter to page routes only (not API routes, icons, etc.)
    for (const [routePath, serverFile] of Object.entries(appPaths)) {
      if (routePath.includes("/api/") || routePath.includes("icon") ||
          routePath.includes("favicon") || routePath.includes("robots") ||
          routePath.includes("sitemap") || routePath.includes("manifest") ||
          routePath.includes("apple-icon")) {
        continue;
      }
      // Check if there's a corresponding client chunk
      const cleanRoute = routePath.replace(/\/page$/, "") || "/";
      routes[cleanRoute] = { server_file: serverFile };
    }
  }

  // Top 10 largest chunks for analysis
  const topChunks = chunks
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map((f) => ({
      name: f.name,
      size_kb: parseFloat((f.size / 1024).toFixed(1)),
    }));

  return {
    timestamp: new Date().toISOString(),
    git_sha: getGitSha(),
    total_js_kb: parseFloat(totalKb.toFixed(1)),
    shared_framework_kb: parseFloat(sharedKb.toFixed(1)),
    chunk_count: chunks.length,
    page_routes: Object.keys(routes).length,
    routes,
    top_chunks: topChunks,
    status: "pass",
    regressions: [],
  };
}

/**
 * Compare current data against baseline.
 */
function checkBaseline(current) {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(
      "No baseline found at " +
        BASELINE_PATH +
        "\nRun 'make perf-update-baseline' to create one."
    );
    return current;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));
  const regressions = [];

  // Compare total JS size
  const totalDelta = current.total_js_kb - baseline.total_js_kb;
  const totalPct = totalDelta / baseline.total_js_kb;

  if (totalPct > FAIL_THRESHOLD) {
    regressions.push({
      metric: "total_js_kb",
      baseline: baseline.total_js_kb,
      current: current.total_js_kb,
      change_pct: parseFloat((totalPct * 100).toFixed(1)),
      severity: "fail",
    });
  } else if (totalPct > WARN_THRESHOLD) {
    regressions.push({
      metric: "total_js_kb",
      baseline: baseline.total_js_kb,
      current: current.total_js_kb,
      change_pct: parseFloat((totalPct * 100).toFixed(1)),
      severity: "warn",
    });
  }

  // Compare shared framework size
  const sharedDelta = current.shared_framework_kb - baseline.shared_framework_kb;
  const sharedPct = sharedDelta / (baseline.shared_framework_kb || 1);

  if (sharedPct > FAIL_THRESHOLD) {
    regressions.push({
      metric: "shared_framework_kb",
      baseline: baseline.shared_framework_kb,
      current: current.shared_framework_kb,
      change_pct: parseFloat((sharedPct * 100).toFixed(1)),
      severity: "fail",
    });
  } else if (sharedPct > WARN_THRESHOLD) {
    regressions.push({
      metric: "shared_framework_kb",
      baseline: baseline.shared_framework_kb,
      current: current.shared_framework_kb,
      change_pct: parseFloat((sharedPct * 100).toFixed(1)),
      severity: "warn",
    });
  }

  const hasFail = regressions.some((r) => r.severity === "fail");
  const hasWarn = regressions.some((r) => r.severity === "warn");

  return {
    ...current,
    status: hasFail ? "fail" : hasWarn ? "warn" : "pass",
    regressions,
    baseline_sha: baseline.git_sha,
  };
}

// --- Main ---
const args = process.argv.slice(2);
const shouldCheckBaseline = args.includes("--check-baseline");

const result = analyzeBuild();
const finalResult = shouldCheckBaseline ? checkBaseline(result) : result;

console.log(JSON.stringify(finalResult, null, 2));

if (finalResult.status === "fail") {
  process.exit(1);
}
