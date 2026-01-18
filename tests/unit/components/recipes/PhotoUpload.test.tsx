import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import PhotoUpload from "@/components/recipes/PhotoUpload";
import { toast } from "sonner";

// Mock Supabase
const mockUpload = vi.fn();
const mockRemove = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: mockUpload,
        remove: mockRemove,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock uuid
vi.mock("uuid", () => ({
  v4: () => "mock-uuid-123",
}));

describe("PhotoUpload", () => {
  const mockOnPhotosChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/photo.jpg" },
    });
    mockUpload.mockResolvedValue({ error: null });
    mockRemove.mockResolvedValue({ error: null });
  });

  it("renders empty state when no photos", () => {
    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    expect(screen.getByText(/click to upload photos/i)).toBeInTheDocument();
    expect(screen.getByText(/photos \(0\/5\)/i)).toBeInTheDocument();
  });

  it("renders with custom maxPhotos", () => {
    render(
      <PhotoUpload
        photos={[]}
        onPhotosChange={mockOnPhotosChange}
        maxPhotos={3}
      />
    );

    expect(screen.getByText(/photos \(0\/3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/max 3 photos/i)).toBeInTheDocument();
  });

  it("renders upload button", () => {
    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    expect(screen.getByRole("button", { name: /upload photos/i })).toBeInTheDocument();
  });

  it("hides upload button when max photos reached", () => {
    const photos = [
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
      "https://example.com/3.jpg",
      "https://example.com/4.jpg",
      "https://example.com/5.jpg",
    ];

    render(
      <PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />
    );

    expect(screen.queryByRole("button", { name: /upload photos/i })).not.toBeInTheDocument();
  });

  it("renders photo grid when photos exist", () => {
    const photos = [
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg",
    ];

    render(
      <PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />
    );

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", photos[0]);
    expect(images[1]).toHaveAttribute("src", photos[1]);
  });

  it("shows correct photo count", () => {
    const photos = ["https://example.com/photo1.jpg"];

    render(
      <PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />
    );

    expect(screen.getByText(/photos \(1\/5\)/i)).toBeInTheDocument();
  });

  it("handles successful file upload", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/uploaded.jpg" },
    });

    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
      expect(mockOnPhotosChange).toHaveBeenCalledWith(["https://example.com/uploaded.jpg"]);
      expect(toast.success).toHaveBeenCalledWith("Uploaded 1 photo(s)");
    });
  });

  it("handles multiple file upload", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/uploaded.jpg" },
    });

    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
    const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file1, file2],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith("Uploaded 2 photo(s)");
    });
  });

  it("rejects non-image files", async () => {
    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const file = new File(["test"], "test.txt", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("test.txt is not an image");
    });
  });

  it("rejects files larger than 5MB", async () => {
    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    // Create a file larger than 5MB
    const largeContent = new Array(6 * 1024 * 1024).fill("x").join("");
    const file = new File([largeContent], "large.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("large.jpg is too large (max 5MB)");
    });
  });

  it("prevents exceeding max photos", async () => {
    const existingPhotos = [
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
      "https://example.com/3.jpg",
      "https://example.com/4.jpg",
    ];

    render(
      <PhotoUpload photos={existingPhotos} onPhotosChange={mockOnPhotosChange} />
    );

    const file1 = new File(["test1"], "test1.jpg", { type: "image/jpeg" });
    const file2 = new File(["test2"], "test2.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file1, file2],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Maximum 5 photos allowed");
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  it("handles upload error", async () => {
    mockUpload.mockResolvedValue({ error: { message: "Upload failed" } });

    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to upload photos");
    });
  });

  it("handles photo removal", async () => {
    const photos = ["https://example.com/storage/recipe-photos/photo1.jpg"];

    render(
      <PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />
    );

    // Find the remove button inside the photo grid (it's the button with the X icon)
    const photoContainer = document.querySelector(".relative.group");
    expect(photoContainer).toBeInTheDocument();
    const removeButton = photoContainer?.querySelector('button[type="button"]');
    expect(removeButton).toBeInTheDocument();

    fireEvent.click(removeButton!);

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalled();
      expect(mockOnPhotosChange).toHaveBeenCalledWith([]);
      expect(toast.success).toHaveBeenCalledWith("Photo removed");
    });
  });

  it("handles photo removal error gracefully", async () => {
    mockRemove.mockResolvedValue({ error: { message: "Delete failed" } });

    const photos = ["https://example.com/storage/recipe-photos/photo1.jpg"];

    render(
      <PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />
    );

    const photoContainer = document.querySelector(".relative.group");
    const removeButton = photoContainer?.querySelector('button[type="button"]');
    fireEvent.click(removeButton!);

    await waitFor(() => {
      // Should still remove from UI even if storage delete fails
      expect(mockOnPhotosChange).toHaveBeenCalledWith([]);
      expect(toast.success).toHaveBeenCalledWith("Photo removed");
    });
  });

  it("does not call onPhotosChange when no files selected", () => {
    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [],
    });

    fireEvent.change(input);

    expect(mockOnPhotosChange).not.toHaveBeenCalled();
  });

  it("shows loading state during upload", async () => {
    // Make upload take longer
    mockUpload.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
    );

    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    // Check for loading state
    await waitFor(() => {
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    });

    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
    });
  });

  it("clicking empty state triggers file input", () => {
    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const emptyState = screen.getByText(/click to upload photos/i).closest("div");
    expect(emptyState).toBeInTheDocument();

    // Check that clicking the area would trigger file input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.click(emptyState!);

    expect(clickSpy).toHaveBeenCalled();
  });
});

