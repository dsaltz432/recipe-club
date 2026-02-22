import { describe, it, expect } from "vitest";

describe("use-toast", () => {
  it("re-exports toast from sonner", async () => {
    const mod = await import("@/hooks/use-toast");
    expect(mod.toast).toBeDefined();
    expect(typeof mod.toast).toBe("function");
  });
});
