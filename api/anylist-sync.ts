import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import AnyList from "anylist";

const IS_PRODUCTION =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

const DEV_EMAILS = IS_PRODUCTION ? [] : ["dev@example.com"];

const ALLOWED_EMAILS = new Set([
  "dsaltz190@gmail.com",
  "sarahgsaltz@gmail.com",
  ...DEV_EMAILS,
]);

// AnyList's actual `categoryMatchId` slugs, captured by inspecting
// existing items in the user's list (see scripts/test-anylist.ts).
// Items mapped to "other" or unmapped fall through to AnyList's smart
// auto-categorization, which infers from item name.
const CATEGORY_TO_ANYLIST: Record<string, string> = {
  produce: "produce",
  meat_seafood: "meat",
  dairy: "dairy",
  pantry: "cooking-and-baking",
  spices: "cooking-and-baking",
  frozen: "frozen-foods",
  bakery: "bakery",
  beverages: "beverages",
  condiments: "condiments-oils-and-salad-dressings",
};

interface SyncItem {
  name: string;
  displayName: string;
  totalQuantity?: number;
  unit?: string;
  category?: string;
  sourceRecipes?: string[];
}

interface SyncRequest {
  items: SyncItem[];
  eventName?: string;
}

function formatItemForAnyList(item: SyncItem): {
  name: string;
  quantity?: string;
  details?: string;
  categoryMatchId?: string;
} {
  const name = item.displayName || item.name;
  const categoryMatchId = item.category ? CATEGORY_TO_ANYLIST[item.category] : undefined;
  const details = item.sourceRecipes?.length ? item.sourceRecipes.join(", ") : undefined;
  const quantity =
    item.totalQuantity == null
      ? undefined
      : item.unit
        ? `${item.totalQuantity} ${item.unit}`
        : String(item.totalQuantity);
  return {
    name,
    ...(quantity != null && { quantity }),
    ...(details != null && { details }),
    ...(categoryMatchId != null && { categoryMatchId }),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const anylistEmail = process.env.ANYLIST_EMAIL;
  const anylistPassword = process.env.ANYLIST_PASSWORD;
  const targetList = process.env.ANYLIST_TARGET_LIST;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      success: false,
      error: "SUPABASE_URL and SUPABASE_ANON_KEY must be configured",
    });
  }
  if (!anylistEmail || !anylistPassword || !targetList) {
    return res.status(500).json({
      success: false,
      error:
        "ANYLIST_EMAIL, ANYLIST_PASSWORD, and ANYLIST_TARGET_LIST must be configured",
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing bearer token" });
  }
  const accessToken = authHeader.slice("Bearer ".length);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userData?.user?.email) {
    return res.status(401).json({ success: false, error: "Invalid session" });
  }

  if (!ALLOWED_EMAILS.has(userData.user.email)) {
    return res.status(403).json({ success: false, error: "Not authorized" });
  }

  const body = req.body as SyncRequest | undefined;
  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "items must be a non-empty array" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = new (AnyList as any)({
    email: anylistEmail,
    password: anylistPassword,
  });

  try {
    await any.login();
    await any.getLists();

    const list = any.getListByName(targetList);
    if (!list) {
      return res.status(404).json({
        success: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: `List "${targetList}" not found. Available: ${(any.lists ?? []).map((l: any) => l.name).join(", ")}`,
      });
    }

    // Sync semantics: clear the target list first, then add the current
    // grocery items. This makes the AnyList list a faithful mirror of the
    // current Recipe Club grocery list rather than appending each click.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = (list.items ?? []) as any[];

    let removed = 0;
    for (const existingItem of existing) {
      await list.removeItem(existingItem);
      removed++;
    }

    let added = 0;
    for (const item of body.items) {
      const formatted = formatItemForAnyList(item);
      const created = any.createItem(formatted);
      await list.addItem(created);
      added++;
    }

    return res.status(200).json({
      success: true,
      itemsAdded: added,
      itemsRemoved: removed,
      listName: targetList,
      eventName: body.eventName,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    try {
      any.teardown?.();
    } catch {
      // ignore
    }
  }
}
