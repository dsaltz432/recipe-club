import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadRecipeFile, FileValidationError } from "@/lib/upload";
import { parseFractionToDecimal } from "@/lib/groceryList";
import IngredientFormRows, { createBlankRow, type IngredientRow } from "./IngredientFormRows";

type InputMode = "url" | "upload" | "manual";

interface AddPersonalRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onRecipeAdded: () => void;
}

const AddPersonalRecipeDialog = ({
  open,
  onOpenChange,
  userId,
  onRecipeAdded,
}: AddPersonalRecipeDialogProps) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([createBlankRow()]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidUrl = (value: string) => {
    return value.trim().startsWith("http://") || value.trim().startsWith("https://");
  };

  const resetForm = () => {
    setName("");
    setUrl("");
    setInputMode("url");
    setIngredientRows([createBlankRow()]);
    setIsUploadingFile(false);
    setUploadingFileName("");
  };

  const handleModeChange = (mode: InputMode) => {
    setInputMode(mode);
    if (mode !== "url" && mode !== "upload") setUrl("");
    if (mode !== "manual") setIngredientRows([createBlankRow()]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    setUploadingFileName(file.name);
    try {
      const publicUrl = await uploadRecipeFile(file);
      setUrl(publicUrl);
      if (!name.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setName(baseName);
      }
      toast.success("File uploaded!");
    } catch (error) {
      if (error instanceof FileValidationError) {
        toast.error(error.message);
      } else {
        console.error("Error uploading file:", error);
        toast.error("Failed to upload file");
      }
    } finally {
      setIsUploadingFile(false);
      setUploadingFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Create recipe
      const { data: recipeData, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          name: name.trim(),
          url: (inputMode === "url" || inputMode === "upload") ? (url.trim() || null) : null,
          created_by: userId,
          event_id: null,
          ingredient_id: null,
        })
        .select("id")
        .single();

      if (recipeError) throw recipeError;

      const recipeId = recipeData.id;

      if (inputMode === "manual") {
        // Insert ingredients via RPC
        const ingredientData = ingredientRows
          .filter((r) => r.name.trim())
          .map((r, i) => ({
            name: r.name.trim(),
            quantity: parseFractionToDecimal(r.quantity) ?? null,
            unit: r.unit.trim() || null,
            category: r.category,
            sort_order: i,
          }));

        if (ingredientData.length > 0) {
          const { error: rpcError } = await supabase.rpc("replace_recipe_ingredients", {
            p_recipe_id: recipeId,
            p_ingredients: ingredientData,
          });
          if (rpcError) throw rpcError;

          // Insert recipe_content row with status 'completed' so ingredients display immediately
          await supabase.from("recipe_content").insert({
            recipe_id: recipeId,
            status: "completed",
          });
        }
      }

      toast.success("Personal recipe added!");
      resetForm();
      onOpenChange(false);
      onRecipeAdded();
    } catch (error) {
      console.error("Error adding personal recipe:", error);
      toast.error("Failed to add recipe");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = () => {
    if (!name.trim() || isSubmitting) return false;
    if (inputMode === "url" && (!url.trim() || !isValidUrl(url))) return false;
    if (inputMode === "upload" && (!url.trim() || !isValidUrl(url))) return false;
    if (inputMode === "manual" && !ingredientRows.some((r) => r.name.trim())) return false;
    return true;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className={cn(
        "max-h-[85vh] overflow-y-auto",
        inputMode === "manual" ? "sm:max-w-2xl" : "sm:max-w-lg"
      )}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Add Personal Recipe
          </DialogTitle>
          <DialogDescription>
            Add a recipe to your personal collection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="personal-recipe-name">Recipe Name *</Label>
            <Input
              id="personal-recipe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter recipe name"
            />
          </div>

          {/* Mode selection */}
          <div className="space-y-2">
            <Label>Ingredient Source</Label>
            <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
              <button
                className={cn(
                  "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
                  inputMode === "url" && "bg-background text-foreground shadow-sm"
                )}
                onClick={() => handleModeChange("url")}
              >
                Enter URL
              </button>
              <button
                className={cn(
                  "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
                  inputMode === "upload" && "bg-background text-foreground shadow-sm"
                )}
                onClick={() => handleModeChange("upload")}
              >
                Upload File
              </button>
              <button
                className={cn(
                  "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
                  inputMode === "manual" && "bg-background text-foreground shadow-sm"
                )}
                onClick={() => handleModeChange("manual")}
              >
                Enter Manually
              </button>
            </div>
          </div>

          {/* URL mode */}
          {inputMode === "url" && (
            <div className="space-y-2">
              <Label htmlFor="personal-recipe-url">Recipe URL *</Label>
              <Input
                id="personal-recipe-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className={url.trim() && !isValidUrl(url) ? "border-red-500" : ""}
              />
              {url.trim() && !isValidUrl(url) && (
                <p className="text-sm text-red-500">
                  URL must start with http:// or https://
                </p>
              )}
            </div>
          )}

          {/* Upload mode */}
          {inputMode === "upload" && (
            <div className="space-y-2">
              <Label>Upload Photo or PDF</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="File URL will appear here..."
                  readOnly
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  className="shrink-0"
                  aria-label="Upload photo or PDF"
                >
                  {isUploadingFile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      <span className="text-xs truncate max-w-[100px]">{uploadingFileName}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Manual mode */}
          {inputMode === "manual" && (
            <div className="space-y-2">
              <Label>Ingredients</Label>
              <IngredientFormRows rows={ingredientRows} onRowsChange={setIngredientRows} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit()}
            className="bg-purple hover:bg-purple-dark"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Recipe"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddPersonalRecipeDialog;
