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

function formatItemText(item: { name: string; quantity?: string | null; unit?: string | null }): string {
  const parts: string[] = [];
  if (item.quantity) parts.push(item.quantity);
  if (item.unit) parts.push(item.unit);
  parts.push(item.name);
  return parts.join(" ");
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
