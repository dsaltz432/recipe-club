/**
 * URL Validation Script for Recipe Club Hub
 *
 * Reads all recipe URLs from test-combine/src/data/recipes.ts
 * and checks each one returns a valid HTTP response.
 *
 * Usage: npx tsx scripts/validate-recipe-urls.ts
 */

import { TEST_RECIPES } from "../test-combine/src/data/recipes.js";

// --- Configuration ---
const CONCURRENCY_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// --- Types ---
interface ValidationResult {
  url: string;
  recipeId: string;
  recipeName: string;
  valid: boolean;
  status?: number;
  error?: string;
}

// --- Helpers ---

async function checkUrl(url: string): Promise<{ valid: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Try HEAD first
    let response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });

    // Some servers reject HEAD requests — fall back to GET
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
        redirect: "follow",
      });
    }

    const valid = response.status >= 200 && response.status < 400;
    return { valid, status: response.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      await fn(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
}

// --- Main ---

async function main(): Promise<void> {
  const urls = TEST_RECIPES.map((r) => ({
    url: r.url,
    recipeId: r.id,
    recipeName: r.name,
  }));

  console.log(`\nValidating ${urls.length} recipe URLs (concurrency: ${CONCURRENCY_LIMIT}, timeout: ${REQUEST_TIMEOUT_MS / 1000}s)...\n`);

  const results: ValidationResult[] = [];

  await runWithConcurrency(urls, CONCURRENCY_LIMIT, async (item) => {
    const check = await checkUrl(item.url);
    const result: ValidationResult = {
      ...item,
      ...check,
    };
    results.push(result);

    const icon = result.valid ? "✓" : "✗";
    const detail = result.error ?? `HTTP ${result.status}`;
    console.log(`  ${icon} [${item.recipeId}] ${item.url} — ${detail}`);
  });

  // Summary
  const valid = results.filter((r) => r.valid);
  const broken = results.filter((r) => !r.valid);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Total URLs checked: ${results.length}`);
  console.log(`  Valid:  ${valid.length}`);
  console.log(`  Broken: ${broken.length}`);
  console.log(`${"=".repeat(60)}`);

  if (broken.length > 0) {
    console.log(`\nBroken URLs:\n`);
    for (const b of broken) {
      const detail = b.error ?? `HTTP ${b.status}`;
      console.log(`  ✗ ${b.recipeName} (${b.recipeId})`);
      console.log(`    URL:    ${b.url}`);
      console.log(`    Reason: ${detail}\n`);
    }
    process.exit(1);
  } else {
    console.log(`\nAll URLs are valid!\n`);
    process.exit(0);
  }
}

main();
