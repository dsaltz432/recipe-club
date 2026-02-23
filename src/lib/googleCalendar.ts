import { supabase } from "@/integrations/supabase/client";
import { getClubMemberEmails } from "./auth";
import { isDevMode } from "./devMode";

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
  if (isDevMode()) {
    console.log("[DEV MODE] Skipping Google Calendar create for:", ingredientName);
    return { success: true, eventId: `dev-calendar-${Date.now()}` };
  }

  try {
    const clubMemberEmails = await getClubMemberEmails();

    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: {
        action: "create",
        date: date.toISOString(),
        time: time || "19:00",
        ingredientName,
        attendeeEmails: clubMemberEmails,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data.success, eventId: data.eventId, error: data.error };
  } catch (error) {
    console.error("Error creating calendar event:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
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
  if (isDevMode()) {
    console.log("[DEV MODE] Skipping Google Calendar update for:", calendarEventId);
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: {
        action: "update",
        calendarEventId,
        date: date.toISOString(),
        time: time || "19:00",
        ingredientName,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data.success, error: data.error };
  } catch (error) {
    console.error("Error updating calendar event:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const deleteCalendarEvent = async (
  calendarEventId: string
): Promise<{ success: boolean; error?: string }> => {
  if (isDevMode()) {
    console.log("[DEV MODE] Skipping Google Calendar delete for:", calendarEventId);
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: {
        action: "delete",
        calendarEventId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data.success, error: data.error };
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
