import { supabase } from "@/integrations/supabase/client";
import { deleteCalendarEvent } from "@/lib/googleCalendar";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Cancel an event: delete calendar event, detach meal plan recipes, delete event row.
 * Callers handle UI concerns (toast, navigation, callbacks).
 */
export async function cancelEvent(eventId: string): Promise<ActionResult> {
  try {
    // Fetch the event row (need calendar_event_id)
    const { data: eventData, error: findError } = await supabase
      .from("scheduled_events")
      .select("*, ingredients (*)")
      .eq("id", eventId)
      .single();

    if (findError) throw findError;

    // Delete Google Calendar event if it exists
    if (eventData.calendar_event_id) {
      const deleteResult = await deleteCalendarEvent(eventData.calendar_event_id);
      if (!deleteResult.success && !deleteResult.error?.includes("not available")) {
        console.warn("Failed to delete calendar event:", deleteResult.error);
      }
    }

    // Detach any recipes used by meal plan items so they survive the cascade delete.
    // Uses SECURITY DEFINER RPC to see meal_plan_items across all users.
    const { error: detachError } = await supabase.rpc("detach_meal_plan_recipes", { p_event_id: eventId });
    if (detachError) console.error("Failed to detach meal plan recipes:", detachError);

    // Delete the event row (remaining recipes cascade delete via ON DELETE CASCADE)
    const { error: deleteError } = await supabase
      .from("scheduled_events")
      .delete()
      .eq("id", eventData.id);

    if (deleteError) throw deleteError;

    return { success: true };
  } catch (error) {
    console.error("Error canceling event:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to cancel event" };
  }
}
