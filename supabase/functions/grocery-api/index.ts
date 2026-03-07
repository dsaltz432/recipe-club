import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function getCurrentWeekStart(): string {
  const now = new Date();
  const diff = now.getDay(); // days since Sunday
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().split("T")[0];
}

function fallbackParseGroceryText(text: string): Array<{ name: string; quantity: string | null; unit: string | null; category: string }> {
  return text
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ name, quantity: null, unit: null, category: "other" }));
}

// Mirrors formatGroceryItem from src/lib/groceryList.ts
const FRACTION_MAP: [number, string][] = [
  [0.125, "1/8"], [0.25, "1/4"], [0.333, "1/3"], [0.375, "3/8"],
  [0.5, "1/2"], [0.625, "5/8"], [0.667, "2/3"], [0.75, "3/4"], [0.875, "7/8"],
];

function decimalToFraction(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const whole = Math.floor(value);
  const decimal = value - whole;
  for (const [target, fraction] of FRACTION_MAP) {
    if (Math.abs(decimal - target) < 0.02) {
      return whole > 0 ? `${whole} ${fraction}` : fraction;
    }
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}

const ABBREVIATION_UNITS = new Set(["tsp", "tbsp", "oz", "lb", "g", "kg", "ml"]);
const NAME_FIRST_UNITS = new Set(["stalk", "strip", "ear", "clove", "head", "bunch", "sprig", "piece", "slice", "rib"]);
const UNIT_PLURAL_MAP: Record<string, string> = {
  stalk: "stalks", strip: "strips", ear: "ears", clove: "cloves", head: "heads",
  bunch: "bunches", sprig: "sprigs", piece: "pieces", slice: "slices", rib: "ribs",
  can: "cans", bottle: "bottles", cup: "cups", pinch: "pinches", dash: "dashes", liter: "liters",
};

function pluralizeUnit(unit: string, quantity: number): string {
  if (quantity <= 1) return unit;
  if (ABBREVIATION_UNITS.has(unit)) return unit;
  return UNIT_PLURAL_MAP[unit] ?? unit;
}

function formatSmartItem(item: { displayName?: string; name: string; totalQuantity?: number | null; unit?: string | null }): string {
  const parts: string[] = [];
  const qty = item.totalQuantity;
  if (qty != null) parts.push(decimalToFraction(qty));
  const name = item.displayName || item.name;
  const isNameFirst = item.unit != null && NAME_FIRST_UNITS.has(item.unit);
  if (isNameFirst) {
    parts.push(name);
    parts.push(qty != null ? pluralizeUnit(item.unit!, qty) : item.unit!);
  } else {
    if (item.unit) parts.push(qty != null ? pluralizeUnit(item.unit, qty) : item.unit);
    parts.push(name);
  }
  return parts.join(" ");
}

function formatItemText(item: { name: string; quantity?: string | null; unit?: string | null }): string {
  const qty = item.quantity != null ? parseFloat(item.quantity) : null;
  return formatSmartItem({
    name: item.name,
    totalQuantity: qty != null && !isNaN(qty) ? qty : null,
    unit: item.unit,
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authenticate with custom API key
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("GROCERY_API_KEY");
  if (!apiKey || apiKey !== expectedKey) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userId = Deno.env.get("GROCERY_API_USER_ID")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const week = url.searchParams.get("week") ?? getCurrentWeekStart();
  const view = url.searchParams.get("view");
  const contextType = "meal_plan";
  const contextId = week;

  // GET — return general items and combined list
  if (req.method === "GET") {
    const [generalResult, combinedResult] = await Promise.all([
      supabase
        .from("general_grocery_items")
        .select("id, name, quantity, unit, created_at")
        .eq("user_id", userId)
        .eq("context_type", contextType)
        .eq("context_id", contextId)
        .order("created_at", { ascending: true }),
      supabase
        .from("combined_grocery_items")
        .select("items, per_recipe_items, updated_at")
        .eq("user_id", userId)
        .eq("context_type", contextType)
        .eq("context_id", contextId)
        .maybeSingle(),
    ]);

    const combinedRow = combinedResult.data as Record<string, unknown> | null;
    const combinedItems = combinedRow?.items as unknown[] | null;

    if (view === "simple") {
      // Use combined list when available (matches website display with pluralization etc.)
      if (combinedItems && combinedItems.length > 0) {
        return jsonResponse({
          items: (combinedItems as Array<{ displayName?: string; name: string; totalQuantity?: number | null; unit?: string | null }>)
            .map(formatSmartItem),
        });
      }
      // Fall back to raw general items
      const items = (generalResult.data ?? []) as Array<{ name: string; quantity?: string | null; unit?: string | null }>;
      return jsonResponse({ items: items.map(formatItemText) });
    }

    return jsonResponse({
      week,
      generalItems: generalResult.data ?? [],
      combinedList: combinedItems && combinedItems.length > 0 ? combinedItems : null,
      combinedLastUpdated: combinedRow?.updated_at ?? null,
    });
  }

  // POST — add item(s) to general list via freeform text
  if (req.method === "POST") {
    let body: { text?: string; week?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const text = body.text?.trim();
    if (!text) {
      return jsonResponse({ error: "text is required" }, 400);
    }

    // Use week from body if provided, otherwise fall back to query param / current week
    const targetWeek = body.week ?? week;
    const targetContextId = targetWeek;

    // Delegate to parse-recipe in parse-only mode (no recipeId = no DB writes)
    let parsedItems: Array<{ name: string; quantity: string | null; unit: string | null; category: string }>;

    const { data: parseResult, error: parseError } = await supabase.functions.invoke("parse-recipe", {
      body: { recipeName: "Grocery Items", text },
    });

    if (parseError || !parseResult?.success || parseResult.skipped) {
      parsedItems = fallbackParseGroceryText(text);
    } else {
      const ingredients = parseResult.parsed?.ingredients ?? [];
      if (ingredients.length > 0) {
        parsedItems = ingredients.map((item: Record<string, unknown>) => ({
          name: String(item.name || "").trim(),
          quantity: item.quantity != null ? String(item.quantity) : null,
          unit: item.unit != null ? String(item.unit) : null,
          category: String(item.category || "other"),
        })).filter((item: { name: string }) => item.name.length > 0);
      } else {
        parsedItems = fallbackParseGroceryText(text);
      }
    }

    if (parsedItems.length === 0) {
      return jsonResponse({ error: "No items could be parsed from text" }, 400);
    }

    // Insert all parsed items
    const rows = parsedItems.map((item) => ({
      user_id: userId,
      context_type: contextType,
      context_id: targetContextId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    }));

    const { data, error } = await supabase
      .from("general_grocery_items")
      .insert(rows)
      .select("id, name, quantity, unit, created_at");

    if (error) return jsonResponse({ error: error.message }, 500);

    if (view === "simple") {
      const items = (data ?? []) as Array<{ name: string; quantity?: string | null; unit?: string | null }>;
      return jsonResponse({ items: items.map(formatItemText) });
    }

    return jsonResponse({ success: true, week: targetWeek, items: data });
  }

  // DELETE — remove item from general list by id
  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ error: "id query param is required" }, 400);

    const { error } = await supabase
      .from("general_grocery_items")
      .delete()
      .eq("id", id)
      .eq("user_id", userId); // ensure ownership

    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
