import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import PantryContent from "./PantryContent";

interface PantryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onPantryChange?: () => void;
}

const PantryDialog = ({ open, onOpenChange, userId, onPantryChange }: PantryDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">My Pantry</DialogTitle>
          <DialogDescription>
            Items you already have at home. These will be excluded from grocery lists.
          </DialogDescription>
        </DialogHeader>
        <PantryContent userId={userId} onPantryChange={onPantryChange} active={open} />
      </DialogContent>
    </Dialog>
  );
};

export default PantryDialog;
