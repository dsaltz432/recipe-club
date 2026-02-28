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
  await import("@edge/notify-recipe-change/index.ts");
}

function createMembersBuilder(data: unknown, error: { message: string } | null = null) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "limit", "insert", "update", "delete", "upsert", "single", "maybeSingle", "filter"] as const) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (onFulfilled?: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(onFulfilled);
  return builder;
}

const baseBody = {
  type: "added" as const,
  recipeName: "Test Recipe",
  recipeUrl: "https://example.com/recipe",
  ingredientName: "Broccoli",
  eventDate: "2026-03-01",
  excludeUserId: "user-123",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("notify-recipe-change edge function", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    mockEnvGet.mockImplementation(
      createMockEnvGet().getMockImplementation()!,
    );
    mockSupabase.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: "excludeme@example.com" } },
      error: null,
    });
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

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, sent: 0 });
  });

  it("returns 500 when recipeName is missing", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "a@b.com" }]),
    );

    const req = createEdgeRequest({ ...baseBody, recipeName: undefined });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("recipeName is required");
  });

  it("returns 500 when club members query errors", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder(null, { message: "DB error" }),
    );

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to fetch club members");
  });

  it("returns 'No club members to notify' when no members found", async () => {
    mockSupabase.from.mockReturnValue(createMembersBuilder([]));

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, message: "No club members to notify" });
  });

  it("returns 'No other club members' when all members filtered by excludeUserId", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "excludeme@example.com" }]),
    );

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, message: "No other club members to notify" });
  });

  it("sends emails for 'added' type and returns correct singular/plural message", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "member@example.com" }]),
    );

    globalThis.fetch = vi.fn().mockResolvedValue(createResendResponse(true));

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, message: "Sent 1 notification" });
    // singular — no trailing "s"
    expect((data as { message: string }).message).not.toMatch(/notifications$/);
  });

  it("sends emails for 'updated' type with eventDate formatting", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([
        { email: "m1@example.com" },
        { email: "m2@example.com" },
      ]),
    );

    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, type: "updated" });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    // 2 members but excludeUser filters out 0 (different email)
    expect(data).toMatchObject({ success: true, message: "Sent 2 notifications" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("tracks errors when email send fails (non-ok response from Resend)", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "fail@example.com" }]),
    );

    globalThis.fetch = vi.fn().mockResolvedValue(createResendResponse(false));

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });
    expect((data as { errors: string[] }).errors).toHaveLength(1);
    expect((data as { errors: string[] }).errors[0]).toContain("fail@example.com");
  });

  it("tracks errors when email send throws exception", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "throw@example.com" }]),
    );

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });
    expect((data as { errors: string[] }).errors).toHaveLength(1);
    expect((data as { errors: string[] }).errors[0]).toContain("Network timeout");
  });

  it("sends 'added' notification without excludeUserId, eventDate, ingredientName, or recipeUrl", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "member@example.com" }]),
    );
    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({
      type: "added",
      recipeName: "Test Recipe",
    });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, message: "Sent 1 notification" });

    const fetchCall = mockFetch.mock.calls[0];
    const emailBody = JSON.parse(fetchCall[1].body);
    expect(emailBody.subject).toContain("Recipe Club");
    expect(emailBody.html).not.toContain(" on ");
    expect(emailBody.html).not.toContain("<a href=");
  });

  it("sends 'deleted' notification with correct subject and body", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "member@example.com" }]),
    );
    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({
      type: "deleted",
      recipeName: "Removed Recipe",
      ingredientName: "Broccoli",
      eventDate: "2026-03-01",
      excludeUserId: "user-123",
    });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, message: "Sent 1 notification" });

    const fetchCall = mockFetch.mock.calls[0];
    const emailBody = JSON.parse(fetchCall[1].body);
    expect(emailBody.subject).toContain("Recipe removed from Broccoli event");
    expect(emailBody.html).toContain("Recipe Removed");
    expect(emailBody.html).toContain("Removed Recipe");
    expect(emailBody.html).toContain("has been removed from");
    expect(emailBody.html).not.toContain("<a href=");
  });

  it("sends 'updated' notification without eventDate or ingredientName", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "member@example.com" }]),
    );
    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({
      type: "updated",
      recipeName: "Updated Recipe",
      recipeUrl: "https://example.com/recipe",
      excludeUserId: "user-123",
    });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true });

    const fetchCall = mockFetch.mock.calls[0];
    const emailBody = JSON.parse(fetchCall[1].body);
    expect(emailBody.subject).toContain("Recipe Club");
    expect(emailBody.html).not.toContain(" on ");
  });

  it("handles non-Error thrown in per-email catch", async () => {
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "throw@example.com" }]),
    );
    globalThis.fetch = vi.fn().mockRejectedValue("string error");

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect((data as { errors: string[] }).errors[0]).toContain("Unknown error");
  });

  it("returns 'Unknown error' when a non-Error is thrown in outer catch", async () => {
    const req = createEdgeRequest(baseBody);
    req.json = () => Promise.reject("non-Error rejection");

    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false, error: "Unknown error" });
  });

  it("handles excludeUserId when user has no email", async () => {
    mockSupabase.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: null } },
      error: null,
    });
    mockSupabase.from.mockReturnValue(
      createMembersBuilder([{ email: "member@example.com" }]),
    );
    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, message: "Sent 1 notification" });
  });
});
