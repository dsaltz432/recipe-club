import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@tests/utils";
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

// Mock uuid — two calls per upload: one for PendingFile id, one for the storage filename
vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-123"),
}));

// Mock URL.createObjectURL / revokeObjectURL
const mockCreateObjectURL = vi.fn(() => "blob:mock-preview-url");
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(globalThis, "URL", {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

function selectFiles(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}

describe("PhotoUpload", () => {
  const mockOnPhotosChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/photo.jpg" },
    });
    mockUpload.mockResolvedValue({ error: null });
    mockRemove.mockResolvedValue({ error: null });
    mockCreateObjectURL.mockReturnValue("blob:mock-preview-url");
  });

  it("renders empty state when no photos", () => {
    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    expect(screen.getByText(/click to upload photos or pdfs/i)).toBeInTheDocument();
    expect(screen.getByText(/files \(0\/5\)/i)).toBeInTheDocument();
  });

  it("renders with custom maxPhotos", () => {
    render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} maxPhotos={3} />
    );
    expect(screen.getByText(/files \(0\/3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/max 3 files/i)).toBeInTheDocument();
  });

  it("renders upload button", () => {
    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    expect(screen.getByRole("button", { name: /upload files/i })).toBeInTheDocument();
  });

  it("hides upload button when max photos reached", () => {
    const photos = [
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
      "https://example.com/3.jpg",
      "https://example.com/4.jpg",
      "https://example.com/5.jpg",
    ];
    render(<PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />);
    expect(screen.queryByRole("button", { name: /upload files/i })).not.toBeInTheDocument();
  });

  it("renders photo grid when photos exist", () => {
    const photos = [
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg",
    ];
    render(<PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", photos[0]);
    expect(images[1]).toHaveAttribute("src", photos[1]);
  });

  it("shows correct photo count", () => {
    const photos = ["https://example.com/photo1.jpg"];
    render(<PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />);
    expect(screen.getByText(/files \(1\/5\)/i)).toBeInTheDocument();
  });

  it("handles successful file upload", async () => {
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/uploaded.jpg" },
    });

    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([new File(["test"], "test.jpg", { type: "image/jpeg" })]);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
      expect(mockOnPhotosChange).toHaveBeenCalledWith(["https://example.com/uploaded.jpg"]);
      expect(toast.success).toHaveBeenCalledWith("Uploaded 1 file(s)");
    });
  });

  it("handles multiple file upload", async () => {
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/uploaded.jpg" },
    });

    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
    ]);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith("Uploaded 2 file(s)");
    });
  });

  it("rejects non-image and non-PDF files with inline error", async () => {
    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([new File(["test"], "test.txt", { type: "text/plain" })]);

    await waitFor(() => {
      // Shows inline error in the pending card
      expect(screen.getByText(/unsupported type/i)).toBeInTheDocument();
      // Does not attempt upload
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  it("rejects files larger than 10MB with inline error", async () => {
    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);

    const largeContent = new Uint8Array(11 * 1024 * 1024);
    const file = new File([largeContent], "large.jpg", { type: "image/jpeg" });
    selectFiles([file]);

    await waitFor(() => {
      expect(screen.getByText(/too large/i)).toBeInTheDocument();
      expect(mockUpload).not.toHaveBeenCalled();
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

    selectFiles([
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
    ]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Maximum 5 photos allowed");
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  it("handles upload error — shows error in pending card", async () => {
    mockUpload.mockResolvedValue({ error: { message: "Upload failed" } });

    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([new File(["test"], "test.jpg", { type: "image/jpeg" })]);

    await waitFor(() => {
      expect(screen.getByText(/failed to upload/i)).toBeInTheDocument();
    });
  });

  it("has aria-labels on remove photo buttons", () => {
    const photos = [
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg",
    ];
    render(<PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />);

    expect(screen.getByRole("button", { name: "Remove photo 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove photo 2" })).toBeInTheDocument();
  });

  it("handles photo removal", async () => {
    const photos = ["https://example.com/storage/recipe-photos/photo1.jpg"];
    render(<PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />);

    const removeButton = screen.getByRole("button", { name: "Remove photo 1" });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalled();
      expect(mockOnPhotosChange).toHaveBeenCalledWith([]);
      expect(toast.success).toHaveBeenCalledWith("Photo removed");
    });
  });

  it("handles photo removal error gracefully", async () => {
    mockRemove.mockResolvedValue({ error: { message: "Delete failed" } });

    const photos = ["https://example.com/storage/recipe-photos/photo1.jpg"];
    render(<PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />);

    const removeButton = screen.getByRole("button", { name: "Remove photo 1" });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockOnPhotosChange).toHaveBeenCalledWith([]);
      expect(toast.success).toHaveBeenCalledWith("Photo removed");
    });
  });

  it("does not call onPhotosChange when no files selected", () => {
    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [], configurable: true });
    fireEvent.change(input);

    expect(mockOnPhotosChange).not.toHaveBeenCalled();
  });

  it("shows loading state during upload", async () => {
    mockUpload.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
    );

    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([new File(["test"], "test.jpg", { type: "image/jpeg" })]);

    // Uploading button text appears while upload is in progress
    await waitFor(() => {
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    });

    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
    });
  });

  it("clicking empty state triggers file input", () => {
    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);

    const emptyState = screen.getByText(/click to upload photos or pdfs/i).closest("div");
    expect(emptyState).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(emptyState!);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("handles successful PDF upload", async () => {
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/uploaded.pdf" },
    });

    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([new File(["pdf content"], "recipe.pdf", { type: "application/pdf" })]);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
      expect(mockOnPhotosChange).toHaveBeenCalledWith(["https://example.com/uploaded.pdf"]);
      expect(toast.success).toHaveBeenCalledWith("Uploaded 1 file(s)");
    });
  });

  it("renders PDF files with special icon", () => {
    const photos = [
      "https://example.com/photo1.jpg",
      "https://example.com/recipe.pdf",
    ];
    render(<PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(1);
    expect(screen.getByText("PDF")).toBeInTheDocument();
    const pdfLink = screen.getByRole("link");
    expect(pdfLink).toHaveAttribute("href", "https://example.com/recipe.pdf");
    expect(pdfLink).toHaveAttribute("target", "_blank");
  });

  it("shows image preview while uploading", async () => {
    // Make upload take a moment so we can observe pending state
    mockUpload.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 50))
    );

    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([new File(["test"], "photo.jpg", { type: "image/jpeg" })]);

    // Preview image should appear immediately using the object URL
    await waitFor(() => {
      const previewImg = screen.getByAltText(/preview of photo\.jpg/i);
      expect(previewImg).toBeInTheDocument();
      expect(previewImg).toHaveAttribute("src", "blob:mock-preview-url");
    });

    // Wait for upload to finish
    await waitFor(() => {
      expect(mockOnPhotosChange).toHaveBeenCalled();
    });
  });

  it("allows removing a pending file via cancel button", async () => {
    let resolveUpload!: (v: { error: null }) => void;
    mockUpload.mockReturnValue(new Promise((r) => { resolveUpload = r; }));

    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([new File(["test"], "photo.jpg", { type: "image/jpeg" })]);

    // Pending card appears with a remove button
    await waitFor(() => {
      expect(screen.getByAltText(/preview of photo\.jpg/i)).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: /remove photo\.jpg/i });
    fireEvent.click(cancelBtn);

    // Pending card is gone
    expect(screen.queryByAltText(/preview of photo\.jpg/i)).not.toBeInTheDocument();

    // Resolve upload — result should NOT be added to photos
    await act(async () => { resolveUpload({ error: null }); });
    expect(mockOnPhotosChange).not.toHaveBeenCalled();
  });

  it("allows dismissing an error card", async () => {
    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([new File(["test"], "bad.txt", { type: "text/plain" })]);

    await waitFor(() => {
      expect(screen.getByText(/unsupported type/i)).toBeInTheDocument();
    });

    const dismissBtn = screen.getByRole("button", { name: /remove bad\.txt/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/unsupported type/i)).not.toBeInTheDocument();
  });

  it("revokes object URL when pending file is removed", async () => {
    let resolveUpload!: (v: { error: null }) => void;
    mockUpload.mockReturnValue(new Promise((r) => { resolveUpload = r; }));

    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);
    selectFiles([new File(["test"], "photo.jpg", { type: "image/jpeg" })]);

    await waitFor(() => {
      expect(screen.getByAltText(/preview of photo\.jpg/i)).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: /remove photo\.jpg/i });
    fireEvent.click(cancelBtn);

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-preview-url");

    // Clean up dangling promise
    await act(async () => { resolveUpload({ error: null }); });
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
    mockCreateObjectURL.mockReturnValue("blob:mock-preview-url");
  });

  it("correctly extracts file extension", async () => {
    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);

    const file = new File(["test"], "my.photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
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
    mockCreateObjectURL.mockReturnValue("blob:mock-preview-url");
  });

  it("handles unexpected error during photo removal", async () => {
    mockRemove.mockRejectedValueOnce(new Error("Network failure"));

    const photos = ["https://example.com/storage/recipe-photos/photo1.jpg"];
    render(<PhotoUpload photos={photos} onPhotosChange={mockOnPhotosChange} />);

    const removeButton = screen.getByRole("button", { name: "Remove photo 1" });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove photo");
    });
  });

  it("clicking upload button triggers file input", () => {
    render(<PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />);

    const uploadButton = screen.getByRole("button", { name: /upload files/i });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.click(uploadButton);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("handles unmount during upload gracefully", async () => {
    let resolveUpload!: (v: { error: null }) => void;
    mockUpload.mockReturnValue(new Promise((r) => { resolveUpload = r; }));

    const { unmount } = render(
      <PhotoUpload photos={[]} onPhotosChange={mockOnPhotosChange} />
    );

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    unmount();

    // Resolve after unmount — should not throw
    await act(async () => { resolveUpload({ error: null }); });
    expect(mockUpload).toHaveBeenCalled();
  });
});
