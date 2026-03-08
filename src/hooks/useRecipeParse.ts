import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCachedAiModel } from "@/lib/userPreferences";

export type ParseStatus = "idle" | "parsing" | "failed";
export type ParseStep = "saving" | "parsing" | "loading" | "done";

interface UseRecipeParseOptions {
  /** Called after a successful parse (e.g. reload data) */
  onSuccess?: () => void;
  /** Called after user chooses "Keep as-is" (e.g. reload data) */
  onKeep?: () => void;
  /** Called before recipe deletion on discard (e.g. delete meal_plan_items) */
  onBeforeDiscard?: (recipeId: string) => Promise<void>;
  /** Called after discard completes (e.g. reload data) */
  onDiscard?: () => void;
}

export function useRecipeParse({
  onSuccess,
  onKeep,
  onBeforeDiscard,
  onDiscard,
}: UseRecipeParseOptions = {}) {
  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [parseStep, setParseStep] = useState<ParseStep>("saving");
  const [pendingParseRecipeId, setPendingParseRecipeId] = useState<string | null>(null);
  const [pendingParseName, setPendingParseName] = useState<string>("");
  const [pendingParseUrl, setPendingParseUrl] = useState<string>("");
  const [pendingParseText, setPendingParseText] = useState<string>("");

  const resetState = () => {
    setPendingParseRecipeId(null);
    setPendingParseName("");
    setPendingParseUrl("");
    setPendingParseText("");
    setParseStep("saving");
  };

  const startParse = (
    recipeId: string,
    name: string,
    { url, text }: { url?: string; text?: string } = {}
  ) => {
    setPendingParseRecipeId(recipeId);
    setPendingParseName(name);
    setPendingParseUrl(url ?? "");
    setPendingParseText(text ?? "");
    setParseStep("saving");
    setParseStatus("parsing");
  };

  useEffect(() => {
    if (parseStatus !== "parsing" || !pendingParseRecipeId) return;

    const doParse = async () => {
      try {
        setParseStep("saving");
        await new Promise((resolve) => setTimeout(resolve, 200));

        setParseStep("parsing");
        const parseBody: Record<string, string> = {
          recipeId: pendingParseRecipeId,
          recipeName: pendingParseName,
          model: getCachedAiModel(),
        };
        if (pendingParseText) {
          parseBody.text = pendingParseText;
        } else {
          parseBody.recipeUrl = pendingParseUrl;
        }

        const { data: parseData, error } = await supabase.functions.invoke("parse-recipe", {
          body: parseBody,
        });
        if (error) throw error;
        if (!parseData?.success) throw new Error(parseData?.error ?? "Failed to parse recipe");

        setParseStep("loading");
        await new Promise((resolve) => setTimeout(resolve, 500));

        setParseStep("done");
        await new Promise((resolve) => setTimeout(resolve, 2500));

        setParseStatus("idle");
        resetState();
        toast.success("Recipe parsed successfully!");
        onSuccess?.();
      } catch (error) {
        console.error("Error parsing recipe:", error);
        setParseStatus("failed");
      }
    };

    doParse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseStatus, pendingParseRecipeId]);

  const handleRetry = () => {
    setParseStep("saving");
    setParseStatus("parsing");
  };

  const handleKeep = () => {
    setParseStatus("idle");
    resetState();
    toast.success("Recipe saved without parsing");
    onKeep?.();
  };

  const handleDiscard = async () => {
    const recipeId = pendingParseRecipeId;
    if (recipeId) {
      await onBeforeDiscard?.(recipeId);
      await supabase.from("recipes").delete().eq("id", recipeId);
    }
    setParseStatus("idle");
    resetState();
    onDiscard?.();
  };

  return {
    parseStatus,
    parseStep,
    pendingParseName,
    startParse,
    handleRetry,
    handleKeep,
    handleDiscard,
  };
}
