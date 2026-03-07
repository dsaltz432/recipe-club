import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured — skipping contact email");
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { name, email, type, message } = await req.json();

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Message is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const truncatedMessage = message.length > 60
      ? message.slice(0, 60) + "..."
      : message;
    const subject = `[Recipe Club Hub] ${type}: ${truncatedMessage}`;

    const bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #9b87f5;">New Contact Message</h2>
        <p><strong>From:</strong> ${name || "Unknown"} &lt;${email || "no email"}&gt;</p>
        <p><strong>Type:</strong> ${type}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Recipe Club Hub <noreply@therecipeclubhub.com>",
        to: ["contact@therecipeclubhub.com"],
        reply_to: email || undefined,
        subject,
        html: bodyHtml,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Resend API error: ${errorData}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-contact-email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
