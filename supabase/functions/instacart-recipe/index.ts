import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InstacartIngredient {
  name: string;
  display_text: string;
  measurements: { quantity: number; unit: string }[];
}

interface InstacartRecipePayload {
  title: string;
  ingredients: InstacartIngredient[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const instacartApiKey = Deno.env.get("INSTACART_API_KEY");

    if (!instacartApiKey) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: "INSTACART_API_KEY not configured",
          products_link_url: "https://www.instacart.com",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { title, items }: { title: string; items: { name: string; displayName: string; totalQuantity?: number | null; unit?: string | null }[] } = await req.json();

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Items array is empty or missing" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const ingredients: InstacartIngredient[] = items.map((item) => ({
      name: item.name,
      display_text: item.displayName,
      measurements:
        item.totalQuantity != null && item.unit
          ? [{ quantity: item.totalQuantity, unit: item.unit }]
          : [],
    }));

    const payload: InstacartRecipePayload = {
      title: title || "Grocery List",
      ingredients,
    };

    const instacartResponse = await fetch(
      "https://connect.instacart.com/idp/v1/products/recipe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${instacartApiKey}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!instacartResponse.ok) {
      const errorText = await instacartResponse.text();
      throw new Error(`Instacart API error: ${instacartResponse.status} - ${errorText}`);
    }

    const instacartResult = await instacartResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        products_link_url: instacartResult.products_link_url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in instacart-recipe:", error);
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
