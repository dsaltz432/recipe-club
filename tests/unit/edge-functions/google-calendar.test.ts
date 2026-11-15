import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockEnvGet } from "@tests/helpers/edge-function-setup";

// ---------------------------------------------------------------------------
// Deno globals + module mocks
// ---------------------------------------------------------------------------
const mockEnvGet = createMockEnvGet({
  SUPABASE_ANON_KEY: "test-anon-key",
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
});
const mockServe = vi.fn();

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = { env: { get: vi.fn() } };
});

// Token row returned by user_tokens select, and a log of status updates
let tokenRow: { refresh_token: string } | null = { refresh_token: "refresh-123" };
const statusUpdates: Array<Record<string, unknown>> = [];

function createBuilder() {
  const builder: Record<string, unknown> = {};
  let mode: "select" | "update" = "select";
  builder.select = vi.fn(() => {
    mode = "select";
    return builder;
  });
  builder.update = vi.fn((values: Record<string, unknown>) => {
    mode = "update";
    statusUpdates.push(values);
    return builder;
  });
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn(() => builder);
  builder.then = (onFulfilled?: (v: unknown) => unknown) =>
    Promise.resolve(
      mode === "select"
        ? { data: tokenRow, error: tokenRow ? null : { message: "No rows" } }
        : { data: null, error: null }
    ).then(onFulfilled);
  return builder;
}

const mockClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
  },
  from: vi.fn(() => createBuilder()),
};

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({
  serve: (fn: (req: Request) => Promise<Response>) => mockServe(fn),
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: () => mockClient,
}));

let handler: (req: Request) => Promise<Response>;

async function loadHandler() {
  vi.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = { env: { get: mockEnvGet } };
  mockServe.mockImplementation((fn: (req: Request) => Promise<Response>) => {
    handler = fn;
  });
  await import("@edge/google-calendar/index.ts");
}

const request = (body: unknown) =>
  new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
    body: JSON.stringify(body),
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const mockFetch = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  tokenRow = { refresh_token: "refresh-123" };
  statusUpdates.length = 0;
  mockClient.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mockClient.from.mockImplementation(() => createBuilder());
  vi.stubGlobal("fetch", mockFetch);
  await loadHandler();
});

describe("google-calendar edge function — connection status", () => {
  it("reports connected and records it when the refresh token works", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        access_token: "access-abc",
        scope: "openid https://www.googleapis.com/auth/calendar.events",
      })
    );

    const res = await handler(request({ action: "status" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, status: "connected", needsReconnect: false });
    expect(statusUpdates).toHaveLength(1);
    expect(statusUpdates[0].last_status).toBe("connected");
    expect(statusUpdates[0].last_checked_at).toEqual(expect.any(String));
  });

  it("reports disconnected and records it when Google returns invalid_grant", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400)
    );

    const res = await handler(request({ action: "status" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, status: "disconnected", needsReconnect: true });
    expect(statusUpdates[0].last_status).toBe("disconnected");
  });

  it("reports missing_scope when calendar access was not granted", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ access_token: "access-abc", scope: "openid email profile" })
    );

    const res = await handler(request({ action: "status" }));
    const body = await res.json();

    expect(body).toEqual({ success: true, status: "missing_scope", needsReconnect: true });
    expect(statusUpdates[0].last_status).toBe("missing_scope");
  });

  it("reports missing when the user has no stored token", async () => {
    tokenRow = null;

    const res = await handler(request({ action: "status" }));
    const body = await res.json();

    expect(body).toEqual({ success: true, status: "missing", needsReconnect: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not ask to reconnect on transient Google errors", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "server_error" }, 500));

    const res = await handler(request({ action: "status" }));
    const body = await res.json();

    expect(body).toEqual({ success: true, status: "error", needsReconnect: false });
    expect(statusUpdates[0].last_status).toBe("error");
  });
});

describe("google-calendar edge function — create", () => {
  const createBody = {
    action: "create",
    date: "2026-11-17T00:00:00.000Z",
    time: "19:00",
    ingredientName: "Cardamom",
    attendeeEmails: ["a@example.com"],
  };

  it("returns needsReconnect with the real reason when the token is revoked", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400)
    );

    const res = await handler(request(createBody));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.needsReconnect).toBe(true);
    expect(body.status).toBe("disconnected");
    expect(body.error).toContain("expired or revoked");
    expect(statusUpdates[0].last_status).toBe("disconnected");
    // Never reached the Calendar API
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("creates the event and records connected when the token works", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "access-abc", scope: "https://www.googleapis.com/auth/calendar.events" })
      )
      .mockResolvedValueOnce(jsonResponse({ id: "gcal-event-1" }));

    const res = await handler(request(createBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, eventId: "gcal-event-1" });
    expect(statusUpdates[0].last_status).toBe("connected");
    expect(mockFetch.mock.calls[1][0]).toContain("sendUpdates=all");
  });
});
