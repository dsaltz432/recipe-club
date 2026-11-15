import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabase functions.invoke
const mockInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Mock auth module
const mockGetClubMemberEmails = vi.fn().mockResolvedValue([
  "member1@example.com",
  "member2@example.com",
]);
vi.mock("@/lib/auth", () => ({
  getClubMemberEmails: (...args: unknown[]) => mockGetClubMemberEmails(...args),
}));

// Mock devMode - default to false (production behavior)
const mockIsDevMode = vi.fn(() => false);
vi.mock("@/lib/devMode", () => ({
  isDevMode: () => mockIsDevMode(),
}));

import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  checkCalendarConnection,
  CALENDAR_RECONNECT_EVENT,
} from "@/lib/googleCalendar";

describe("Google Calendar Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createCalendarEvent", () => {
    it("should create a calendar event successfully via edge function", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, eventId: "calendar-event-123" },
        error: null,
      });

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        time: "19:00",
        ingredientName: "Salmon",
      });

      expect(result.success).toBe(true);
      expect(result.eventId).toBe("calendar-event-123");
      expect(mockInvoke).toHaveBeenCalledWith("google-calendar", {
        body: {
          action: "create",
          date: new Date("2025-01-20").toISOString(),
          time: "19:00",
          ingredientName: "Salmon",
          attendeeEmails: ["member1@example.com", "member2@example.com"],
        },
      });
    });

    it("should pass club member emails to the edge function", async () => {
      mockGetClubMemberEmails.mockResolvedValueOnce(["a@b.com"]);
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, eventId: "evt-1" },
        error: null,
      });

      await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      const callBody = mockInvoke.mock.calls[0][1].body;
      expect(callBody.attendeeEmails).toEqual(["a@b.com"]);
    });

    it("should use default time of 19:00 when not provided", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, eventId: "evt-1" },
        error: null,
      });

      await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      const callBody = mockInvoke.mock.calls[0][1].body;
      expect(callBody.time).toBe("19:00");
    });

    it("should return error when edge function returns an error", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: "Edge function failed" },
      });

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Edge function failed");
    });

    it("should forward edge function data error", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: false, error: "No refresh token found" },
        error: null,
      });

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No refresh token found");
    });

    it("should handle network errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Network error"));

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should handle non-Error thrown exceptions in create", async () => {
      mockInvoke.mockRejectedValueOnce("string exception");

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("updateCalendarEvent", () => {
    it("should update a calendar event successfully via edge function", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date("2025-01-25"),
        time: "20:00",
        ingredientName: "Chicken",
      });

      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("google-calendar", {
        body: {
          action: "update",
          calendarEventId: "event-123",
          date: new Date("2025-01-25").toISOString(),
          time: "20:00",
          ingredientName: "Chicken",
        },
      });
    });

    it("should use default time when not provided for update", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      const callBody = mockInvoke.mock.calls[0][1].body;
      expect(callBody.time).toBe("19:00");
    });

    it("should return error when edge function returns an error", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: "Update failed" },
      });

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });

    it("should forward edge function data error for update", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: false, error: "Event not found" },
        error: null,
      });

      const result = await updateCalendarEvent({
        calendarEventId: "nonexistent-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Event not found");
    });

    it("should handle network errors in update", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Update network failure"));

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update network failure");
    });

    it("should handle non-Error thrown exceptions in update", async () => {
      mockInvoke.mockRejectedValueOnce("string exception");

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("deleteCalendarEvent", () => {
    it("should delete a calendar event successfully via edge function", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("google-calendar", {
        body: {
          action: "delete",
          calendarEventId: "event-123",
        },
      });
    });

    it("should return error when edge function returns an error", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: "Delete failed" },
      });

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Delete failed");
    });

    it("should forward edge function data error for delete", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: false, error: "Server error" },
        error: null,
      });

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Server error");
    });

    it("should handle network errors in delete", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Network failure"));

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("should handle non-Error thrown exceptions in delete", async () => {
      mockInvoke.mockRejectedValueOnce("string error");

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("Dev mode guards", () => {
    beforeEach(() => {
      mockIsDevMode.mockReturnValue(true);
    });

    afterEach(() => {
      mockIsDevMode.mockReturnValue(false);
    });

    it("should skip edge function and return mock eventId for create in dev mode", async () => {
      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Salmon",
      });

      expect(result.success).toBe(true);
      expect(result.eventId).toBe("dev-mode-event-id");
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should skip edge function for update in dev mode", async () => {
      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date("2025-01-25"),
        ingredientName: "Chicken",
      });

      expect(result.success).toBe(true);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should skip edge function for delete in dev mode", async () => {
      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(true);
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe("connection problems", () => {
    // supabase-js puts the function's JSON body on error.context (a Response)
    const httpError = (body: unknown) => ({
      message: "Edge Function returned a non-2xx status code",
      context: new Response(JSON.stringify(body), { status: 400 }),
    });

    it("surfaces the real error and opens the reconnect prompt when create fails for a revoked token", async () => {
      const listener = vi.fn();
      window.addEventListener(CALENDAR_RECONNECT_EVENT, listener);
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: httpError({
          success: false,
          status: "disconnected",
          needsReconnect: true,
          error: "Failed to refresh Google token: Token has been expired or revoked.",
        }),
      });

      const result = await createCalendarEvent({
        date: new Date("2026-11-17"),
        time: "19:00",
        ingredientName: "Cardamom",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to refresh Google token: Token has been expired or revoked.",
        needsReconnect: true,
      });
      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener(CALENDAR_RECONNECT_EVENT, listener);
    });

    it("does not open the reconnect prompt for unrelated failures", async () => {
      const listener = vi.fn();
      window.addEventListener(CALENDAR_RECONNECT_EVENT, listener);
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: httpError({ success: false, error: "Google Calendar API quota exceeded" }),
      });

      const result = await updateCalendarEvent({
        calendarEventId: "evt-1",
        date: new Date("2026-11-17"),
        ingredientName: "Cardamom",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Google Calendar API quota exceeded");
      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener(CALENDAR_RECONNECT_EVENT, listener);
    });

    it("checkCalendarConnection returns the status from the edge function", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, status: "disconnected", needsReconnect: true },
        error: null,
      });

      await expect(checkCalendarConnection()).resolves.toEqual({
        status: "disconnected",
        needsReconnect: true,
      });
      expect(mockInvoke).toHaveBeenCalledWith("google-calendar", { body: { action: "status" } });
    });

    it("checkCalendarConnection treats network failures as a non-prompting error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("offline"));

      await expect(checkCalendarConnection()).resolves.toEqual({
        status: "error",
        needsReconnect: false,
      });
    });

    it("checkCalendarConnection skips the call in dev mode", async () => {
      mockIsDevMode.mockReturnValueOnce(true);

      await expect(checkCalendarConnection()).resolves.toEqual({
        status: "connected",
        needsReconnect: false,
      });
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
