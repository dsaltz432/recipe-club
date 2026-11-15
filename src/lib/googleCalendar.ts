import { supabase } from "@/integrations/supabase/client";
import { getClubMemberEmails } from "./auth";
import { isDevMode } from "./devMode";

export type CalendarConnectionStatus =
  | "connected"
  | "disconnected"
  | "missing_scope"
  | "missing"
  | "error";

/** Window event fired when some part of the app wants the reconnect prompt shown. */
export const CALENDAR_RECONNECT_EVENT = "google-calendar-reconnect";

export const requestCalendarReconnect = (): void => {
  window.dispatchEvent(new CustomEvent(CALENDAR_RECONNECT_EVENT));
};

interface CalendarFunctionResult {
  success?: boolean;
  eventId?: string;
  error?: string;
  status?: CalendarConnectionStatus;
  needsReconnect?: boolean;
}

/**
 * supabase.functions.invoke turns non-2xx responses into a generic
 * "Edge Function returned a non-2xx status code" error. The function's real
 * JSON body is on error.context (a Response) — read it so callers see the
 * actual reason and whether the user needs to reconnect.
 */
const readFunctionError = async (
  error: { message: string; context?: unknown }
): Promise<CalendarFunctionResult> => {
  const context = error.context as { json?: () => Promise<unknown> } | undefined;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as CalendarFunctionResult;
      if (body && typeof body === "object") {
        return { ...body, success: false, error: body.error || error.message };
      }
    } catch {
      // fall through to the generic message
    }
  }
  return { success: false, error: error.message };
};

/**
 * Ask the edge function whether the current user's Google connection works.
 * The function also records the result on user_tokens.last_status.
 */
export const checkCalendarConnection = async (): Promise<{
  status: CalendarConnectionStatus;
  needsReconnect: boolean;
}> => {
  if (isDevMode()) {
    return { status: "connected", needsReconnect: false };
  }
  try {
    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: { action: "status" },
    });
    const result: CalendarFunctionResult = error ? await readFunctionError(error) : data;
    const status = result?.status ?? "error";
    return { status, needsReconnect: Boolean(result?.needsReconnect) };
  } catch (error) {
    console.error("Error checking Google Calendar connection:", error);
    return { status: "error", needsReconnect: false };
  }
};

interface CalendarEventParams {
  date: Date;
  time?: string; // Format: "HH:mm" e.g., "19:00" - defaults to "19:00"
  ingredientName: string;
}

export const createCalendarEvent = async ({
  date,
  time,
  ingredientName,
}: CalendarEventParams): Promise<{
  success: boolean;
  eventId?: string;
  error?: string;
  needsReconnect?: boolean;
}> => {
  if (isDevMode()) {
    console.log("[DEV MODE] Skipping Google Calendar create");
    return { success: true, eventId: "dev-mode-event-id" };
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
      const result = await readFunctionError(error);
      if (result.needsReconnect) requestCalendarReconnect();
      return { success: false, error: result.error, needsReconnect: result.needsReconnect };
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
}: UpdateCalendarEventParams): Promise<{ success: boolean; error?: string; needsReconnect?: boolean }> => {
  if (isDevMode()) {
    console.log("[DEV MODE] Skipping Google Calendar update");
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
      const result = await readFunctionError(error);
      if (result.needsReconnect) requestCalendarReconnect();
      return { success: false, error: result.error, needsReconnect: result.needsReconnect };
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
    console.log("[DEV MODE] Skipping Google Calendar delete");
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
