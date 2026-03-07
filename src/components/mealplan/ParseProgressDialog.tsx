import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import RecipeParseProgress from "@/components/recipes/RecipeParseProgress";

const PARSE_STEPS = [
  { key: "saving", label: "Adding recipe" },
  { key: "parsing", label: "Parsing ingredients & instructions" },
  { key: "loading", label: "Loading recipe data" },
];

interface ParseProgressDialogProps {
  parseStatus: "idle" | "parsing" | "failed";
  parseStep: "saving" | "parsing" | "loading" | "done";
  recipeName: string;
  onDiscard: () => void;
  onKeep: () => void;
  onRetry: () => void;
}

const ParseProgressDialog = ({
  parseStatus,
  parseStep,
  recipeName,
  onDiscard,
  onKeep,
  onRetry,
}: ParseProgressDialogProps) => {
  return (
    <Dialog
      open={parseStatus === "parsing" || parseStatus === "failed"}
      onOpenChange={() => {
        if (parseStatus === "failed") onKeep();
      }}
    >
      <DialogContent hideClose>
        <DialogHeader>
          <DialogTitle>
            {parseStatus === "failed" ? "Parsing Failed" : "Adding Recipe"}
          </DialogTitle>
          <DialogDescription>
            {parseStatus === "failed"
              ? `Failed to parse ingredients for "${recipeName}".`
              : `Extracting ingredients from "${recipeName}"...`}
          </DialogDescription>
        </DialogHeader>
        {parseStatus === "parsing" && (
          <RecipeParseProgress steps={PARSE_STEPS} currentStep={parseStep} />
        )}
        {parseStatus === "failed" && (
          <div className="flex justify-between gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDiscard}
              className="text-destructive hover:text-destructive"
            >
              Discard
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onKeep}>
                Keep as-is
              </Button>
              <Button size="sm" onClick={onRetry} className="bg-purple hover:bg-purple-dark">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ParseProgressDialog;
