import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon, Loader2, FileText, AlertCircle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface PhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string; // createObjectURL for images, "" for PDFs
  status: "uploading" | "error";
  error?: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE_LABEL = "10MB";

function validateFile(file: File): string | null {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    return `${file.name}: unsupported type — use JPG, PNG, WebP, or PDF`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${file.name} is too large (max ${MAX_FILE_SIZE_LABEL})`;
  }
  return null;
}

const PhotoUpload = ({
  photos,
  onPhotosChange,
  maxPhotos = 5,
}: PhotoUploadProps) => {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track cancelled upload IDs so async handlers can skip them
  const cancelledIdsRef = useRef<Set<string>>(new Set());

  // Revoke object URLs when component unmounts to prevent memory leaks
  const pendingFilesRef = useRef<PendingFile[]>([]);
  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);
  useEffect(() => {
    return () => {
      for (const pf of pendingFilesRef.current) {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      }
    };
  }, []);

  const removePending = useCallback((id: string) => {
    cancelledIdsRef.current.add(id);
    setPendingFiles((prev) => {
      const entry = prev.find((p) => p.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploadingCount = pendingFiles.filter((p) => p.status === "uploading").length;
    if (photos.length + uploadingCount + files.length > maxPhotos) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Build pending entries (validate + preview URL) synchronously
    const newEntries: PendingFile[] = Array.from(files).map((file) => {
      const error = validateFile(file);
      const previewUrl =
        !error && file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
      return {
        id: uuidv4(),
        file,
        previewUrl,
        status: (error ? "error" : "uploading") as "uploading" | "error",
        error: error ?? undefined,
      };
    });

    setPendingFiles((prev) => [...prev, ...newEntries]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const toUpload = newEntries.filter((e) => e.status === "uploading");
    if (toUpload.length === 0) return;

    // Upload all valid files concurrently
    const results = await Promise.allSettled(
      toUpload.map(async (entry) => {
        const fileExt = entry.file.name.split(".").pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `recipe-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("recipe-photos")
          .upload(filePath, entry.file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("recipe-photos").getPublicUrl(filePath);

        return { entryId: entry.id, publicUrl, previewUrl: entry.previewUrl };
      })
    );

    // Separate successes and failures
    const succeeded: { entryId: string; publicUrl: string; previewUrl: string }[] = [];
    const failedIds: string[] = [];

    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        succeeded.push(result.value);
      } else {
        failedIds.push(toUpload[i].id);
      }
    });

    // Mark failures in state
    if (failedIds.length > 0) {
      setPendingFiles((prev) =>
        prev.map((p) =>
          failedIds.includes(p.id)
            ? {
                ...p,
                status: "error" as const,
                error: `Failed to upload ${p.file.name}`,
              }
            : p
        )
      );
    }

    // Filter out cancelled uploads, add the rest to photos
    const cancelled = cancelledIdsRef.current;
    const notCancelled = succeeded.filter((s) => !cancelled.has(s.entryId));

    if (notCancelled.length > 0) {
      // Remove successful pending entries and revoke their preview URLs
      setPendingFiles((prev) =>
        prev.filter((p) => !notCancelled.some((s) => s.entryId === p.id))
      );
      for (const s of notCancelled) {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      }
      onPhotosChange([...photos, ...notCancelled.map((s) => s.publicUrl)]);
      toast.success(`Uploaded ${notCancelled.length} file(s)`);
    }
  };

  const removePhoto = async (photoUrl: string) => {
    try {
      const urlParts = photoUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `recipe-photos/${fileName}`;

      const { error } = await supabase.storage
        .from("recipe-photos")
        .remove([filePath]);

      if (error) {
        console.error("Error deleting from storage:", error);
      }

      onPhotosChange(photos.filter((p) => p !== photoUrl));
      toast.success("Photo removed");
    } catch (error) {
      console.error("Error removing photo:", error);
      toast.error("Failed to remove photo");
    }
  };

  const uploadingCount = pendingFiles.filter((p) => p.status === "uploading").length;
  const totalSlots = photos.length + uploadingCount;
  const canAddMore = totalSlots < maxPhotos;
  const isUploading = uploadingCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Files ({totalSlots}/{maxPhotos})
        </span>
        {canAddMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </>
            )}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload files"
        />
      </div>

      {photos.length === 0 && pendingFiles.length === 0 ? (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-purple-300 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Click to upload photos or PDFs
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max {maxPhotos} files, {MAX_FILE_SIZE_LABEL} each
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Uploaded photos */}
          {photos.map((photo, index) => {
            const isPdf = photo.toLowerCase().endsWith(".pdf");
            return (
              <div key={photo} className="relative group aspect-square">
                {isPdf ? (
                  <a
                    href={photo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <FileText className="h-12 w-12 text-red-500 mb-2" />
                    <span className="text-xs text-muted-foreground">PDF</span>
                  </a>
                ) : (
                  <img
                    src={photo}
                    alt={`Recipe photo ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove photo ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          {/* Pending files — uploading or errored */}
          {pendingFiles.map((pf) => (
            <div key={pf.id} className="relative aspect-square">
              {/* Preview or placeholder */}
              {pf.previewUrl ? (
                <img
                  src={pf.previewUrl}
                  alt={`Preview of ${pf.file.name}`}
                  className={`w-full h-full object-cover rounded-lg ${
                    pf.status === "error" ? "opacity-40" : "opacity-70"
                  }`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                  {pf.file.type === "application/pdf" ? (
                    <>
                      <FileText
                        className={`h-10 w-10 mb-1 ${
                          pf.status === "error" ? "text-red-300" : "text-red-400"
                        }`}
                      />
                      <span className="text-xs text-muted-foreground truncate max-w-[80%]">
                        {pf.file.name}
                      </span>
                    </>
                  ) : (
                    <ImageIcon className="h-10 w-10 text-gray-300" />
                  )}
                </div>
              )}

              {/* Uploading spinner overlay */}
              {pf.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              )}

              {/* Error overlay */}
              {pf.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/10 p-2">
                  <AlertCircle className="h-5 w-5 text-destructive mb-1 shrink-0" />
                  <p className="text-[10px] text-center text-destructive leading-tight line-clamp-3">
                    {pf.error}
                  </p>
                </div>
              )}

              {/* Remove / cancel button */}
              <button
                type="button"
                onClick={() => removePending(pf.id)}
                className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                aria-label={`Remove ${pf.file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
