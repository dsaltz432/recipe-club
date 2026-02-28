import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

async function lookupUserId(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (error || !data) {
    // Fallback: query auth.users via admin API
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError || !authData?.users) return null;
    const user = authData.users.find(
      (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()
    );
    return user?.id ?? null;
  }
  return data.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const groceryApiKey = Deno.env.get("GROCERY_API_KEY");

    if (!groceryApiKey) {
      return jsonResponse({
        success: true,
        skipped: true,
        message: "GROCERY_API_KEY not configured",
      });
    }

    // Validate API key
    const requestApiKey = req.headers.get("x-api-key");
    if (!requestApiKey || requestApiKey !== groceryApiKey) {
      return jsonResponse(
        { success: false, error: "Invalid or missing API key" },
        401
      );
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const method = req.method;

    if (method === "GET") {
      // GET: list items — query params: user_email, context_type, context_id
      const url = new URL(req.url);
      const userEmail = url.searchParams.get("user_email");
      const contextType = url.searchParams.get("context_type");
      const contextId = url.searchParams.get("context_id");

      if (!userEmail || !contextType || !contextId) {
        return jsonResponse(
          { success: false, error: "Missing required query params: user_email, context_type, context_id" },
          400
        );
      }

      const userId = await lookupUserId(supabase, userEmail);
      if (!userId) {
        return jsonResponse({ success: false, error: "User not found" }, 404);
      }

      const { data, error } = await supabase
        .from("general_grocery_items")
        .select("*")
        .eq("user_id", userId)
        .eq("context_type", contextType)
        .eq("context_id", contextId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return jsonResponse({ success: true, items: data || [] });
    }

    // For POST, PUT, DELETE — parse body
    const body = await req.json();

    if (method === "POST") {
      // POST: add items — body: { user_email, context_type, context_id, items: [{ name, quantity?, unit? }] }
      const { user_email, context_type, context_id, items } = body;

      if (!user_email || !context_type || !context_id) {
        return jsonResponse(
          { success: false, error: "Missing required fields: user_email, context_type, context_id" },
          400
        );
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return jsonResponse(
          { success: false, error: "Items array is empty or missing" },
          400
        );
      }

      const userId = await lookupUserId(supabase, user_email);
      if (!userId) {
        return jsonResponse({ success: false, error: "User not found" }, 404);
      }

      const rows = items.map((item: { name: string; quantity?: string; unit?: string }) => ({
        user_id: userId,
        context_type,
        context_id,
        name: item.name,
        quantity: item.quantity || null,
        unit: item.unit || null,
      }));

      const { error } = await supabase
        .from("general_grocery_items")
        .insert(rows);

      if (error) {
        // Check for unique constraint violation (duplicate item)
        if (error.code === "23505") {
          return jsonResponse(
            { success: false, error: "Duplicate item: an item with this name already exists for this user and context" },
            409
          );
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return jsonResponse({ success: true, added: rows.length });
    }

    if (method === "PUT") {
      // PUT: update item — body: { item_id, name?, quantity?, unit? }
      const { item_id, name, quantity, unit } = body;

      if (!item_id) {
        return jsonResponse(
          { success: false, error: "Missing required field: item_id" },
          400
        );
      }

      const updates: Record<string, string | null> = {};
      if (name !== undefined) updates.name = name;
      if (quantity !== undefined) updates.quantity = quantity;
      if (unit !== undefined) updates.unit = unit;

      if (Object.keys(updates).length === 0) {
        return jsonResponse(
          { success: false, error: "No fields to update" },
          400
        );
      }

      const { error } = await supabase
        .from("general_grocery_items")
        .update(updates)
        .eq("id", item_id);

      if (error) {
        if (error.code === "23505") {
          return jsonResponse(
            { success: false, error: "Duplicate item: an item with this name already exists for this user and context" },
            409
          );
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return jsonResponse({ success: true });
    }

    if (method === "DELETE") {
      // DELETE: remove item — body: { item_id }
      const { item_id } = body;

      if (!item_id) {
        return jsonResponse(
          { success: false, error: "Missing required field: item_id" },
          400
        );
      }

      const { error } = await supabase
        .from("general_grocery_items")
        .delete()
        .eq("id", item_id);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse(
      { success: false, error: `Unsupported method: ${method}` },
      405
    );
  } catch (error) {
    console.error("Error in grocery-items-api:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
