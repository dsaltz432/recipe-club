import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Recipe, RecipeNote } from "@/types";

interface UseRecipeNotesOptions {
  userId: string | undefined;
  onNoteChanged: () => void;
}

export function useRecipeNotes({ userId, onNoteChanged }: UseRecipeNotesOptions) {
  const [noteToEdit, setNoteToEdit] = useState<RecipeNote | null>(null);
  const [recipeForNewNote, setRecipeForNewNote] = useState<Recipe | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<RecipeNote | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const handleEditNoteClick = (note: RecipeNote) => {
    setNoteToEdit(note);
    setRecipeForNewNote(null);
    setEditNotes(note.notes || "");
    setEditPhotos(note.photos || []);
  };

  const handleAddNotesClick = (recipe: Recipe) => {
    setRecipeForNewNote(recipe);
    setNoteToEdit(null);
    setEditNotes("");
    setEditPhotos([]);
  };

  const handleSaveNote = async () => {
    if (!userId) return;

    setIsUpdatingNote(true);
    try {
      if (noteToEdit) {
        const { error } = await supabase
          .from("recipe_notes")
          .update({
            notes: editNotes.trim() || null,
            photos: editPhotos.length > 0 ? editPhotos : null,
          })
          .eq("id", noteToEdit.id);

        if (error) throw error;
        toast.success("Notes updated!");
      } else if (recipeForNewNote) {
        const { error } = await supabase
          .from("recipe_notes")
          .insert({
            recipe_id: recipeForNewNote.id,
            user_id: userId,
            notes: editNotes.trim() || null,
            photos: editPhotos.length > 0 ? editPhotos : null,
          });

        if (error) throw error;
        toast.success("Notes added!");
      }

      setNoteToEdit(null);
      setRecipeForNewNote(null);
      onNoteChanged();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save notes");
    } finally {
      setIsUpdatingNote(false);
    }
  };

  const handleDeleteClick = (note: RecipeNote) => {
    setNoteToDelete(note);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;

    setDeletingNoteId(noteToDelete.id);
    setNoteToDelete(null);

    try {
      const { error } = await supabase
        .from("recipe_notes")
        .delete()
        .eq("id", noteToDelete.id);

      if (error) throw error;
      toast.success("Notes removed");
      onNoteChanged();
    } catch (error) {
      console.error("Error deleting notes:", error);
      toast.error("Failed to remove notes");
    } finally {
      setDeletingNoteId(null);
    }
  };

  return {
    // State
    noteToEdit,
    setNoteToEdit,
    recipeForNewNote,
    setRecipeForNewNote,
    editNotes,
    setEditNotes,
    editPhotos,
    setEditPhotos,
    isUpdatingNote,
    noteToDelete,
    setNoteToDelete,
    deletingNoteId,
    // Handlers
    handleEditNoteClick,
    handleAddNotesClick,
    handleSaveNote,
    handleDeleteClick,
    handleConfirmDelete,
  };
}
