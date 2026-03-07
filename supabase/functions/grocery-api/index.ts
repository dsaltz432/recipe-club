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

    return jsonResponse({
      week,
      generalItems: generalResult.data ?? [],
      combinedList: combinedItems && combinedItems.length > 0 ? combinedItems : null,
      combinedLastUpdated: combinedRow?.updated_at ?? null,
    });
  }

  // POST — add item to general list
  if (req.method === "POST") {
    let body: { name?: string; quantity?: string; unit?: string; week?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const name = body.name?.trim();
    if (!name) {
      return jsonResponse({ error: "name is required" }, 400);
    }

    // Use week from body if provided, otherwise fall back to query param / current week
    const targetWeek = body.week ?? week;
    const targetContextId = targetWeek;

    const { data, error } = await supabase
      .from("general_grocery_items")
      .insert({
        user_id: userId,
        context_type: contextType,
        context_id: targetContextId,
        name,
        quantity: body.quantity ?? null,
        unit: body.unit ?? null,
      })
      .select("id, name, quantity, unit, created_at")
      .single();

    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ success: true, week: targetWeek, item: data });
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
