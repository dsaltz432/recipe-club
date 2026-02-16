import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { isDevMode } from "@/lib/devMode";

interface ShareRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  recipeName: string;
  userId: string;
}

const ShareRecipeDialog = ({
  open,
  onOpenChange,
  recipeId,
  recipeName,
  userId,
}: ShareRecipeDialogProps) => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    setIsSubmitting(true);
    try {
      if (isDevMode()) {
        // In dev mode, insert directly without edge function
        const { error: shareError } = await supabase
          .from("recipe_shares")
          .insert({
            recipe_id: recipeId,
            shared_by: userId,
            shared_with_email: trimmedEmail,
            message: message.trim() || null,
          });

        if (shareError) {
          if (shareError.code === "23505") {
            toast.error("This recipe has already been shared with this email");
            return;
          }
          throw shareError;
        }
      } else {
        const { data, error } = await supabase.functions.invoke("send-recipe-share", {
          body: {
            recipeId,
            recipeName,
            sharedWithEmail: trimmedEmail,
            message: message.trim() || undefined,
            sharedByUserId: userId,
          },
        });

        if (error) throw error;
        if (data && !data.success) {
          throw new Error(data.error || "Failed to share recipe");
        }
      }

      toast.success(`Recipe shared with ${trimmedEmail}!`);
      setEmail("");
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error sharing recipe:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to share recipe";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setEmail("");
        setMessage("");
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Share Recipe
          </DialogTitle>
          <DialogDescription>
            Share &quot;{recipeName}&quot; with someone via email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="share-email">Email Address *</Label>
            <Input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className={email.trim() && !isValidEmail(email) ? "border-red-500" : ""}
            />
            {email.trim() && !isValidEmail(email) && (
              <p className="text-sm text-red-500">
                Please enter a valid email address
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-message">Message (optional)</Label>
            <Textarea
              id="share-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Check out this recipe!"
              rows={3}
            />
          </div>
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
            disabled={isSubmitting || !email.trim() || !isValidEmail(email)}
            className="bg-purple hover:bg-purple-dark"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Share
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareRecipeDialog;
