import { describe, it, expect, vi, beforeEach } from "vitest";

describe("supabase client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates a supabase client when env vars are set", async () => {
    const mockClient = { auth: {}, from: vi.fn() };
    const mockCreateClient = vi.fn().mockReturnValue(mockClient);

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: mockCreateClient,
    }));

    // Env vars are set by default in vite test environment
    // (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY come from .env files)
    const mod = await import("@/integrations/supabase/client");

    expect(mod.supabase).toBe(mockClient);
    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String)
    );
  });

  it("throws when VITE_SUPABASE_URL is missing", async () => {
    const savedUrl = import.meta.env.VITE_SUPABASE_URL;
    const savedKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Clear both env vars
    import.meta.env.VITE_SUPABASE_URL = "";
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = savedKey;

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(),
    }));

    try {
      await expect(
        import("@/integrations/supabase/client")
      ).rejects.toThrow("Missing Supabase environment variables");
    } finally {
      // Restore env vars
      import.meta.env.VITE_SUPABASE_URL = savedUrl;
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = savedKey;
    }
  });

  it("throws when VITE_SUPABASE_PUBLISHABLE_KEY is missing", async () => {
    const savedUrl = import.meta.env.VITE_SUPABASE_URL;
    const savedKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Set URL but clear key
    import.meta.env.VITE_SUPABASE_URL = savedUrl;
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = "";

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(),
    }));

    try {
      await expect(
        import("@/integrations/supabase/client")
      ).rejects.toThrow("Missing Supabase environment variables");
    } finally {
      // Restore env vars
      import.meta.env.VITE_SUPABASE_URL = savedUrl;
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = savedKey;
    }
  });
});
