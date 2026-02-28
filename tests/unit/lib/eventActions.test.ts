import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock ---
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// --- Google Calendar mock ---
const mockDeleteCalendarEvent = vi.fn();
const mockUpdateCalendarEvent = vi.fn();

vi.mock("@/lib/googleCalendar", () => ({
  deleteCalendarEvent: (...args: unknown[]) => mockDeleteCalendarEvent(...args),
  updateCalendarEvent: (...args: unknown[]) => mockUpdateCalendarEvent(...args),
}));

import { cancelEvent, completeEvent, updateEvent } from "@/lib/eventActions";

describe("eventActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // cancelEvent
  // =============================================
  describe("cancelEvent", () => {
    const eventId = "event-123";
    const eventData = {
      id: "event-123",
      calendar_event_id: "cal-456",
      ingredients: { name: "Salmon" },
    };

    function setupCancelMocks(overrides?: {
      fetchError?: object | null;
      fetchData?: object | null;
      deleteCalendarResult?: object;
      detachError?: object | null;
      deleteError?: object | null;
    }) {
      const opts = {
        fetchError: null,
        fetchData: eventData,
        deleteCalendarResult: { success: true },
        detachError: null,
        deleteError: null,
        ...overrides,
      };

      // from("scheduled_events").select().eq().single()
      const mockSingle = vi.fn().mockResolvedValue({ data: opts.fetchData, error: opts.fetchError });
      const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });

      // from("scheduled_events").delete().eq()
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: opts.deleteError });
      const mockDeleteChain = vi.fn().mockReturnValue({ eq: mockDeleteEq });

      mockFrom.mockImplementation((table: string) => {
        if (table === "scheduled_events") {
          return {
            select: mockSelect,
            delete: mockDeleteChain,
          };
        }
        return {};
      });

      mockDeleteCalendarEvent.mockResolvedValue(opts.deleteCalendarResult);
      mockRpc.mockResolvedValue({ error: opts.detachError });

      return { mockSingle, mockSelectEq, mockSelect, mockDeleteEq, mockDeleteChain };
    }

    it("cancels an event successfully (full flow with calendar)", async () => {
      const mocks = setupCancelMocks();

      const result = await cancelEvent(eventId);

      expect(result).toEqual({ success: true });

      // Verify fetch
      expect(mockFrom).toHaveBeenCalledWith("scheduled_events");
      expect(mocks.mockSelect).toHaveBeenCalledWith("*, ingredients (*)");
      expect(mocks.mockSelectEq).toHaveBeenCalledWith("id", eventId);

      // Verify calendar delete
      expect(mockDeleteCalendarEvent).toHaveBeenCalledWith("cal-456");

      // Verify detach RPC called before delete
      expect(mockRpc).toHaveBeenCalledWith("detach_meal_plan_recipes", { p_event_id: eventId });

      // Verify event row deleted
      expect(mocks.mockDeleteEq).toHaveBeenCalledWith("id", eventId);
    });

    it("skips calendar delete when no calendar_event_id", async () => {
      setupCancelMocks({
        fetchData: { ...eventData, calendar_event_id: null },
      });

      const result = await cancelEvent(eventId);

      expect(result).toEqual({ success: true });
      expect(mockDeleteCalendarEvent).not.toHaveBeenCalled();
    });

    it("returns failure when fetch fails", async () => {
      setupCancelMocks({
        fetchError: { message: "Event not found" },
      });

      const result = await cancelEvent(eventId);

      expect(result).toEqual({ success: false, error: "Failed to cancel event" });
    });

    it("returns failure when event row delete fails", async () => {
      setupCancelMocks({
        deleteError: { message: "Delete forbidden" },
      });

      const result = await cancelEvent(eventId);

      expect(result).toEqual({ success: false, error: "Failed to cancel event" });
    });

    it("continues when calendar delete fails (non-fatal)", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      setupCancelMocks({
        deleteCalendarResult: { success: false, error: "Calendar API down" },
      });

      const result = await cancelEvent(eventId);

      expect(result).toEqual({ success: true });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to delete calendar event:",
        "Calendar API down"
      );
      consoleSpy.mockRestore();
    });

    it("ignores calendar 'not available' error silently", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      setupCancelMocks({
        deleteCalendarResult: { success: false, error: "Calendar not available in dev mode" },
      });

      const result = await cancelEvent(eventId);

      expect(result).toEqual({ success: true });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("continues when detach RPC fails (non-fatal)", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      setupCancelMocks({
        detachError: { message: "RPC failed" },
      });

      const result = await cancelEvent(eventId);

      expect(result).toEqual({ success: true });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to detach meal plan recipes:",
        { message: "RPC failed" }
      );
      consoleSpy.mockRestore();
    });
  });

  // =============================================
  // completeEvent
  // =============================================
  describe("completeEvent", () => {
    const eventId = "event-123";
    const ingredientId = "ingredient-456";
    const userId = "user-789";

    function setupCompleteMocks(overrides?: {
      statusError?: object | null;
      rpcError?: object | null;
    }) {
      const opts = {
        statusError: null,
        rpcError: null,
        ...overrides,
      };

      // from("scheduled_events").update().eq()
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: opts.statusError });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

      mockFrom.mockReturnValue({ update: mockUpdate });
      mockRpc.mockResolvedValue({ error: opts.rpcError });

      return { mockUpdate, mockUpdateEq };
    }

    it("completes an event with ingredient count increment", async () => {
      const mocks = setupCompleteMocks();

      const result = await completeEvent(eventId, ingredientId, userId);

      expect(result).toEqual({ success: true });

      // Verify status update
      expect(mockFrom).toHaveBeenCalledWith("scheduled_events");
      expect(mocks.mockUpdate).toHaveBeenCalledWith({ status: "completed" });
      expect(mocks.mockUpdateEq).toHaveBeenCalledWith("id", eventId);

      // Verify RPC
      expect(mockRpc).toHaveBeenCalledWith("increment_ingredient_used_count", {
        p_ingredient_id: ingredientId,
        p_user_id: userId,
      });
    });

    it("skips RPC when ingredientId is empty", async () => {
      setupCompleteMocks();

      const result = await completeEvent(eventId, "", userId);

      expect(result).toEqual({ success: true });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("returns failure when status update fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      setupCompleteMocks({ statusError: { message: "DB error" } });

      const result = await completeEvent(eventId, ingredientId, userId);

      expect(result).toEqual({ success: false, error: "Failed to complete event" });
      vi.restoreAllMocks();
    });

    it("returns failure when RPC fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      setupCompleteMocks({ rpcError: { message: "RPC timeout" } });

      const result = await completeEvent(eventId, ingredientId, userId);

      expect(result).toEqual({ success: false, error: "Failed to complete event" });
      vi.restoreAllMocks();
    });
  });

  // =============================================
  // updateEvent
  // =============================================
  describe("updateEvent", () => {
    const eventId = "event-123";
    // Use noon UTC to avoid timezone date shift when format() runs in local tz
    const date = new Date("2025-06-15T12:00:00");
    const time = "19:00";
    const eventData = {
      id: "event-123",
      calendar_event_id: "cal-789",
      ingredients: { name: "Tacos" },
    };

    function setupUpdateMocks(overrides?: {
      fetchError?: object | null;
      fetchData?: object | null;
      updateError?: object | null;
      calendarResult?: object;
    }) {
      const opts = {
        fetchError: null,
        fetchData: eventData,
        updateError: null,
        calendarResult: { success: true },
        ...overrides,
      };

      // from("scheduled_events").select().eq().single() — fetch
      const mockSingle = vi.fn().mockResolvedValue({ data: opts.fetchData, error: opts.fetchError });
      const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });

      // from("scheduled_events").update().eq() — update
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: opts.updateError });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

      mockUpdateCalendarEvent.mockResolvedValue(opts.calendarResult);

      return { mockSelect, mockSelectEq, mockSingle, mockUpdate, mockUpdateEq };
    }

    it("updates event date/time and syncs calendar", async () => {
      const mocks = setupUpdateMocks();

      const result = await updateEvent(eventId, date, time);

      expect(result).toEqual({ success: true, calendarSyncFailed: false });

      // Verify fetch
      expect(mocks.mockSelect).toHaveBeenCalledWith("*, ingredients (name)");
      expect(mocks.mockSelectEq).toHaveBeenCalledWith("id", eventId);

      // Verify DB update
      expect(mocks.mockUpdate).toHaveBeenCalledWith({
        event_date: "2025-06-15",
        event_time: "19:00",
      });
      expect(mocks.mockUpdateEq).toHaveBeenCalledWith("id", eventId);

      // Verify calendar sync
      expect(mockUpdateCalendarEvent).toHaveBeenCalledWith({
        calendarEventId: "cal-789",
        date,
        time: "19:00",
        ingredientName: "Tacos",
      });
    });

    it("skips calendar sync when no calendar_event_id", async () => {
      setupUpdateMocks({
        fetchData: { ...eventData, calendar_event_id: null },
      });

      const result = await updateEvent(eventId, date, time);

      expect(result).toEqual({ success: true, calendarSyncFailed: false });
      expect(mockUpdateCalendarEvent).not.toHaveBeenCalled();
    });

    it("returns calendarSyncFailed when calendar update fails", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      setupUpdateMocks({
        calendarResult: { success: false, error: "Calendar API error" },
      });

      const result = await updateEvent(eventId, date, time);

      expect(result).toEqual({ success: true, calendarSyncFailed: true });
      vi.restoreAllMocks();
    });

    it("returns failure when fetch fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      setupUpdateMocks({ fetchError: { message: "Not found" } });

      const result = await updateEvent(eventId, date, time);

      expect(result).toEqual({ success: false, error: "Failed to update event" });
      vi.restoreAllMocks();
    });

    it("returns failure when DB update fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      setupUpdateMocks({ updateError: { message: "Update forbidden" } });

      const result = await updateEvent(eventId, date, time);

      expect(result).toEqual({ success: false, error: "Failed to update event" });
      vi.restoreAllMocks();
    });

    it("uses 'Unknown' as ingredient name when ingredients is null", async () => {
      setupUpdateMocks({
        fetchData: { ...eventData, ingredients: null },
      });

      await updateEvent(eventId, date, time);

      expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({ ingredientName: "Unknown" })
      );
    });
  });
});
