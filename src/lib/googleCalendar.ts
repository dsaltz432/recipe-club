import { supabase } from "@/integrations/supabase/client";
import { getClubMemberEmails } from "./auth";

interface CalendarEventParams {
  date: Date;
  time?: string; // Format: "HH:mm" e.g., "19:00" - defaults to "19:00"
  ingredientName: string;
}

export const createCalendarEvent = async ({
  date,
  time,
  ingredientName,
}: CalendarEventParams): Promise<{ success: boolean; eventId?: string; error?: string }> => {
  try {
    // Get the current session to access the provider token
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      return { success: false, error: "No active session" };
    }

    const providerToken = sessionData.session.provider_token;

    if (!providerToken) {
      console.warn("No provider token available for Google Calendar. Calendar scope may not be enabled.");
      return {
        success: false,
        error: "Google Calendar access not available. Please re-login with calendar permissions."
      };
    }

    // Parse the time (format: "HH:mm"), default to 7pm
    const eventTime = time || "19:00";
    const [hours, minutes] = eventTime.split(":").map(Number);

    // Create start datetime
    const startDateTime = new Date(date);
    startDateTime.setHours(hours, minutes, 0, 0);

    // Create end datetime (2 hours after start)
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 2);

    // Get club member emails for calendar invites
    const clubMemberEmails = await getClubMemberEmails();

    // Build the event object with timed event and Google Meet
    const event = {
      summary: `Recipe Club: ${ingredientName}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: clubMemberEmails.map((email) => ({ email })),
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
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "popup", minutes: 60 }, // 1 hour before
        ],
      },
    };

    // Create the calendar event using Google Calendar API (conferenceDataVersion=1 enables Meet link)
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Calendar API error:", errorData);

      if (response.status === 401) {
        return {
          success: false,
          error: "Calendar access expired. Please sign out and sign in again."
        };
      }

      return {
        success: false,
        error: errorData.error?.message || "Failed to create calendar event"
      };
    }

    const calendarEvent = await response.json();

    return { success: true, eventId: calendarEvent.id };
  } catch (error) {
    console.error("Error creating calendar event:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

interface UpdateCalendarEventParams {
  calendarEventId: string;
  date: Date;
  time?: string;
  ingredientName: string;
}

export const updateCalendarEvent = async ({
  calendarEventId,
  date,
  time,
  ingredientName,
}: UpdateCalendarEventParams): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      return { success: false, error: "No active session" };
    }

    const providerToken = sessionData.session.provider_token;

    if (!providerToken) {
      return {
        success: false,
        error: "Google Calendar access not available."
      };
    }

    // Parse the time (format: "HH:mm"), default to 7pm
    const eventTime = time || "19:00";
    const [hours, minutes] = eventTime.split(":").map(Number);

    // Create start datetime
    const startDateTime = new Date(date);
    startDateTime.setHours(hours, minutes, 0, 0);

    // Create end datetime (2 hours after start)
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 2);

    const event = {
      summary: `Recipe Club: ${ingredientName}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}?sendUpdates=all`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Calendar API error:", errorData);
      return {
        success: false,
        error: errorData.error?.message || "Failed to update calendar event"
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating calendar event:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

export const deleteCalendarEvent = async (
  calendarEventId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      return { success: false, error: "No active session" };
    }

    const providerToken = sessionData.session.provider_token;

    if (!providerToken) {
      return {
        success: false,
        error: "Google Calendar access not available."
      };
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}?sendUpdates=all`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const errorData = await response.json();
      console.error("Google Calendar API error:", errorData);
      return {
        success: false,
        error: errorData.error?.message || "Failed to delete calendar event"
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};
