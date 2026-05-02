import type { SmartGroceryItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";

const DEV_EMAILS = import.meta.env.DEV ? ["dev@example.com"] : [];

export const ANYLIST_ALLOWED_EMAILS: ReadonlySet<string> = new Set([
  "dsaltz190@gmail.com",
  "sarahgsaltz@gmail.com",
  ...DEV_EMAILS,
]);

export function isAnyListEnabledForUser(email: string | null | undefined): boolean {
  return !!email && ANYLIST_ALLOWED_EMAILS.has(email);
}

export interface SendToAnyListOptions {
  items: SmartGroceryItem[];
  eventName: string;
  checkedItems?: Set<string>;
}

export interface SendToAnyListResult {
  itemsAdded: number;
  itemsRemoved: number;
  listName: string;
}

export async function sendToAnyList({
  items,
  eventName,
  checkedItems,
}: SendToAnyListOptions): Promise<SendToAnyListResult> {
  const unchecked = checkedItems?.size
    ? items.filter((i) => !checkedItems.has(i.name))
    : items;

  if (unchecked.length === 0) {
    throw new Error("No grocery items to send");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const payload = {
    items: unchecked.map((item) => ({
      name: item.name,
      displayName: item.displayName,
      totalQuantity: item.totalQuantity,
      unit: item.unit,
      category: item.category,
      sourceRecipes: item.sourceRecipes,
    })),
    eventName,
  };

  const response = await fetch("/api/anylist-sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    itemsAdded?: number;
    itemsRemoved?: number;
    listName?: string;
    error?: string;
  };

  if (!response.ok || !body.success) {
    throw new Error(body.error || `AnyList sync failed (HTTP ${response.status})`);
  }

  return {
    itemsAdded: body.itemsAdded ?? 0,
    itemsRemoved: body.itemsRemoved ?? 0,
    listName: body.listName ?? "",
  };
}

export function openAnyList(): void {
  // Best-effort deep link. Skip on desktop browsers — AnyList's `anylist://`
  // scheme is typically only registered by the iOS/Android apps, and Chrome
  // logs a warning when no handler exists. Mobile users get a clean app-open;
  // desktop users see the success toast and open AnyList themselves.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) return;
  window.location.href = "anylist://";
}
