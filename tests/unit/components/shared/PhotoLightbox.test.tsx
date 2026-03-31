import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import PhotoLightbox from "@/components/shared/PhotoLightbox";
import type { LightboxPhoto } from "@/components/shared/PhotoLightbox";

const photo1: LightboxPhoto = { src: "https://example.com/photo1.jpg", alt: "Photo 1", caption: "Alice's photo" };
const photo2: LightboxPhoto = { src: "https://example.com/photo2.jpg", alt: "Photo 2", caption: "Bob's photo" };
const photo3: LightboxPhoto = { src: "https://example.com/photo3.jpg", alt: "Photo 3" };

describe("PhotoLightbox", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <PhotoLightbox photos={[photo1]} initialIndex={0} open={false} onClose={vi.fn()} />
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("shows the current photo when open", () => {
    render(
      <PhotoLightbox photos={[photo1]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", photo1.src);
    expect(img).toHaveAttribute("alt", photo1.alt);
  });

  it("shows caption when provided", () => {
    render(
      <PhotoLightbox photos={[photo1]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    expect(screen.getByText("Alice's photo")).toBeInTheDocument();
  });

  it("does not show caption when absent", () => {
    render(
      <PhotoLightbox photos={[photo3]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    // photo3 has no caption — only the sr-only title should exist
    expect(screen.queryByText(/photo/i, { selector: "div" })).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <PhotoLightbox photos={[photo1]} initialIndex={0} open={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByLabelText("Close photo viewer"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows counter badge with multiple photos", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2, photo3]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("does not show counter badge with a single photo", () => {
    render(
      <PhotoLightbox photos={[photo1]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    expect(screen.queryByText(/\/ 1/)).not.toBeInTheDocument();
  });

  it("does not show prev button on the first photo", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    expect(screen.queryByLabelText("Previous photo")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Next photo")).toBeInTheDocument();
  });

  it("does not show next button on the last photo", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2]} initialIndex={1} open={true} onClose={vi.fn()} />
    );
    expect(screen.getByLabelText("Previous photo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Next photo")).not.toBeInTheDocument();
  });

  it("advances to the next photo when Next is clicked", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2, photo3]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText("Next photo"));
    expect(screen.getByRole("img")).toHaveAttribute("src", photo2.src);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("goes back to the previous photo when Prev is clicked", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2, photo3]} initialIndex={2} open={true} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText("Previous photo"));
    expect(screen.getByRole("img")).toHaveAttribute("src", photo2.src);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("navigates forward with the ArrowRight key", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("img")).toHaveAttribute("src", photo2.src);
  });

  it("navigates backward with the ArrowLeft key", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2]} initialIndex={1} open={true} onClose={vi.fn()} />
    );
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("img")).toHaveAttribute("src", photo1.src);
  });

  it("ArrowLeft does nothing on the first photo", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("img")).toHaveAttribute("src", photo1.src);
  });

  it("shows dot indicators for ≤ 8 photos", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2, photo3]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    const dotButtons = screen.getAllByLabelText(/^Go to photo \d+$/);
    expect(dotButtons).toHaveLength(3);
  });

  it("clicking a dot indicator jumps to that photo", () => {
    render(
      <PhotoLightbox photos={[photo1, photo2, photo3]} initialIndex={0} open={true} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByLabelText("Go to photo 3"));
    expect(screen.getByRole("img")).toHaveAttribute("src", photo3.src);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("resets to initialIndex when opened", () => {
    const { rerender } = render(
      <PhotoLightbox photos={[photo1, photo2, photo3]} initialIndex={0} open={false} onClose={vi.fn()} />
    );
    rerender(
      <PhotoLightbox photos={[photo1, photo2, photo3]} initialIndex={2} open={true} onClose={vi.fn()} />
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", photo3.src);
  });
});
