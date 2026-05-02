import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isAnyListEnabledForUser,
  sendToAnyList,
  ANYLIST_ALLOWED_EMAILS,
} from "@/lib/anylist";
import type { SmartGroceryItem } from "@/types";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";

const items: SmartGroceryItem[] = [
  { name: "flour", displayName: "flour", totalQuantity: 2, unit: "cup", category: "pantry", sourceRecipes: ["Pasta"] },
  { name: "eggs", displayName: "eggs", totalQuantity: 3, unit: undefined, category: "dairy", sourceRecipes: ["Cake"] },
];

describe("isAnyListEnabledForUser", () => {
  it("returns true for allowed emails", () => {
    for (const email of ANYLIST_ALLOWED_EMAILS) {
      expect(isAnyListEnabledForUser(email)).toBe(true);
    }
  });

  it("returns false for unknown emails", () => {
    expect(isAnyListEnabledForUser("stranger@example.com")).toBe(false);
  });

  it("returns false for null/undefined/empty input", () => {
    expect(isAnyListEnabledForUser(null)).toBe(false);
    expect(isAnyListEnabledForUser(undefined)).toBe(false);
    expect(isAnyListEnabledForUser("")).toBe(false);
  });
});

describe("sendToAnyList", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: "test-token" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, itemsAdded: 2, itemsRemoved: 5, listName: "Groceries" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("posts items and event name to /api/anylist-sync with bearer token", async () => {
    await sendToAnyList({ items, eventName: "Italian Night" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/anylist-sync",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.eventName).toBe("Italian Night");
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ name: "flour", displayName: "flour", totalQuantity: 2, unit: "cup" });
  });

  it("filters checked items before sending", async () => {
    const checkedItems = new Set(["flour"]);
    await sendToAnyList({ items, eventName: "Test", checkedItems });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("eggs");
  });

  it("throws when there are no items to send", async () => {
    const allChecked = new Set(items.map((i) => i.name));
    await expect(
      sendToAnyList({ items, eventName: "Test", checkedItems: allChecked }),
    ).rejects.toThrow(/no grocery items/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when not authenticated", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await expect(sendToAnyList({ items, eventName: "Test" })).rejects.toThrow(
      /not authenticated/i,
    );
  });

  it("throws with the server error message on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, error: "Not authorized" }),
    });

    await expect(sendToAnyList({ items, eventName: "Test" })).rejects.toThrow(
      "Not authorized",
    );
  });

  it("returns parsed counts and listName on success", async () => {
    const result = await sendToAnyList({ items, eventName: "Test" });
    expect(result).toEqual({ itemsAdded: 2, itemsRemoved: 5, listName: "Groceries" });
  });
});
