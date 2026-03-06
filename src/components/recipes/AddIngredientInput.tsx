import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AddIngredientInputProps {
  onSubmit: (text: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

const AddIngredientInput = ({ onSubmit, placeholder, className }: AddIngredientInputProps) => {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(text);
      setText("");
    } catch (error) {
      console.error("Error adding ingredient:", error);
      toast.error("Failed to add ingredient");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`space-y-2${className ? ` ${className}` : ""}`}>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? "Add ingredients, e.g. 2 cups flour, 1 lb chicken, olive oil"}
        className="min-h-[80px] text-sm"
        disabled={isSubmitting}
      />
      <div className="flex justify-end">
        <Button
          variant="default"
          size="sm"
          onClick={handleAdd}
          disabled={!text.trim() || isSubmitting}
          className="text-xs"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Adding ingredients...
            </>
          ) : (
            <>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AddIngredientInput;
