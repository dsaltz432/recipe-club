import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductUpdateRequest {
  emails: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured — skipping product update emails");
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ProductUpdateRequest = await req.json();
    const { emails } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new Error("emails is required and must be a non-empty array");
    }

    const subject = "New Feature: Shared Grocery Lists!";

    const bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #9b87f5;">Shared Grocery Lists Are Here!</h1>
        <p>Hey there!</p>
        <p>The team here at Recipe Club Hub is working hard to bring you new features — and we're just getting started!</p>
        <p>We're excited to announce: <strong>Shared Grocery Lists</strong> and <strong>Pantry Management</strong>!</p>

        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 12px 0; font-weight: bold; color: #9b87f5;">Grocery List</p>
          <ul style="margin: 0 0 16px 0; padding-left: 20px; line-height: 1.8;">
            <li>A shared grocery list is now available on every event page</li>
            <li>Ingredients are <strong>smartly combined</strong> across all recipes in the event</li>
            <li>View the combined list or filter by individual recipe</li>
            <li>Export your list as a <strong>CSV</strong> to take with you</li>
          </ul>

          <p style="margin: 0 0 12px 0; font-weight: bold; color: #9b87f5;">Pantry</p>
          <ul style="margin: 0 0 16px 0; padding-left: 20px; line-height: 1.8;">
            <li>Add items you already have at home to <strong>My Pantry</strong></li>
            <li>Pantry items are automatically <strong>excluded</strong> from your grocery list</li>
            <li>No more buying salt and pepper every single time!</li>
          </ul>
        </div>

        <p>Head over to your next event to try it out!</p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://therecipeclubhub.com" style="background: #9b87f5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Open Recipe Club Hub</a>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Recipe Club Hub</p>
      </div>
    `;

    const results = { sent: 0, errors: [] as string[] };

    for (const email of emails) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Recipe Club Hub <updates@therecipeclubhub.com>",
            to: [email],
            subject,
            html: bodyHtml,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          results.errors.push(`Failed to send to ${email}: ${errorData}`);
        } else {
          results.sent++;
          console.log(`Sent product update to ${email}`);
        }
      } catch (error) {
        results.errors.push(`Failed to send to ${email}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.sent,
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in recipe-club-product-update:", error);
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
