import { useState, useRef, useEffect } from "react";
import { Pencil, X, Check, StickyNote } from "lucide-react";

interface DayNoteInputProps {
  dayOfWeek: number;
  note: string;
  onSave: (dayOfWeek: number, note: string) => Promise<void>;
}

const DayNoteInput = ({ dayOfWeek, note, onSave }: DayNoteInputProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when note prop changes (e.g., week switch)
  useEffect(() => {
    setDraft(note);
    setIsEditing(false);
  }, [note, dayOfWeek]);

  const startEditing = () => {
    setDraft(note);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(note);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (trimmed === note) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(dayOfWeek, trimmed);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={80}
          placeholder="Add a note..."
          disabled={isSaving}
          className="flex-1 min-w-0 text-[11px] bg-white border border-purple/30 rounded px-1.5 py-0.5 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-purple/40"
          aria-label="Day note"
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-purple hover:text-purple-dark transition-colors p-0.5 shrink-0"
          aria-label="Save note"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="text-muted-foreground hover:text-gray-600 transition-colors p-0.5 shrink-0"
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (note) {
    return (
      <div
        className="flex items-center gap-1 mt-0.5 group cursor-pointer"
        onClick={(e) => { e.stopPropagation(); startEditing(); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); startEditing(); } }}
        aria-label={`Edit note: ${note}`}
      >
        <StickyNote className="h-2.5 w-2.5 text-amber-500 shrink-0" />
        <span className="text-[10px] text-gray-500 truncate flex-1 italic">{note}</span>
        <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0" />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); startEditing(); }}
      className="mt-0.5 flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-purple transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      aria-label="Add note for this day"
      tabIndex={0}
    >
      <Pencil className="h-2.5 w-2.5" />
      <span className="hidden sm:inline">Add note</span>
    </button>
  );
};

export default DayNoteInput;
