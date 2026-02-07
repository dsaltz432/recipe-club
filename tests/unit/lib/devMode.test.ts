import { describe, it, expect, vi, beforeEach } from "vitest";

describe("isDevMode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("should return true when VITE_DEV_MODE is 'true'", async () => {
    vi.stubEnv("VITE_DEV_MODE", "true");
    const { isDevMode } = await import("@/lib/devMode");
    expect(isDevMode()).toBe(true);
  });

  it("should return false when VITE_DEV_MODE is not set", async () => {
    vi.stubEnv("VITE_DEV_MODE", "");
    const { isDevMode } = await import("@/lib/devMode");
    expect(isDevMode()).toBe(false);
  });

  it("should return false when VITE_DEV_MODE is 'false'", async () => {
    vi.stubEnv("VITE_DEV_MODE", "false");
    const { isDevMode } = await import("@/lib/devMode");
    expect(isDevMode()).toBe(false);
  });
});
