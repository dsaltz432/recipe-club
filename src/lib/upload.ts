import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const BUCKET_NAME = "recipe-images";

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export function validateRecipeFile(file: File): void {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    throw new FileValidationError("Please select an image or PDF file");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new FileValidationError("File is too large (max 5MB)");
  }
}

export async function uploadRecipeFile(file: File): Promise<string> {
  validateRecipeFile(file);

  const fileExt = file.name.split(".").pop();
  const fileName = `${uuidv4()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

  return publicUrl;
}
