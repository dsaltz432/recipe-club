import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  action: "create" | "update" | "delete";
  calendarEventId?: string;
  date?: string; // ISO string
  time?: string; // "HH:mm"
  ingredientName?: string;
  attendeeEmails?: string[];
}

interface CalendarResponse {
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Exchange a stored refresh token for a fresh Google access token.
 */
async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured as Supabase secrets"
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to refresh Google token: ${errorData.error_description || errorData.error || "Unknown error"}`
    );
  }

  const { access_token } = await response.json();
  return access_token;
}

/**
 * Create a Google Calendar event with attendees, Google Meet, and reminders.
 */
async function createEvent(
  accessToken: string,
  body: RequestBody
): Promise<CalendarResponse> {
  const { date, time, ingredientName, attendeeEmails } = body;

  if (!date || !ingredientName) {
    return { success: false, error: "date and ingredientName are required for create" };
  }

  const eventTime = time || "19:00";
  const [hours, minutes] = eventTime.split(":").map(Number);

  const startDateTime = new Date(date);
  startDateTime.setHours(hours, minutes, 0, 0);

  const endDateTime = new Date(startDateTime);
  endDateTime.setHours(endDateTime.getHours() + 2);

  const event = {
    summary: `Recipe Club: ${ingredientName}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: "America/New_York",
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: "America/New_York",
    },
    attendees: (attendeeEmails || []).map((email: string) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: `recipe-club-${Date.now()}`,
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 60 },
      ],
    },
  };

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Google Calendar API error (create):", errorData);
    return {
      success: false,
      error: errorData.error?.message || "Failed to create calendar event",
    };
  }

  const calendarEvent = await response.json();
  return { success: true, eventId: calendarEvent.id };
}

/**
 * Update an existing Google Calendar event.
 */
async function updateEvent(
  accessToken: string,
  body: RequestBody
): Promise<CalendarResponse> {
  const { calendarEventId, date, time, ingredientName } = body;

  if (!calendarEventId || !date || !ingredientName) {
    return {
      success: false,
      error: "calendarEventId, date, and ingredientName are required for update",
    };
  }

  const eventTime = time || "19:00";
  const [hours, minutes] = eventTime.split(":").map(Number);

  const startDateTime = new Date(date);
  startDateTime.setHours(hours, minutes, 0, 0);

  const endDateTime = new Date(startDateTime);
  endDateTime.setHours(endDateTime.getHours() + 2);

  const event = {
    summary: `Recipe Club: ${ingredientName}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: "America/New_York",
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: "America/New_York",
    },
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Google Calendar API error (update):", errorData);
    return {
      success: false,
      error: errorData.error?.message || "Failed to update calendar event",
    };
  }

  return { success: true };
}

/**
 * Delete a Google Calendar event.
 */
async function deleteEvent(
  accessToken: string,
  body: RequestBody
): Promise<CalendarResponse> {
  const { calendarEventId } = body;

  if (!calendarEventId) {
    return { success: false, error: "calendarEventId is required for delete" };
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // 404 = already deleted, treat as success
  if (!response.ok && response.status !== 404) {
    const errorData = await response.json();
    console.error("Google Calendar API error (delete):", errorData);
    return {
      success: false,
      error: errorData.error?.message || "Failed to delete calendar event",
    };
  }

  return { success: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Warn if Google credentials are missing
    if (!Deno.env.get("GOOGLE_CLIENT_ID") || !Deno.env.get("GOOGLE_CLIENT_SECRET")) {
      console.warn(
        "GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET not configured. " +
        "Set these as Supabase secrets for Google Calendar integration."
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "Google Calendar credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Supabase secrets.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Extract user ID from the Authorization JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Use the user's JWT to identify them, but service role to read user_tokens
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Use service role to read user_tokens (RLS would also work since we have the user JWT,
    // but service role is more reliable for server-side operations)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("user_tokens")
      .select("refresh_token")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .single();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No Google refresh token found. Please sign out and sign in again with Google to grant calendar access.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Exchange refresh token for a fresh access token
    const accessToken = await getAccessToken(tokenRow.refresh_token);

    // Parse request body
    const body: RequestBody = await req.json();
    const { action } = body;

    let result: CalendarResponse;

    switch (action) {
      case "create":
        result = await createEvent(accessToken, body);
        break;
      case "update":
        result = await updateEvent(accessToken, body);
        break;
      case "delete":
        result = await deleteEvent(accessToken, body);
        break;
      default:
        result = {
          success: false,
          error: `Unknown action: ${action}. Supported actions: create, update, delete`,
        };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error("Error in google-calendar:", error);
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
