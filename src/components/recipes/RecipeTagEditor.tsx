import { cn } from "@/lib/utils";
import { RECIPE_TAGS } from "@/lib/recipeTags";

interface RecipeTagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

const RecipeTagEditor = ({ tags, onChange }: RecipeTagEditorProps) => {
  const toggle = (value: string) => {
    if (tags.includes(value)) {
      onChange(tags.filter((t) => t !== value));
    } else {
      onChange([...tags, value]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Recipe tags">
      {RECIPE_TAGS.map(({ value, color }) => {
        const active = tags.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              "hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? cn(color, "opacity-100")
                : "bg-white border-gray-200 text-gray-500 opacity-70 hover:border-gray-300"
            )}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
};

export default RecipeTagEditor;
