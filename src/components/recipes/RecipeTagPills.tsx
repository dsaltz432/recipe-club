import { cn } from "@/lib/utils";
import { getTagStyle } from "@/lib/recipeTags";

interface RecipeTagPillsProps {
  tags: string[];
  className?: string;
}

const RecipeTagPills = ({ tags, className }: RecipeTagPillsProps) => {
  if (tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            getTagStyle(tag)
          )}
        >
          {tag}
        </span>
      ))}
    </div>
  );
};

export default RecipeTagPills;
