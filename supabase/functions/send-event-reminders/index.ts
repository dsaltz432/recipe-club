import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAILS = [
  "sarahgsaltz@gmail.com",
  "dsaltz190@gmail.com",
];

const REMINDER_DAYS = [7, 3];
const APP_BASE_URL = "https://therecipeclubhub.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledEvent {
  id: string;
  event_date: string;
  event_time: string | null;
  status: string;
  ingredient: {
    name: string;
  } | null;
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
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate target dates (7 days and 1 day from now) using UTC
    const today = new Date();
    const targetDates = REMINDER_DAYS.map((days) => {
      const date = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() + days
      ));
      return {
        days,
        dateString: date.toISOString().split("T")[0],
      };
    });

    const results: { sent: number; errors: string[] } = { sent: 0, errors: [] };

    for (const { days, dateString } of targetDates) {
      // Get scheduled events for this target date
      const { data: events, error: eventsError } = await supabase
        .from("scheduled_events")
        .select(`
          id,
          event_date,
          event_time,
          status,
          ingredient:ingredients(name)
        `)
        .eq("event_date", dateString)
        .eq("status", "scheduled");

      if (eventsError) {
        results.errors.push(`Error fetching events for ${dateString}: ${eventsError.message}`);
        continue;
      }

      if (!events || events.length === 0) {
        console.log(`No scheduled events found for ${dateString}`);
        continue;
      }

      // Get admin users from auth.users table to check recipe status
      const { data: adminUsers, error: adminError } = await supabase.auth.admin.listUsers();

      if (adminError) {
        console.log(`Warning: Could not fetch admin users: ${adminError.message}`);
      }

      // Create a map of email -> user_id for admins who have signed up
      const adminEmailToUserId = new Map<string, string>();
      if (adminUsers?.users) {
        for (const user of adminUsers.users) {
          if (user.email && ADMIN_EMAILS.includes(user.email)) {
            adminEmailToUserId.set(user.email, user.id);
          }
        }
      }

      // Process each event
      for (const event of events as ScheduledEvent[]) {
        const ingredientName = event.ingredient?.name || "the ingredient";

        // Check which users have locked in recipes for this event
        const { data: recipes, error: recipesError } = await supabase
          .from("recipes")
          .select("created_by")
          .eq("event_id", event.id);

        if (recipesError) {
          results.errors.push(`Error fetching recipes for event ${event.id}: ${recipesError.message}`);
          continue;
        }

        const usersWithRecipes = new Set(recipes?.map((r) => r.created_by).filter(Boolean) || []);

        // Send emails to ALL admin emails (not just those who have signed up)
        for (const adminEmail of ADMIN_EMAILS) {
          const userId = adminEmailToUserId.get(adminEmail);
          const hasRecipe = userId ? usersWithRecipes.has(userId) : false;

          const emailResult = await sendReminderEmail(
            resendApiKey,
            adminEmail,
            ingredientName,
            event.event_date,
            event.event_time,
            days,
            hasRecipe,
            event.id
          );

          if (emailResult.success) {
            results.sent++;
            console.log(`Sent ${days}-day reminder to ${adminEmail} (hasRecipe: ${hasRecipe})`);
          } else {
            results.errors.push(`Failed to send email to ${adminEmail}: ${emailResult.error}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${results.sent} reminder emails`,
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in send-event-reminders:", error);
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

async function sendReminderEmail(
  apiKey: string,
  toEmail: string,
  ingredientName: string,
  eventDate: string,
  eventTime: string | null,
  daysUntilEvent: number,
  hasLockedInRecipe: boolean,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  const formattedDate = new Date(eventDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format time from 24-hour (19:00) to 12-hour (7pm)
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "pm" : "am";
    const hour12 = hours % 12 || 12;
    if (minutes === 0) {
      return `${hour12}${period}`;
    }
    return `${hour12}:${minutes.toString().padStart(2, "0")}${period}`;
  };

  const timeString = eventTime ? ` at ${formatTime(eventTime)}` : "";
  const daysText = daysUntilEvent === 1 ? "tomorrow" : `in ${daysUntilEvent} days`;
  const eventUrl = `${APP_BASE_URL}/events/${eventId}`;

  let subject: string;
  let bodyHtml: string;

  if (hasLockedInRecipe) {
    subject = `Get excited! ${ingredientName} Recipe Club is ${daysText}!`;
    bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #9b87f5;">Get Excited for Recipe Club!</h1>
        <p>Hey there!</p>
        <p>Recipe Club is coming up <strong>${daysText}</strong> on <strong>${formattedDate}${timeString}</strong>!</p>
        <p>This week's featured ingredient is <strong style="color: #F97316;">${ingredientName}</strong>.</p>
        <p>You've already locked in your recipe - great job! We can't wait to see what you've prepared.</p>
        <p style="margin: 20px 0;">
          <a href="${eventUrl}" style="background-color: #9b87f5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Event Details</a>
        </p>
        <p>See you soon!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Recipe Club</p>
      </div>
    `;
  } else {
    subject = `Reminder: Lock in your ${ingredientName} recipe ${daysText}!`;
    bodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #9b87f5;">Don't Forget to Lock In Your Recipe!</h1>
        <p>Hey there!</p>
        <p>Recipe Club is coming up <strong>${daysText}</strong> on <strong>${formattedDate}${timeString}</strong>!</p>
        <p>This week's featured ingredient is <strong style="color: #F97316;">${ingredientName}</strong>.</p>
        <p><strong>Remember to lock in your recipe!</strong> Head over to the app and submit your dish before the event.</p>
        <p style="margin: 20px 0;">
          <a href="${eventUrl}" style="background-color: #9b87f5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Lock In Your Recipe</a>
        </p>
        <p>We're excited to see what you'll cook up!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Recipe Club</p>
      </div>
    `;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Recipe Club <reminders@therecipeclubhub.com>",
        to: [toEmail],
        subject,
        html: bodyHtml,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return { success: false, error: errorData };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending email",
    };
  }
}
