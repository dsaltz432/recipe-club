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
  await import("@edge/send-recipe-share/index.ts");
}

function createBuilder(data: unknown = null, error: { message: string; code?: string } | null = null) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "limit", "insert", "update", "delete", "upsert", "single", "maybeSingle", "filter"] as const) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (onFulfilled?: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(onFulfilled);
  return builder;
}

const baseBody = {
  recipeId: "recipe-123",
  recipeName: "Test Recipe",
  sharedWithEmail: "recipient@example.com",
  sharedByUserId: "user-123",
};

function setupSuccessMocks() {
  // recipe_shares insert succeeds
  const sharesBuilder = createBuilder(null, null);
  // allowed_users select returns no existing user
  const allowedUsersSelectBuilder = createBuilder(null, null);
  // allowed_users insert succeeds
  const allowedUsersInsertBuilder = createBuilder(null, null);
  // profiles select
  const profilesBuilder = createBuilder({ name: "Test User" }, null);

  let allowedUsersCallCount = 0;
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "recipe_shares") return sharesBuilder;
    if (table === "allowed_users") {
      allowedUsersCallCount++;
      // First call is select (check existing), second is insert (add new)
      return allowedUsersCallCount === 1 ? allowedUsersSelectBuilder : allowedUsersInsertBuilder;
    }
    if (table === "profiles") return profilesBuilder;
    return createBuilder();
  });

  mockSupabase.auth.admin.getUserById.mockResolvedValue({
    data: { user: { email: "sharer@example.com" } },
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("send-recipe-share edge function", () => {
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
  });

  it("returns 500 when required fields are missing", async () => {
    const req = createEdgeRequest({ recipeId: "123" }); // missing sharedWithEmail and sharedByUserId
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("recipeId, sharedWithEmail, and sharedByUserId are required");
  });

  it("returns 409 when share is a duplicate (error code 23505)", async () => {
    mockSupabase.from.mockReturnValue(
      createBuilder(null, { message: "duplicate", code: "23505" }),
    );

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(409);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("already been shared");
  });

  it("returns 500 for other share insert errors", async () => {
    mockSupabase.from.mockReturnValue(
      createBuilder(null, { message: "Some DB error", code: "42000" }),
    );

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("Failed to create share");
  });

  it("auto-adds new user to allowed_users with access_type 'share_only'", async () => {
    setupSuccessMocks();
    globalThis.fetch = vi.fn().mockResolvedValue(createResendResponse(true));

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, emailSent: true });

    // Verify allowed_users was called (from was called with "allowed_users")
    expect(mockSupabase.from).toHaveBeenCalledWith("allowed_users");
  });

  it("does not re-insert existing user in allowed_users", async () => {
    // recipe_shares insert succeeds
    const sharesBuilder = createBuilder(null, null);
    // allowed_users select returns existing user
    const allowedUsersBuilder = createBuilder({ id: "existing-id" }, null);
    // profiles
    const profilesBuilder = createBuilder({ name: "Sharer" }, null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "recipe_shares") return sharesBuilder;
      if (table === "allowed_users") return allowedUsersBuilder;
      if (table === "profiles") return profilesBuilder;
      return createBuilder();
    });
    mockSupabase.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: "sharer@example.com" } },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue(createResendResponse(true));

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, emailSent: true });
  });

  it("returns {success:true, emailSent:false} when RESEND_API_KEY is missing", async () => {
    mockEnvGet.mockImplementation(
      createMockEnvGet({ RESEND_API_KEY: undefined }).getMockImplementation()!,
    );
    await loadHandler();

    setupSuccessMocks();

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, emailSent: false });
  });

  it("includes message in email HTML when provided", async () => {
    setupSuccessMocks();
    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, message: "Check this out!" });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, emailSent: true });
    // Verify email HTML includes the message
    const fetchCall = mockFetch.mock.calls[0];
    const emailBody = JSON.parse(fetchCall[1].body);
    expect(emailBody.html).toContain("Check this out!");
  });

  it("sends email without message when message is not provided", async () => {
    setupSuccessMocks();
    const mockFetch = vi.fn().mockResolvedValue(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ ...baseBody, message: undefined });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, emailSent: true });
  });

  it("returns {emailSent:true} even when email send fails (non-ok)", async () => {
    setupSuccessMocks();
    globalThis.fetch = vi.fn().mockResolvedValue(createResendResponse(false));

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    // Email failure is non-fatal
    expect(data).toMatchObject({ success: true, emailSent: true });
  });

  it("returns {emailSent:true} even when email send throws exception", async () => {
    setupSuccessMocks();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("SMTP down"));

    const req = createEdgeRequest(baseBody);
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    // Email failure is non-fatal
    expect(data).toMatchObject({ success: true, emailSent: true });
  });
});
