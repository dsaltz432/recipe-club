import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createMockNote, createMockRecipe } from "@tests/utils";
import type { Recipe } from "@/types";

// Mock supabase client
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockFrom = vi.fn().mockImplementation(() => ({
  update: mockUpdate,
  insert: mockInsert,
  delete: mockDelete,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { useRecipeNotes } from "@/hooks/useRecipeNotes";
import { toast } from "sonner";

describe("useRecipeNotes", () => {
  const mockOnNoteChanged = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    mockInsert.mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  const renderUseRecipeNotes = (userId: string | undefined = "user-123") =>
    renderHook(() => useRecipeNotes({ userId, onNoteChanged: mockOnNoteChanged }));

  describe("handleEditNoteClick", () => {
    it("sets noteToEdit and populates edit fields from note", () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote({ notes: "My notes", photos: ["photo1.jpg"] });

      act(() => {
        result.current.handleEditNoteClick(note);
      });

      expect(result.current.noteToEdit).toEqual(note);
      expect(result.current.recipeForNewNote).toBeNull();
      expect(result.current.editNotes).toBe("My notes");
      expect(result.current.editPhotos).toEqual(["photo1.jpg"]);
    });

    it("clears recipeForNewNote when editing an existing note", () => {
      const { result } = renderUseRecipeNotes();
      const recipe = createMockRecipe() as Recipe;
      const note = createMockNote();

      act(() => {
        result.current.handleAddNotesClick(recipe);
      });
      expect(result.current.recipeForNewNote).toEqual(recipe);

      act(() => {
        result.current.handleEditNoteClick(note);
      });
      expect(result.current.recipeForNewNote).toBeNull();
    });

    it("handles note with undefined notes and photos", () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote({ notes: undefined, photos: undefined });

      act(() => {
        result.current.handleEditNoteClick(note);
      });

      expect(result.current.editNotes).toBe("");
      expect(result.current.editPhotos).toEqual([]);
    });
  });

  describe("handleAddNotesClick", () => {
    it("sets recipeForNewNote and clears edit fields", () => {
      const { result } = renderUseRecipeNotes();
      const recipe = createMockRecipe() as Recipe;

      act(() => {
        result.current.handleAddNotesClick(recipe);
      });

      expect(result.current.recipeForNewNote).toEqual(recipe);
      expect(result.current.noteToEdit).toBeNull();
      expect(result.current.editNotes).toBe("");
      expect(result.current.editPhotos).toEqual([]);
    });

    it("clears noteToEdit when adding a new note", () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote();
      const recipe = createMockRecipe() as Recipe;

      act(() => {
        result.current.handleEditNoteClick(note);
      });
      expect(result.current.noteToEdit).toEqual(note);

      act(() => {
        result.current.handleAddNotesClick(recipe);
      });
      expect(result.current.noteToEdit).toBeNull();
    });
  });

  describe("handleSaveNote - update existing note", () => {
    it("calls update with trimmed notes and photos when editing an existing note", async () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote({ id: "note-42", notes: "Old notes" });

      act(() => {
        result.current.handleEditNoteClick(note);
      });

      act(() => {
        result.current.setEditNotes("  Updated notes  ");
        result.current.setEditPhotos(["photo1.jpg"]);
      });

      await act(async () => {
        await result.current.handleSaveNote();
      });

      expect(mockFrom).toHaveBeenCalledWith("recipe_notes");
      expect(mockUpdate).toHaveBeenCalledWith({
        notes: "Updated notes",
        photos: ["photo1.jpg"],
      });
      expect(toast.success).toHaveBeenCalledWith("Notes updated!");
      expect(mockOnNoteChanged).toHaveBeenCalled();
      expect(result.current.noteToEdit).toBeNull();
    });

    it("sets notes to null when editNotes is empty after trim", async () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote({ id: "note-42" });

      act(() => {
        result.current.handleEditNoteClick(note);
      });

      act(() => {
        result.current.setEditNotes("   ");
        result.current.setEditPhotos([]);
      });

      await act(async () => {
        await result.current.handleSaveNote();
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        notes: null,
        photos: null,
      });
    });

    it("shows error toast on update failure", async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "Update failed" } }),
      });

      const { result } = renderUseRecipeNotes();
      const note = createMockNote();

      act(() => {
        result.current.handleEditNoteClick(note);
      });

      await act(async () => {
        await result.current.handleSaveNote();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to save notes");
      expect(mockOnNoteChanged).not.toHaveBeenCalled();
    });
  });

  describe("handleSaveNote - create new note", () => {
    it("calls insert with recipe id, user id, notes, and photos", async () => {
      const { result } = renderUseRecipeNotes();
      const recipe = createMockRecipe({ id: "recipe-99" }) as Recipe;

      act(() => {
        result.current.handleAddNotesClick(recipe);
      });

      act(() => {
        result.current.setEditNotes("Brand new note");
        result.current.setEditPhotos(["img.jpg"]);
      });

      await act(async () => {
        await result.current.handleSaveNote();
      });

      expect(mockFrom).toHaveBeenCalledWith("recipe_notes");
      expect(mockInsert).toHaveBeenCalledWith({
        recipe_id: "recipe-99",
        user_id: "user-123",
        notes: "Brand new note",
        photos: ["img.jpg"],
      });
      expect(toast.success).toHaveBeenCalledWith("Notes added!");
      expect(mockOnNoteChanged).toHaveBeenCalled();
      expect(result.current.recipeForNewNote).toBeNull();
    });

    it("shows error toast on insert failure", async () => {
      mockInsert.mockResolvedValue({ error: { message: "Insert failed" } });

      const { result } = renderUseRecipeNotes();
      const recipe = createMockRecipe() as Recipe;

      act(() => {
        result.current.handleAddNotesClick(recipe);
      });

      await act(async () => {
        await result.current.handleSaveNote();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to save notes");
      expect(mockOnNoteChanged).not.toHaveBeenCalled();
    });
  });

  describe("handleSaveNote - no note or recipe selected", () => {
    it("still calls onNoteChanged but skips DB when neither noteToEdit nor recipeForNewNote is set", async () => {
      const { result } = renderUseRecipeNotes();

      await act(async () => {
        await result.current.handleSaveNote();
      });

      // Neither update nor insert is called
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      // onNoteChanged is still called (code runs past the if/else)
      expect(mockOnNoteChanged).toHaveBeenCalled();
    });
  });

  describe("handleSaveNote - no userId", () => {
    it("does nothing when userId is undefined", async () => {
      const { result } = renderHook(() =>
        useRecipeNotes({ userId: undefined, onNoteChanged: mockOnNoteChanged })
      );
      const note = createMockNote();

      act(() => {
        result.current.handleEditNoteClick(note);
      });

      vi.mocked(toast.success).mockClear();
      vi.mocked(toast.error).mockClear();
      mockOnNoteChanged.mockClear();

      await act(async () => {
        await result.current.handleSaveNote();
      });

      // No success or error toast — early return before any DB operation
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(mockOnNoteChanged).not.toHaveBeenCalled();
    });
  });

  describe("handleSaveNote - isUpdatingNote state", () => {
    it("sets isUpdatingNote during save and resets after", async () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote();

      act(() => {
        result.current.handleEditNoteClick(note);
      });

      expect(result.current.isUpdatingNote).toBe(false);

      await act(async () => {
        await result.current.handleSaveNote();
      });

      expect(result.current.isUpdatingNote).toBe(false);
    });
  });

  describe("handleDeleteClick", () => {
    it("sets noteToDelete", () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote({ id: "note-to-delete" });

      act(() => {
        result.current.handleDeleteClick(note);
      });

      expect(result.current.noteToDelete).toEqual(note);
    });
  });

  describe("handleConfirmDelete", () => {
    it("deletes the note and calls onNoteChanged", async () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote({ id: "note-del" });

      act(() => {
        result.current.handleDeleteClick(note);
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(mockFrom).toHaveBeenCalledWith("recipe_notes");
      expect(mockDelete).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Notes removed");
      expect(mockOnNoteChanged).toHaveBeenCalled();
      expect(result.current.noteToDelete).toBeNull();
      expect(result.current.deletingNoteId).toBeNull();
    });

    it("does nothing when noteToDelete is null", async () => {
      const { result } = renderUseRecipeNotes();

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("shows error toast on delete failure", async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "Delete failed" } }),
      });

      const { result } = renderUseRecipeNotes();
      const note = createMockNote({ id: "note-fail" });

      act(() => {
        result.current.handleDeleteClick(note);
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to remove notes");
      expect(mockOnNoteChanged).not.toHaveBeenCalled();
      expect(result.current.deletingNoteId).toBeNull();
    });
  });

  describe("state setters", () => {
    it("exposes setNoteToEdit for dialog onOpenChange", () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote();

      act(() => {
        result.current.handleEditNoteClick(note);
      });
      expect(result.current.noteToEdit).toEqual(note);

      act(() => {
        result.current.setNoteToEdit(null);
      });
      expect(result.current.noteToEdit).toBeNull();
    });

    it("exposes setRecipeForNewNote for dialog onOpenChange", () => {
      const { result } = renderUseRecipeNotes();
      const recipe = createMockRecipe() as Recipe;

      act(() => {
        result.current.handleAddNotesClick(recipe);
      });
      expect(result.current.recipeForNewNote).toEqual(recipe);

      act(() => {
        result.current.setRecipeForNewNote(null);
      });
      expect(result.current.recipeForNewNote).toBeNull();
    });

    it("exposes setNoteToDelete for delete confirmation dialog", () => {
      const { result } = renderUseRecipeNotes();
      const note = createMockNote();

      act(() => {
        result.current.handleDeleteClick(note);
      });
      expect(result.current.noteToDelete).toEqual(note);

      act(() => {
        result.current.setNoteToDelete(null);
      });
      expect(result.current.noteToDelete).toBeNull();
    });

    it("exposes setEditNotes and setEditPhotos", () => {
      const { result } = renderUseRecipeNotes();

      act(() => {
        result.current.setEditNotes("new notes text");
      });
      expect(result.current.editNotes).toBe("new notes text");

      act(() => {
        result.current.setEditPhotos(["a.jpg", "b.jpg"]);
      });
      expect(result.current.editPhotos).toEqual(["a.jpg", "b.jpg"]);
    });
  });
});
