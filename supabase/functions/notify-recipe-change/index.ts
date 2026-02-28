import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_MODE_EMAIL = "dsaltz190@gmail.com";

function isLocalMode(): boolean {
  if (Deno.env.get("LOCAL_MODE") === "true") return true;
  const url = Deno.env.get("SUPABASE_URL") || "";
  return url.includes("127.0.0.1") || url.includes("localhost");
}

interface NotifyRequest {
  type: "added" | "updated" | "deleted";
  recipeName: string;
  recipeUrl?: string;
  ingredientName?: string;
  eventDate?: string;
  excludeUserId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured — skipping email notifications");
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyRequest = await req.json();
    const { type, recipeName, recipeUrl, ingredientName, eventDate, excludeUserId } = body;

    if (!recipeName) {
      throw new Error("recipeName is required");
    }

    // Get all club members from allowed_users
    const { data: clubMembers, error: membersError } = await supabase
      .from("allowed_users")
      .select("email")
      .eq("is_club_member", true);

    if (membersError) {
      throw new Error(`Failed to fetch club members: ${membersError.message}`);
    }

    if (!clubMembers || clubMembers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No club members to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user who made the change (to exclude from notifications)
    let excludeEmail: string | null = null;
    if (excludeUserId) {
      const { data: userData } = await supabase.auth.admin.getUserById(excludeUserId);
      excludeEmail = userData?.user?.email || null;
    }

    // Filter out the user who made the change
    let recipientEmails = clubMembers
      .map((m) => m.email)
      .filter((email) => email !== excludeEmail);

    // In local/test mode, only send to the test account
    if (isLocalMode()) {
      console.log(`[LOCAL MODE] Restricting notifications to ${TEST_MODE_EMAIL}`);
      recipientEmails = [TEST_MODE_EMAIL];
    }

    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No other club members to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format the event date if provided
    const formattedDate = eventDate
      ? new Date(eventDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    // Build email content
    const subjectMap: Record<string, string> = {
      added: `New recipe added for ${ingredientName || "Recipe Club"}!`,
      updated: `Recipe updated for ${ingredientName || "Recipe Club"}!`,
      deleted: `Recipe removed from ${ingredientName || "Recipe Club"} event`,
    };
    const subject = subjectMap[type];

    const headingMap: Record<string, string> = {
      added: "New Recipe Added!",
      updated: "Recipe Updated!",
      deleted: "Recipe Removed",
    };

    const messageMap: Record<string, string> = {
      added: `A new recipe has been added for the <strong style="color: #F97316;">${ingredientName || "upcoming"}</strong> event${formattedDate ? ` on ${formattedDate}` : ""}!`,
      updated: `A recipe has been updated for the <strong style="color: #F97316;">${ingredientName || "upcoming"}</strong> event${formattedDate ? ` on ${formattedDate}` : ""}!`,
      deleted: `A recipe has been removed from the <strong style="color: #F97316;">${ingredientName || "upcoming"}</strong> event${formattedDate ? ` on ${formattedDate}` : ""}.`,
    };

    const ctaMap: Record<string, string> = {
      added: "Check it out and get inspired!",
      updated: "The recipe link has been updated - check out the new version!",
      deleted: "Head to the event to see the latest lineup.",
    };

    const bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #9b87f5;">${headingMap[type]}</h1>
        <p>Hey there!</p>
        <p>${messageMap[type]}</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0;"><strong>${recipeName}</strong></p>
          ${recipeUrl ? `<a href="${recipeUrl}" style="color: #9b87f5;">View Recipe</a>` : ""}
        </div>
        <p>${ctaMap[type]}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Recipe Club Hub</p>
      </div>
    `;

    // Send emails to all recipients
    const results = { sent: 0, errors: [] as string[] };

    for (const email of recipientEmails) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Recipe Club Hub <notifications@therecipeclubhub.com>",
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
          console.log(`Sent ${type} notification to ${email}`);
        }
      } catch (error) {
        results.errors.push(`Failed to send to ${email}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${results.sent} notification${results.sent !== 1 ? "s" : ""}`,
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in notify-recipe-change:", error);
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
