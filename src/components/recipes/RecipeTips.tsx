import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { useRecipeTips } from "@/hooks/useRecipeTips";

interface RecipeTipsProps {
  recipeId: string;
  userId?: string;
  /** When true, renders with dark background styling for cook mode */
  darkMode?: boolean;
}

const RecipeTips = ({ recipeId, userId, darkMode = false }: RecipeTipsProps) => {
  const { tips, loading, fetchTips, addTip, deleteTip } = useRecipeTips(recipeId);
  const [newTipText, setNewTipText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    fetchTips();
  }, [fetchTips]);

  const handleAdd = async () => {
    if (!newTipText.trim() || !userId) return;
    setIsAdding(true);
    const success = await addTip(newTipText, userId);
    setIsAdding(false);
    if (success) {
      toast.success("Tip added!");
      setNewTipText("");
      setShowInput(false);
    } else {
      toast.error("Failed to add tip");
    }
  };

  const handleDelete = async (tipId: string) => {
    const success = await deleteTip(tipId);
    if (success) {
      toast.success("Tip removed");
    } else {
      toast.error("Failed to remove tip");
    }
  };

  const labelCls = darkMode ? "text-slate-300" : "text-muted-foreground";
  const tipCls = darkMode
    ? "bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-200"
    : "bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm text-foreground";

  // Hide entirely while loading, or when empty and the user can't add tips
  if (loading) return null;
  if (tips.length === 0 && !userId && !showInput) return null;

  return (
    <div className={`space-y-2 ${darkMode ? "text-white" : ""}`}>
      <div className="flex items-center gap-1.5">
        <Lightbulb className={`h-3.5 w-3.5 ${darkMode ? "text-amber-400" : "text-amber-500"}`} />
        <span className={`text-xs font-medium ${labelCls}`}>Cooking Tips</span>
        {userId && tips.length > 0 && (
          <button
            onClick={() => setShowInput(!showInput)}
            className={`ml-auto text-xs ${darkMode ? "text-slate-400 hover:text-white" : "text-muted-foreground hover:text-foreground"} transition-colors`}
            aria-label="Add tip"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {tips.length === 1 ? (
        <div className={`flex items-start gap-2 ${tipCls}`}>
          <p className="flex-1 leading-snug">{tips[0].tipText}</p>
          {userId === tips[0].userId && (
            <button
              onClick={() => handleDelete(tips[0].id)}
              aria-label="Delete tip"
              className={`flex-shrink-0 ${darkMode ? "text-slate-500 hover:text-red-400" : "text-muted-foreground hover:text-destructive"} transition-colors`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : tips.length > 1 ? (
        <ul className={`${tipCls} space-y-1.5`}>
          {tips.map((tip) => (
            <li key={tip.id} className="flex items-start gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${darkMode ? "bg-amber-400" : "bg-amber-500"}`} />
              <p className="flex-1 leading-snug">{tip.tipText}</p>
              {userId === tip.userId && (
                <button
                  onClick={() => handleDelete(tip.id)}
                  aria-label="Delete tip"
                  className={`flex-shrink-0 ${darkMode ? "text-slate-500 hover:text-red-400" : "text-muted-foreground hover:text-destructive"} transition-colors`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Empty state: show inline prompt instead of blocking text */}
      {tips.length === 0 && userId && !showInput && (
        <button
          onClick={() => setShowInput(true)}
          className={`text-xs ${darkMode ? "text-slate-500 hover:text-slate-300" : "text-muted-foreground/60 hover:text-muted-foreground"} transition-colors`}
        >
          + Add the first tip
        </button>
      )}

      {showInput && userId && (
        <div className="space-y-1.5">
          <Textarea
            value={newTipText}
            onChange={(e) => setNewTipText(e.target.value)}
            placeholder="Share a cooking tip..."
            className={`text-sm min-h-[64px] ${darkMode ? "bg-slate-800 border-slate-600 text-white placeholder:text-slate-400" : ""}`}
            aria-label="New tip text"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newTipText.trim() || isAdding}
              className="h-7 text-xs"
            >
              {isAdding ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowInput(false); setNewTipText(""); }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeTips;
