import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockEnvGet,
  createResendResponse,
  createEdgeRequest,
  parseResponse,
} from "@tests/helpers/edge-function-setup";

// ---------------------------------------------------------------------------
// Set up Deno globals before any module loads
// ---------------------------------------------------------------------------
const mockEnvGet = createMockEnvGet();
const mockServe = vi.fn();

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Deno = { env: { get: vi.fn() } };
});

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({
  serve: (fn: (req: Request) => Promise<Response>) => {
    mockServe(fn);
  },
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
  await import("@edge/recipe-club-product-update/index.ts");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("recipe-club-product-update edge function", () => {
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

    const req = createEdgeRequest({ emails: ["a@b.com"] });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, sent: 0 });
  });

  it("returns 500 when emails is missing", async () => {
    const req = createEdgeRequest({});
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("emails is required");
  });

  it("returns 500 when emails is not an array", async () => {
    const req = createEdgeRequest({ emails: "not-array" });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("emails is required");
  });

  it("returns 500 when emails is an empty array", async () => {
    const req = createEdgeRequest({ emails: [] });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(500);
    expect(data).toMatchObject({ success: false });
    expect((data as { error: string }).error).toContain("emails is required");
  });

  it("sends to 2 recipients successfully and returns {sent:2}", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createResendResponse(true))
      .mockResolvedValueOnce(createResendResponse(true));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ emails: ["a@b.com", "c@d.com"] });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, sent: 2 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("tracks errors when one email send fails (non-ok response)", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createResendResponse(true))
      .mockResolvedValueOnce(createResendResponse(false));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ emails: ["good@b.com", "bad@c.com"] });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, sent: 1 });
    expect((data as { errors: string[] }).errors).toHaveLength(1);
    expect((data as { errors: string[] }).errors[0]).toContain("bad@c.com");
  });

  it("tracks errors when one email send throws exception", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createResendResponse(true))
      .mockRejectedValueOnce(new Error("Network failure"));
    globalThis.fetch = mockFetch;

    const req = createEdgeRequest({ emails: ["good@b.com", "fail@c.com"] });
    const { data, status } = await parseResponse(await handler(req));

    expect(status).toBe(200);
    expect(data).toMatchObject({ success: true, sent: 1 });
    expect((data as { errors: string[] }).errors).toHaveLength(1);
    expect((data as { errors: string[] }).errors[0]).toContain("Network failure");
  });
});
