import type { SmartGroceryItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export interface InstacartItem {
  name: string;
  displayName: string;
  totalQuantity?: number;
  unit?: string;
}

export function transformForInstacart(items: SmartGroceryItem[]): InstacartItem[] {
  return items.map((item) => {
    const result: InstacartItem = {
      name: item.name,
      displayName: item.displayName,
    };
    if (item.totalQuantity != null) {
      result.totalQuantity = item.totalQuantity;
    }
    if (item.unit != null) {
      result.unit = item.unit;
    }
    return result;
  });
}

export async function sendToInstacart(
  items: SmartGroceryItem[],
  title: string
): Promise<string> {
  const instacartItems = transformForInstacart(items);

  const { data, error } = await supabase.functions.invoke("instacart-recipe", {
    body: { title, items: instacartItems },
  });

  if (error) throw error;

  if (data?.success === false) {
    throw new Error(data.error);
  }

  return data.products_link_url;
}
