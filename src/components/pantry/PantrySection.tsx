import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getPantryItems, addPantryItem, removePantryItem, ensureDefaultPantryItems } from "@/lib/pantry";

interface PantrySectionProps {
  userId?: string;
  onPantryChange?: () => void;
}

const PantrySection = ({ userId, onPantryChange }: PantrySectionProps) => {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      await ensureDefaultPantryItems(userId!);
      const data = await getPantryItems(userId!);
      setItems(data);
    } catch (error) {
      console.error("Error loading pantry items:", error);
      toast.error("Failed to load pantry items");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAdd = async () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    setIsAdding(true);
    try {
      await addPantryItem(userId!, trimmed);
      setNewItemName("");
      await loadItems();
      onPantryChange?.();
    } catch {
      toast.error("Failed to add item. It may already exist.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (itemId: string) => {
    setDeletingId(itemId);
    try {
      await removePantryItem(userId!, itemId);
      await loadItems();
      onPantryChange?.();
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <Card className="bg-white/90 backdrop-blur-sm border border-purple/10">
      <CardContent className="pt-4 sm:pt-6 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <UtensilsCrossed className="h-5 w-5 text-purple" />
          <h2 className="font-display text-lg sm:text-xl font-semibold">My Pantry</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Items you already have at home. These will be excluded from grocery lists.
        </p>

        <div className="flex gap-2 mb-4">
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add an item..."
            disabled={isAdding}
          />
          <Button
            onClick={handleAdd}
            disabled={isAdding || !newItemName.trim()}
            size="sm"
            className="shrink-0"
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-purple" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No pantry items yet. Add items you always have at home.
          </p>
        ) : (
          <ul className="space-y-1 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group"
              >
                <span className="text-sm capitalize">{item.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleRemove(item.id)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default PantrySection;
