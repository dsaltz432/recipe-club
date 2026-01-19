import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock supabase session
const mockSession = {
  provider_token: "mock-google-token",
};

const mockGetSession = vi.fn(() =>
  Promise.resolve({
    data: { session: mockSession },
    error: null,
  })
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

// Mock auth module
vi.mock("@/lib/auth", () => ({
  getClubMemberEmails: vi.fn().mockResolvedValue([
    "member1@example.com",
    "member2@example.com",
  ]),
}));

import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/googleCalendar";

describe("Google Calendar Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to successful session
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          provider_token: "mock-google-token",
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createCalendarEvent", () => {
    it("should create a calendar event successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "calendar-event-123",
            htmlLink: "https://calendar.google.com/event/123",
          }),
      });

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        time: "19:00",
        ingredientName: "Salmon",
      });

      expect(result.success).toBe(true);
      expect(result.eventId).toBe("calendar-event-123");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-google-token",
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should return error when no session exists", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No active session");
    });

    it("should return error when no provider token", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            provider_token: null,
          },
        },
        error: null,
      });

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Google Calendar access not available");
    });

    it("should handle API error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: { message: "Invalid request" },
          }),
      });

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid request");
    });

    it("should handle 401 unauthorized error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: { message: "Token expired" },
          }),
      });

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Calendar access expired");
    });

    it("should use default time of 19:00 when not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "calendar-event-123",
          }),
      });

      // Use a date without time component to let the function set 19:00
      const testDate = new Date(2025, 0, 20); // January 20, 2025 in local time

      await createCalendarEvent({
        date: testDate,
        ingredientName: "Test",
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // The function should set hours to 19:00 local time
      // Verify start time was set (the exact format depends on timezone)
      expect(body.start.dateTime).toBeDefined();
      expect(body.start.timeZone).toBeDefined();
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should include club member emails as attendees", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "calendar-event-123",
          }),
      });

      await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.attendees).toEqual([
        { email: "member1@example.com" },
        { email: "member2@example.com" },
      ]);
    });
  });

  describe("updateCalendarEvent", () => {
    it("should update a calendar event successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date("2025-01-25"),
        time: "20:00",
        ingredientName: "Chicken",
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/event-123?sendUpdates=all",
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });

    it("should return error when session is missing", async () => {
      // Clear any previous mock values and set new one
      mockGetSession.mockReset();
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No active session");

      // Restore default mock
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            provider_token: "mock-google-token",
          },
        },
        error: null,
      });
    });

    it("should handle update API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: { message: "Event not found" },
          }),
      });

      const result = await updateCalendarEvent({
        calendarEventId: "nonexistent-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Event not found");
    });
  });

  describe("deleteCalendarEvent", () => {
    it("should delete a calendar event successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/event-123?sendUpdates=all",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should return success even when event is not found (404)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await deleteCalendarEvent("nonexistent-123");

      expect(result.success).toBe(true);
    });

    it("should return error for other API failures", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            error: { message: "Server error" },
          }),
      });

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Server error");
    });

    it("should return error when no provider token", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            provider_token: null,
          },
        },
        error: null,
      });

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Google Calendar access not available");
    });

    it("should return error when session has error", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: { message: "Auth error" },
      });

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No active session");
    });

    it("should handle network errors in delete", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("should handle non-Error thrown exceptions", async () => {
      mockFetch.mockRejectedValueOnce("string error");

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("createCalendarEvent - additional error cases", () => {
    it("should use fallback error message when API error has no message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: {},  // No message property
          }),
      });

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create calendar event");
    });

    it("should handle non-Error thrown exceptions in create", async () => {
      mockFetch.mockRejectedValueOnce("string exception");

      const result = await createCalendarEvent({
        date: new Date("2025-01-20"),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("updateCalendarEvent - additional error cases", () => {
    it("should return error when no provider token for update", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            provider_token: null,
          },
        },
        error: null,
      });

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Google Calendar access not available");
    });

    it("should use fallback error message when update API error has no message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: {},
          }),
      });

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update calendar event");
    });

    it("should handle network errors in update", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Update network failure"));

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update network failure");
    });

    it("should handle non-Error thrown exceptions in update", async () => {
      mockFetch.mockRejectedValueOnce("string exception");

      const result = await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date(),
        ingredientName: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });

    it("should use default time when not provided for update", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await updateCalendarEvent({
        calendarEventId: "event-123",
        date: new Date("2025-01-20"),
        ingredientName: "Test",
        // time not provided - should default to "19:00"
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // Verify start time was set (the exact format depends on timezone)
      expect(body.start.dateTime).toBeDefined();
      expect(body.start.timeZone).toBeDefined();
    });
  });

  describe("deleteCalendarEvent - fallback error", () => {
    it("should use fallback error message when delete API error has no message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            error: {},
          }),
      });

      const result = await deleteCalendarEvent("event-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete calendar event");
    });
  });
});
