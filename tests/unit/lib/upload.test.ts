import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateRecipeFile, uploadRecipeFile, FileValidationError } from "@/lib/upload";

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  },
}));

vi.mock("uuid", () => ({
  v4: () => "mock-uuid-456",
}));

const createFile = (name: string, type: string, size = 1024) => {
  return new File(["x".repeat(size)], name, { type });
};

describe("upload utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/recipe-images/mock-uuid-456.jpg" },
    });
  });

  describe("FileValidationError", () => {
    it("is an instance of Error with correct name", () => {
      const error = new FileValidationError("test message");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("FileValidationError");
      expect(error.message).toBe("test message");
    });
  });

  describe("validateRecipeFile", () => {
    it("accepts image/jpeg files", () => {
      const file = createFile("photo.jpg", "image/jpeg");
      expect(() => validateRecipeFile(file)).not.toThrow();
    });

    it("accepts image/png files", () => {
      const file = createFile("photo.png", "image/png");
      expect(() => validateRecipeFile(file)).not.toThrow();
    });

    it("accepts image/webp files", () => {
      const file = createFile("photo.webp", "image/webp");
      expect(() => validateRecipeFile(file)).not.toThrow();
    });

    it("accepts application/pdf files", () => {
      const file = createFile("doc.pdf", "application/pdf");
      expect(() => validateRecipeFile(file)).not.toThrow();
    });

    it("rejects text/plain files", () => {
      const file = createFile("doc.txt", "text/plain");
      expect(() => validateRecipeFile(file)).toThrow(FileValidationError);
      expect(() => validateRecipeFile(file)).toThrow("Please select an image or PDF file");
    });

    it("rejects files over 5MB", () => {
      const file = createFile("big.jpg", "image/jpeg", 6 * 1024 * 1024);
      expect(() => validateRecipeFile(file)).toThrow(FileValidationError);
      expect(() => validateRecipeFile(file)).toThrow("File is too large (max 5MB)");
    });

    it("accepts files exactly 5MB", () => {
      const file = createFile("exact.jpg", "image/jpeg", 5 * 1024 * 1024);
      expect(() => validateRecipeFile(file)).not.toThrow();
    });
  });

  describe("uploadRecipeFile", () => {
    it("uploads a file and returns the public URL", async () => {
      const file = createFile("recipe.jpg", "image/jpeg");

      const result = await uploadRecipeFile(file);

      expect(mockUpload).toHaveBeenCalledWith("mock-uuid-456.jpg", file);
      expect(mockGetPublicUrl).toHaveBeenCalledWith("mock-uuid-456.jpg");
      expect(result).toBe("https://storage.example.com/recipe-images/mock-uuid-456.jpg");
    });

    it("uploads a PDF file with correct extension", async () => {
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: "https://storage.example.com/recipe-images/mock-uuid-456.pdf" },
      });
      const file = createFile("recipe.pdf", "application/pdf");

      const result = await uploadRecipeFile(file);

      expect(mockUpload).toHaveBeenCalledWith("mock-uuid-456.pdf", file);
      expect(result).toBe("https://storage.example.com/recipe-images/mock-uuid-456.pdf");
    });

    it("throws FileValidationError for invalid file type", async () => {
      const file = createFile("doc.txt", "text/plain");

      await expect(uploadRecipeFile(file)).rejects.toThrow(FileValidationError);
      await expect(uploadRecipeFile(file)).rejects.toThrow("Please select an image or PDF file");
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("throws FileValidationError for oversized files", async () => {
      const file = createFile("big.jpg", "image/jpeg", 6 * 1024 * 1024);

      await expect(uploadRecipeFile(file)).rejects.toThrow(FileValidationError);
      await expect(uploadRecipeFile(file)).rejects.toThrow("File is too large (max 5MB)");
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("throws on upload error", async () => {
      mockUpload.mockResolvedValueOnce({ error: new Error("Storage full") });
      const file = createFile("recipe.jpg", "image/jpeg");

      await expect(uploadRecipeFile(file)).rejects.toThrow("Storage full");
    });
  });
});
