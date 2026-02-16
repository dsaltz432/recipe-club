import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockEnvGet,
  createMockSupabaseClient,
  createResendResponse,
  createEdgeRequest,
  parseResponse,
} from "@tests/helpers/edge-function-setup";

// ---------------------------------------------------------------------------
// Set up Deno globals and mocks
// ---------------------------------------------------------------------------
const mockEnvGet = createMockEnvGet();
const mockServe = vi.fn();
const mockSupabase = createMockSupabaseClient();

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = { env: { get: vi.fn() } };
});

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({
  serve: (fn: (req: Request) => Promise<Response>) => {
    mockServe(fn);
  },
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: () => mockSupabase,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let handler: (req: Request) => Promise<Response>;

async function loadHandler() {
  vi.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = { env: { get: mockEnvGet } };
  mockServe.mockImplementation((fn: (req: Request) => Promise<Response>) => {
    handler = fn;
  });
  await import("@edge/send-event-reminders/index.ts");
}

function createBuilder(data: unknown = null, error: { message: string } | null = null) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "limit", "insert", "update", "delete", "upsert", "single", "maybeSingle", "filter"] as const) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (onFulfilled?: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(onFulfilled);
  return builder;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("send-event-reminders edge function", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    mockEnvGet.mockImplementation(
      createMockEnvGet().getMockImplementation()!,
    );
    await loadHandler();
  });

  it("returns 'ok' with CORS headers for OPTIONS preflight", async () => {
    const req = createEdgeRequest(null, "OPTIONS");
    const res = await handler(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns {success:true, sent:0} when RESEND_API_KEY is missing", async () => {
    mockEnvGet.mockImplementation(
      createMockEnvGet({ RESEND_API_KEY: undefined }).getMockImplementation()!,
    );
    await loadHandler();

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, sent: 0 });
  });

  it("continues to next date when event fetch errors", async () => {
    // Both target dates return errors
    mockSupabase.from.mockReturnValue(
      createBuilder(null, { message: "DB connection error" }),
    );
    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    globalThis.fetch = vi.fn();

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });
    // Errors from both target dates should be tracked
    expect((data as { errors: string[] }).errors).toBeDefined();
    expect((data as { errors: string[] }).errors.length).toBeGreaterThanOrEqual(1);
  });

  it("continues when no events found for a target date", async () => {
    // Return empty array for scheduled_events
    mockSupabase.from.mockReturnValue(createBuilder([], null));
    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, message: "Sent 0 reminder emails" });
  });

  it("handles admin user fetch error non-fatally (continues processing)", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: "19:00", status: "scheduled", ingredient: { name: "Broccoli" } }],
      null,
    );
    const recipesBuilder = createBuilder([{ created_by: "user-1" }], null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    // admin list users errors
    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: null,
      error: { message: "Auth service down" },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(createResendResponse(true));

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    // Should still succeed - admin error is non-fatal
    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });
  });

  it("sends excited email when admin has recipe locked in", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: "19:00", status: "scheduled", ingredient: { name: "Broccoli" } }],
      null,
    );
    const recipesBuilder = createBuilder([{ created_by: "user-admin-1" }], null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "user-admin-1", email: "sarahgsaltz@gmail.com" },
          { id: "user-admin-2", email: "dsaltz190@gmail.com" },
        ],
      },
      error: null,
    });

    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    // Check email subject for the admin with the recipe (sarahgsaltz)
    const firstCall = mockFetch.mock.calls[0];
    const firstBody = JSON.parse(firstCall[1].body);
    expect(firstBody.subject).toContain("Get excited");
  });

  it("sends reminder email when admin has no recipe", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: "19:30", status: "scheduled", ingredient: { name: "Chicken" } }],
      null,
    );
    const recipesBuilder = createBuilder([], null); // No recipes locked in

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [{ id: "user-admin-1", email: "sarahgsaltz@gmail.com" }],
      },
      error: null,
    });

    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    // Check the email has "reminder" subject
    const firstCall = mockFetch.mock.calls[0];
    const firstBody = JSON.parse(firstCall[1].body);
    expect(firstBody.subject).toContain("Reminder");
    expect(firstBody.subject).toContain("Lock in");
  });

  it("treats admin email not in auth.users as hasRecipe=false", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: null, status: "scheduled", ingredient: { name: "Pasta" } }],
      null,
    );
    const recipesBuilder = createBuilder([{ created_by: "some-other-user" }], null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    // No admin emails found in auth users
    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "not-admin", email: "random@example.com" }] },
      error: null,
    });

    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    // Both admin emails should get "reminder" (not "excited") emails
    const firstCall = mockFetch.mock.calls[0];
    const firstBody = JSON.parse(firstCall[1].body);
    expect(firstBody.subject).toContain("Reminder");
  });

  it("continues to next event when recipe fetch errors", async () => {
    const eventsBuilder = createBuilder(
      [
        { id: "event-1", event_date: "2026-03-01", event_time: "19:00", status: "scheduled", ingredient: { name: "Broccoli" } },
      ],
      null,
    );
    // recipes query errors
    const recipesBuilder = createBuilder(null, { message: "recipes table error" });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });
    expect((data as { errors: string[] }).errors).toBeDefined();
    expect((data as { errors: string[] }).errors[0]).toContain("Error fetching recipes");
  });

  it("sendReminderEmail returns {success:true} on successful send", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: "19:00", status: "scheduled", ingredient: { name: "Tofu" } }],
      null,
    );
    const recipesBuilder = createBuilder([], null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue(createResendResponse(true));

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    // Should have sent emails to both admin emails
    expect((data as { message: string }).message).toContain("Sent");
  });

  it("sendReminderEmail returns {success:false} on non-ok from Resend", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: "19:00", status: "scheduled", ingredient: { name: "Tofu" } }],
      null,
    );
    const recipesBuilder = createBuilder([], null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue(createResendResponse(false));

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect((data as { errors: string[] }).errors).toBeDefined();
    expect((data as { errors: string[] }).errors.length).toBeGreaterThan(0);
  });

  it("sendReminderEmail returns {success:false} when fetch throws", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: "19:00", status: "scheduled", ingredient: { name: "Rice" } }],
      null,
    );
    const recipesBuilder = createBuilder([], null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect((data as { errors: string[] }).errors).toBeDefined();
    expect((data as { errors: string[] }).errors[0]).toContain("Network error");
  });

  it("formats time correctly: '19:30' -> '7:30pm', '19:00' -> '7pm', '0:00' -> '12am', null -> no time", async () => {
    // Test multiple time formats via email content
    const testCases = [
      { time: "19:30", expected: "7:30pm" },
      { time: "19:00", expected: "7pm" },
      { time: "0:00", expected: "12am" },
      { time: null as string | null, expected: null },
    ];

    for (const { time, expected } of testCases) {
      vi.restoreAllMocks();
      mockEnvGet.mockImplementation(
        createMockEnvGet().getMockImplementation()!,
      );

      const eventsBuilder = createBuilder(
        [{ id: "event-1", event_date: "2026-03-01", event_time: time, status: "scheduled", ingredient: { name: "Test" } }],
        null,
      );
      const recipesBuilder = createBuilder([], null);

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "scheduled_events") return eventsBuilder;
        if (table === "recipes") return recipesBuilder;
        return createBuilder();
      });

      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
      globalThis.fetch = mockFetch;

      const req = createEdgeRequest({});
      await handler(req);

      if (expected) {
        // Check that formatted time appears in email HTML
        const fetchCall = mockFetch.mock.calls[0];
        const emailBody = JSON.parse(fetchCall[1].body);
        expect(emailBody.html).toContain(expected);
      } else {
        // Null time should not have " at " in the email
        const fetchCall = mockFetch.mock.calls[0];
        const emailBody = JSON.parse(fetchCall[1].body);
        expect(emailBody.html).not.toContain(" at ");
      }
    }
  });

  it("returns 500 when unexpected error occurs in main try block", async () => {
    mockSupabase.from.mockImplementation(() => {
      throw "unexpected non-Error";
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false, error: "Unknown error" });
  });

  it("uses 'the ingredient' fallback when event has no ingredient name", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: "19:00", status: "scheduled", ingredient: null }],
      null,
    );
    const recipesBuilder = createBuilder([], null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    const fetchCall = mockFetch.mock.calls[0];
    const emailBody = JSON.parse(fetchCall[1].body);
    expect(emailBody.html).toContain("the ingredient");
  });

  it("returns 500 with error message when an Error is thrown in outer catch", async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error("Unexpected DB crash");
    });

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false, error: "Unexpected DB crash" });
  });

  it("handles null recipes data without error", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: "19:00", status: "scheduled", ingredient: { name: "Tofu" } }],
      null,
    );
    // recipes query returns null data with no error
    const recipesBuilder = createBuilder(null, null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });
  });

  it("handles non-Error thrown in sendReminderEmail catch", async () => {
    const eventsBuilder = createBuilder(
      [{ id: "event-1", event_date: "2026-03-01", event_time: "19:00", status: "scheduled", ingredient: { name: "Tofu" } }],
      null,
    );
    const recipesBuilder = createBuilder([], null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "scheduled_events") return eventsBuilder;
      if (table === "recipes") return recipesBuilder;
      return createBuilder();
    });

    mockSupabase.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    globalThis.fetch = vi.fn().mockRejectedValue("not an Error object");

    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect((data as { errors: string[] }).errors).toBeDefined();
    expect((data as { errors: string[] }).errors[0]).toContain("Unknown error sending email");
  });
});
