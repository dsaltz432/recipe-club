import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShareRequest {
  recipeId: string;
  recipeName: string;
  sharedWithEmail: string;
  message?: string;
  sharedByUserId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ShareRequest = await req.json();
    const { recipeId, recipeName, sharedWithEmail, message, sharedByUserId } = body;

    if (!recipeId || !sharedWithEmail || !sharedByUserId) {
      throw new Error("recipeId, sharedWithEmail, and sharedByUserId are required");
    }

    // Create the share record
    const { error: shareError } = await supabase
      .from("recipe_shares")
      .insert({
        recipe_id: recipeId,
        shared_by: sharedByUserId,
        shared_with_email: sharedWithEmail.toLowerCase(),
        message: message || null,
      });

    if (shareError) {
      if (shareError.code === "23505") {
        throw new Error("This recipe has already been shared with this email");
      }
      throw new Error(`Failed to create share: ${shareError.message}`);
    }

    // Auto-add recipient to allowed_users as share_only if not already present
    const { data: existingUser } = await supabase
      .from("allowed_users")
      .select("id")
      .eq("email", sharedWithEmail.toLowerCase())
      .maybeSingle();

    if (!existingUser) {
      await supabase
        .from("allowed_users")
        .insert({
          email: sharedWithEmail.toLowerCase(),
          role: "viewer",
          is_club_member: false,
          access_type: "share_only",
        });
    }

    // Get the sharer's name for the email
    const { data: sharerData } = await supabase.auth.admin.getUserById(sharedByUserId);
    const sharerEmail = sharerData?.user?.email || "Someone";

    // Look up profile name
    const { data: profileData } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", sharedByUserId)
      .maybeSingle();

    const sharerName = profileData?.name || sharerEmail;

    // Send email notification
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured — skipping share email");
      return new Response(
        JSON.stringify({ success: true, emailSent: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://therecipeclubhub.com";

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #9b87f5;">Recipe Shared With You!</h1>
        <p>Hey there!</p>
        <p><strong>${sharerName}</strong> shared a recipe with you:</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0; font-size: 18px;"><strong>${recipeName}</strong></p>
          ${message ? `<p style="color: #666; font-style: italic;">"${message}"</p>` : ""}
        </div>
        <p>
          <a href="${siteUrl}/dashboard/recipes" style="display: inline-block; background: #9b87f5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            View Recipe
          </a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">
          Sign in to Recipe Club Hub to view this recipe and any others shared with you.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Recipe Club Hub</p>
      </div>
    `;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Recipe Club Hub <notifications@therecipeclubhub.com>",
          to: [sharedWithEmail],
          subject: `${sharerName} shared a recipe with you!`,
          html: emailHtml,
        }),
      });

      if (!response.ok) {
        console.error("Failed to send share email:", await response.text());
      }
    } catch (emailError) {
      console.error("Error sending share email:", emailError);
    }

    return new Response(
      JSON.stringify({ success: true, emailSent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-recipe-share:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error instanceof Error && error.message.includes("already been shared") ? 409 : 500,
      }
    );
  }
});
