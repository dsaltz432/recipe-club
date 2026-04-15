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

    const subject = "New Feature: Share Your Personal Events!";

    const bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #9b87f5;">Share Your Personal Events!</h1>
        <p>Hey there!</p>
        <p>The team here at Recipe Club Hub is working hard to bring you new features — and we're just getting started!</p>
        <p>With <strong>Dumplingfest</strong> right around the corner, we wanted to get this out just in time! We're excited to announce: <strong>Shareable Personal Events</strong>!</p>

        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 12px 0; font-weight: bold; color: #9b87f5;">Share Your Meals</p>
          <ul style="margin: 0 0 16px 0; padding-left: 20px; line-height: 1.8;">
            <li>Share any personal event with a <strong>single click</strong> — just hit the Share button</li>
            <li>A <strong>public link</strong> is copied to your clipboard, ready to send to friends and family</li>
            <li>Guests can view your recipes, ingredients, instructions, and notes — <strong>no sign-up required</strong></li>
            <li>Recipes are <strong>collapsible</strong> for easy browsing</li>
          </ul>

          <p style="margin: 0 0 12px 0; font-weight: bold; color: #9b87f5;">Per-Recipe Cook Mode</p>
          <ul style="margin: 0 0 16px 0; padding-left: 20px; line-height: 1.8;">
            <li>Cook Mode now works on <strong>individual recipes</strong> — look for the Cook button on each recipe card</li>
            <li>Get step-by-step guided instructions for any single recipe</li>
          </ul>
        </div>

        <p>These features are perfect for sharing your Dumplingfest recipes with guests ahead of time. Get your event set up, hit Share, and everyone will have the full menu at their fingertips!</p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://therecipeclubhub.com" style="background: #9b87f5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Open Recipe Club Hub</a>
        </div>

        <p style="color: #555; font-size: 14px;">As always, <a href="http://bit.ly/4vxXiop" style="color: #9b87f5; font-weight: bold;">deposits</a> are always appreciated!</p>

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
