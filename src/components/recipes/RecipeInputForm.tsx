/* eslint-disable react-refresh/only-export-components */
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadRecipeFile, FileValidationError } from "@/lib/upload";
import { parseFractionToDecimal } from "@/lib/groceryList";
import IngredientFormRows from "./IngredientFormRows";
import { createBlankRow, type IngredientRow } from "./ingredientRowTypes";

export type InputMode = "url" | "upload" | "manual";

export interface RecipeFormData {
  name: string;
  url: string;
  inputMode: InputMode;
  ingredientRows: IngredientRow[];
  pasteText: string;
}

interface RecipeInputFormProps {
  formData: RecipeFormData;
  onFormDataChange: (data: RecipeFormData) => void;
  isUploading?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  nameLabel?: string;
  namePlaceholder?: string;
  showManualMode?: boolean;
  /** When true, manual mode shows only a paste textarea instead of row-by-row entry */
  manualPasteOnly?: boolean;
}

export function createInitialFormData(): RecipeFormData {
  return {
    name: "",
    url: "",
    inputMode: "url",
    ingredientRows: [createBlankRow()],
    pasteText: "",
  };
}

export function canSubmitRecipeForm(data: RecipeFormData, isSubmitting: boolean, pasteOnly?: boolean): boolean {
  if (!data.name.trim() || isSubmitting) return false;
  if (data.inputMode === "url" && (!data.url.trim() || !isValidUrl(data.url))) return false;
  if (data.inputMode === "upload" && (!data.url.trim() || !isValidUrl(data.url))) return false;
  if (data.inputMode === "manual") {
    if (pasteOnly) {
      if (!data.pasteText.trim()) return false;
    } else {
      if (!data.ingredientRows.some((r) => r.name.trim())) return false;
    }
  }
  return true;
}

export function buildIngredientPayload(rows: IngredientRow[]) {
  return rows
    .filter((r) => r.name.trim())
    .map((r, i) => ({
      name: r.name.trim(),
      quantity: parseFractionToDecimal(r.quantity) ?? 1,
      unit: r.unit.trim() || null,
      category: r.category,
      sort_order: i,
    }));
}

function isValidUrl(value: string) {
  return value.trim().startsWith("http://") || value.trim().startsWith("https://");
}

const RecipeInputForm = ({
  formData,
  onFormDataChange,
  isUploading: externalUploading,
  onUploadingChange,
  nameLabel = "Recipe Name *",
  namePlaceholder = "Enter recipe name",
  showManualMode = true,
  manualPasteOnly = false,
}: RecipeInputFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploadingFile = externalUploading ?? false;
  const uploadingFileNameRef = useRef("");

  const update = (partial: Partial<RecipeFormData>) => {
    onFormDataChange({ ...formData, ...partial });
  };

  const handleModeChange = (mode: InputMode) => {
    const changes: Partial<RecipeFormData> = { inputMode: mode };
    if (mode !== "url" && mode !== "upload") changes.url = "";
    if (mode !== "manual") {
      changes.ingredientRows = [createBlankRow()];
      changes.pasteText = "";
    }
    onFormDataChange({ ...formData, ...changes });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onUploadingChange?.(true);
    uploadingFileNameRef.current = file.name;
    try {
      const publicUrl = await uploadRecipeFile(file);
      const changes: Partial<RecipeFormData> = { url: publicUrl };
      if (!formData.name.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        changes.name = baseName;
      }
      onFormDataChange({ ...formData, ...changes });
      toast.success("File uploaded!");
    } catch (error) {
      if (error instanceof FileValidationError) {
        toast.error(error.message);
      } else {
        console.error("Error uploading file:", error);
        toast.error("Failed to upload file");
      }
    } finally {
      onUploadingChange?.(false);
      uploadingFileNameRef.current = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-1.5 sm:space-y-2">
        <Label htmlFor="recipe-input-name" className="text-sm">{nameLabel}</Label>
        <Input
          id="recipe-input-name"
          value={formData.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={namePlaceholder}
        />
      </div>

      {/* Mode selection */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-sm">Ingredient Source</Label>
        <div className="inline-flex h-9 sm:h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
          <button
            className={cn(
              "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all",
              formData.inputMode === "url" && "bg-background text-foreground shadow-sm"
            )}
            onClick={() => handleModeChange("url")}
          >
            URL
          </button>
          <button
            className={cn(
              "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all",
              formData.inputMode === "upload" && "bg-background text-foreground shadow-sm"
            )}
            onClick={() => handleModeChange("upload")}
          >
            Upload
          </button>
          {showManualMode && (
            <button
              className={cn(
                "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all",
                formData.inputMode === "manual" && "bg-background text-foreground shadow-sm"
              )}
              onClick={() => handleModeChange("manual")}
            >
              Manual
            </button>
          )}
        </div>
      </div>

      {/* URL mode */}
      {formData.inputMode === "url" && (
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="recipe-input-url" className="text-sm">Recipe URL *</Label>
          <Input
            id="recipe-input-url"
            type="url"
            value={formData.url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://..."
            className={formData.url.trim() && !isValidUrl(formData.url) ? "border-red-500" : ""}
          />
          {formData.url.trim() && !isValidUrl(formData.url) && (
            <p className="text-sm text-red-500">
              URL must start with http:// or https://
            </p>
          )}
        </div>
      )}

      {/* Upload mode */}
      {formData.inputMode === "upload" && (
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Upload Photo or PDF</Label>
          <div className="flex gap-2">
            <Input
              type="url"
              value={formData.url}
              onChange={(e) => update({ url: e.target.value })}
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
                  <span className="text-xs truncate max-w-[100px]">{uploadingFileNameRef.current}</span>
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
      {formData.inputMode === "manual" && manualPasteOnly && (
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Ingredients</Label>
          <Textarea
            value={formData.pasteText}
            onChange={(e) => update({ pasteText: e.target.value })}
            placeholder="Add ingredients, e.g. 2 cups flour, 1 lb chicken, olive oil"
            className="min-h-[120px] text-sm"
            aria-label="Ingredients text"
          />
        </div>
      )}
      {formData.inputMode === "manual" && !manualPasteOnly && (
        <div className="space-y-1.5 sm:space-y-2">
          <Label className="text-sm">Ingredients</Label>
          <IngredientFormRows
            rows={formData.ingredientRows}
            onRowsChange={(rows) => update({ ingredientRows: rows })}
          />
        </div>
      )}
    </div>
  );
};

export default RecipeInputForm;
