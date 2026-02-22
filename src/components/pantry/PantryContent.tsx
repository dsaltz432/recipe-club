import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getPantryItems, addPantryItem, removePantryItem, ensureDefaultPantryItems, DEFAULT_PANTRY_ITEMS } from "@/lib/pantry";

interface PantryContentProps {
  userId: string;
  onPantryChange?: () => void;
  active: boolean;
}

const PantryContent = ({ userId, onPantryChange, active }: PantryContentProps) => {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<{ id: string; name: string } | null>(null);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      await ensureDefaultPantryItems(userId);
      const data = await getPantryItems(userId);
      setItems(data);
    } catch (error) {
      console.error("Error loading pantry items:", error);
      toast.error("Failed to load pantry items");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (active) {
      loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handleAdd = async () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    setIsAdding(true);
    try {
      await addPantryItem(userId, trimmed);
      setNewItemName("");
      toast.success(`Added '${trimmed}' to pantry`);
      await loadItems();
      onPantryChange?.();
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code === "23505") {
        toast.error("This item is already in your pantry");
      } else {
        toast.error("Failed to add item");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveClick = (item: { id: string; name: string }) => {
    setConfirmDeleteItem(item);
  };

  const handleConfirmRemove = async () => {
    const item = confirmDeleteItem!;
    setConfirmDeleteItem(null);
    setDeletingId(item.id);
    try {
      await removePantryItem(userId, item.id);
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

  return (
    <>
      <div className="flex gap-2">
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
        <ul className="space-y-1 max-h-60 overflow-y-auto">
          {items.map((item) => {
            const isProtected = DEFAULT_PANTRY_ITEMS.includes(item.name.toLowerCase());
            return (
              <li
                key={item.id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group"
              >
                <span className="text-sm capitalize">{item.name}</span>
                {isProtected ? (
                  <span className="text-xs text-muted-foreground px-2">Default</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemoveClick(item)}
                    disabled={deletingId === item.id}
                    aria-label={`Remove ${item.name}`}
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!confirmDeleteItem} onOpenChange={() => setConfirmDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from pantry?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{confirmDeleteItem?.name}&rdquo; from your pantry?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PantryContent;