describe("PhotoUpload - File Extension Handling", () => {
  const mockOnPhotosChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/uploaded.jpg" },
    });
    mockUpload.mockResolvedValue({ error: null });
  });

  it("correctly extracts file extension", async () => {
    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const file = new File(["test"], "my.photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(/^recipe-photos\/mock-uuid-123\.png$/),
        expect.any(File)
      );
    });
  });
});

describe("PhotoUpload - Error Handling", () => {
  const mockOnPhotosChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/uploaded.jpg" },
    });
    mockUpload.mockResolvedValue({ error: null });
    mockRemove.mockResolvedValue({ error: null });
  });

  it("handles unexpected error during photo removal", async () => {
    // Make remove throw an exception instead of returning an error object
    mockRemove.mockRejectedValueOnce(new Error("Network failure"));

    const photos = ["https://example.com/storage/recipe-photos/photo1.jpg"];

    render(
      <PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />
    );

    const photoContainer = document.querySelector(".relative.group");
    const removeButton = photoContainer?.querySelector('button[type="button"]');
    fireEvent.click(removeButton!);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove photo");
    });
  });

  it("clicking upload button triggers file input", () => {
    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const uploadButton = screen.getByRole("button", { name: /upload photos/i });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.click(uploadButton);

    expect(clickSpy).toHaveBeenCalled();
  });

  it("handles unmount during upload gracefully (null ref)", async () => {
    // Create a deferred promise to control when upload completes
    let resolveUpload: (value: { error: null }) => void;
    const uploadPromise = new Promise<{ error: null }>((resolve) => {
      resolveUpload = resolve;
    });
    mockUpload.mockReturnValue(uploadPromise);

    const { unmount } = render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    // Start the upload
    fireEvent.change(input);

    // Unmount the component while upload is in progress
    unmount();

    // Resolve the upload after unmount - this triggers the finally block
    // where fileInputRef.current will be null
    resolveUpload!({ error: null });

    // Wait for any pending promises to settle
    await new Promise((resolve) => setTimeout(resolve, 0));

    // No error should occur - the finally block handles null ref gracefully
    expect(mockUpload).toHaveBeenCalled();
  });
});
