/**
 * AnyList integration probe.
 *
 * Verifies that the unofficial reverse-engineered `anylist` npm package can
 * authenticate against your AnyList account, fetch your lists, and (optionally)
 * add a test item to a chosen list.
 *
 * Usage:
 *   1. npm install --save-dev anylist
 *   2. Add to .env.local (gitignored):
 *        ANYLIST_EMAIL=you@example.com
 *        ANYLIST_PASSWORD=your-anylist-password
 *        # Optional — if set, the script adds a test item to this list:
 *        ANYLIST_TARGET_LIST=Groceries
 *   3. set -a && source .env.local && set +a && npx tsx scripts/test-anylist.ts
 *      (or inline the env vars on the command line)
 *
 * Credentials are read from process.env and never logged.
 */

// The unofficial `anylist` package ships without TypeScript types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnyList: any = (await import("anylist")).default;

const email = process.env.ANYLIST_EMAIL;
const password = process.env.ANYLIST_PASSWORD;
const targetList = process.env.ANYLIST_TARGET_LIST;

if (!email || !password) {
  console.error("Missing required env vars: ANYLIST_EMAIL and ANYLIST_PASSWORD");
  process.exit(1);
}

async function main() {
  const any = new AnyList({ email, password });

  console.log("Logging in...");
  await any.login();
  console.log("✓ Logged in");

  console.log("\nFetching lists...");
  await any.getLists();
  const lists = any.lists ?? [];
  console.log(`✓ Found ${lists.length} list(s):`);
  for (const list of lists) {
    const itemCount = list.items?.length ?? 0;
    console.log(`  - "${list.name}" (${itemCount} items)`);
  }

  if (!targetList) {
    console.log(
      "\nSet ANYLIST_TARGET_LIST=<list name> to additionally probe item-add.",
    );
    any.teardown();
    return;
  }

  const list = any.getListByName(targetList);
  if (!list) {
    console.error(`\n✗ List named "${targetList}" not found.`);
    any.teardown();
    process.exit(2);
  }

  // Non-destructive: dump every item in the list along with its
  // categoryMatchId so we can map AnyList's internal category IDs to our
  // GroceryCategory enum.
  console.log(
    `\nItems in "${targetList}" (${list.items?.length ?? 0}):`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (list.items ?? []) as any[];
  for (const item of items) {
    console.log(`  - ${item.name.padEnd(40)} categoryMatchId=${item.categoryMatchId ?? "(none)"}`);
  }

  const uniqueIds = Array.from(
    new Set(items.map((i) => i.categoryMatchId).filter(Boolean)),
  ).sort();
  console.log(`\nUnique categoryMatchIds in this list: [${uniqueIds.join(", ")}]`);

  any.teardown();
}

main().catch((err) => {
  console.error("\n✗ Probe failed:", err instanceof Error ? err.message : err);
  process.exit(3);
});
