import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon, Loader2, FileText } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface PhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

const PhotoUpload = ({
  photos,
  onPhotosChange,
  maxPhotos = 5,
}: PhotoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    setIsUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        if (!isImage && !isPdf) {
          throw new Error(`${file.name} is not an image or PDF`);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} is too large (max 5MB)`);
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `recipe-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("recipe-photos")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("recipe-photos").getPublicUrl(filePath);

        return publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      onPhotosChange([...photos, ...uploadedUrls]);
      toast.success(`Uploaded ${uploadedUrls.length} file(s)`);
    } catch (error) {
      console.error("Error uploading photos:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload photos"
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePhoto = async (photoUrl: string) => {
    try {
      // Extract file path from URL
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Files ({photos.length}/{maxPhotos})
        </span>
        {photos.length < maxPhotos && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
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
        />
      </div>

      {photos.length === 0 ? (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-purple/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Click to upload photos or PDFs
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max {maxPhotos} files, 5MB each
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, index) => {
            const isPdf = photo.toLowerCase().endsWith(".pdf");
            return (
              <div key={index} className="relative group aspect-square">
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
                  />
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
