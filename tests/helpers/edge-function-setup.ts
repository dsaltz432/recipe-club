/**
 * Shared test utilities for Deno-based Supabase edge functions.
 *
 * Provides helpers to mock Deno globals, Supabase clients, Anthropic API
 * responses, and Resend API responses so edge function tests can focus
 * on business logic rather than boilerplate setup.
 */
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Deno.env.get mock
// ---------------------------------------------------------------------------

/**
 * Returns a mock `Deno.env.get` that resolves keys from a merged map of
 * sensible defaults + caller-supplied overrides.
 *
 * Default keys provided:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - ANTHROPIC_API_KEY
 *  - RESEND_API_KEY
 */
export function createMockEnvGet(
  overrides: Record<string, string | undefined> = {},
) {
  const env: Record<string, string | undefined> = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    ANTHROPIC_API_KEY: "test-anthropic-key",
    RESEND_API_KEY: "test-resend-key",
    ...overrides,
  };
  return vi.fn((key: string) => env[key]);
}

// ---------------------------------------------------------------------------
// Chainable Supabase query builder mock
// ---------------------------------------------------------------------------

export interface MockQueryResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/**
 * Creates a chainable mock query builder that mirrors the Supabase PostgREST
 * builder API.  The builder is **thenable** so that callers can `await` it
 * directly (matching real Supabase behaviour).
 *
 * Usage:
 * ```ts
 * const qb = createMockQueryBuilder([{ id: 1 }]);
 * // qb.select().eq("id", 1) → Promise<{ data: [{ id: 1 }], error: null }>
 * ```
 */
export function createMockQueryBuilder<T = unknown>(
  data: T | null = null,
  error: { message: string; code?: string } | null = null,
) {
  const result: MockQueryResult<T> = { data, error };

  const builder: Record<string, unknown> = {};

  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "order",
    "limit",
    "single",
    "maybeSingle",
    "filter",
  ] as const;

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Make the builder thenable so `await supabase.from("x").select()` works.
  builder.then = (
    onFulfilled?: (value: MockQueryResult<T>) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder as Record<
    (typeof chainMethods)[number] | "then",
    ReturnType<typeof vi.fn>
  >;
}

// ---------------------------------------------------------------------------
// Supabase client mock
// ---------------------------------------------------------------------------

export interface MockStorageBucket {
  download: ReturnType<typeof vi.fn>;
}

export interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  storage: {
    from: ReturnType<typeof vi.fn>;
  };
  auth: {
    admin: {
      getUserById: ReturnType<typeof vi.fn>;
      listUsers: ReturnType<typeof vi.fn>;
    };
  };
  /** Helper – configure the query builder returned for a given table. */
  setTableData: (
    table: string,
    data: unknown,
    error?: { message: string; code?: string } | null,
  ) => void;
}

/**
 * Creates a mock Supabase client with a `from()` that returns chainable
 * query builders per table.  Call `setTableData(table, data, error?)` to
 * pre-configure the response for a table.
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  const tableBuilders = new Map<string, ReturnType<typeof createMockQueryBuilder>>();

  const fromFn = vi.fn((table: string) => {
    if (!tableBuilders.has(table)) {
      tableBuilders.set(table, createMockQueryBuilder(null, null));
    }
    return tableBuilders.get(table)!;
  });

  const defaultBucket: MockStorageBucket = {
    download: vi.fn().mockResolvedValue({ data: null, error: { message: "not configured" } }),
  };

  return {
    from: fromFn,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn().mockReturnValue(defaultBucket),
    },
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      },
    },
    setTableData(table, data, error = null) {
      tableBuilders.set(table, createMockQueryBuilder(data, error));
    },
  };
}

// ---------------------------------------------------------------------------
// Anthropic API mock response
// ---------------------------------------------------------------------------

/**
 * Returns a `Response`-like object matching the shape returned by
 * `fetch("https://api.anthropic.com/v1/messages", ...)`.
 */
export function createAnthropicResponse(content: string, ok = true): Response {
  if (!ok) {
    return new Response(content, { status: 500, statusText: "Internal Server Error" });
  }

  return new Response(
    JSON.stringify({
      content: [{ type: "text", text: content }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// Resend API mock response
// ---------------------------------------------------------------------------

/**
 * Returns a `Response`-like object matching the shape returned by
 * `fetch("https://api.resend.com/emails", ...)`.
 */
export function createResendResponse(ok = true): Response {
  if (!ok) {
    return new Response(JSON.stringify({ message: "Resend error" }), {
      status: 400,
      statusText: "Bad Request",
    });
  }

  return new Response(JSON.stringify({ id: "mock-email-id" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

/**
 * Creates a minimal `Request` that mirrors what `Deno.serve` would receive.
 */
export function createEdgeRequest(
  body: unknown,
  method: string = "POST",
): Request {
  if (method === "OPTIONS") {
    return new Request("http://localhost", { method: "OPTIONS" });
  }

  return new Request("http://localhost", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/**
 * Reads a `Response`, parses its JSON body, and returns both the parsed data
 * and the raw response for status / header assertions.
 */
export async function parseResponse<T = unknown>(
  response: Response,
): Promise<{ data: T; status: number; headers: Headers }> {
  const data = (await response.json()) as T;
  return { data, status: response.status, headers: response.headers };
}
