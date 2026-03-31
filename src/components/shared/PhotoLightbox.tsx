import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface LightboxPhoto {
  src: string;
  alt?: string;
  caption?: string;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const PhotoLightbox = ({ photos, initialIndex = 0, open, onClose }: PhotoLightboxProps) => {
  const [index, setIndex] = useState(initialIndex);

  // Reset index to initialIndex each time the lightbox opens (open: false → true).
  // Tracks previous open value in state using the React getDerivedStateFromProps equivalent.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setIndex(initialIndex);
  }

  const canPrev = index > 0;
  const canNext = index < photos.length - 1;

  const prev = useCallback(() => {
    if (canPrev) setIndex((i) => i - 1);
  }, [canPrev]);

  const next = useCallback(() => {
    if (canNext) setIndex((i) => i + 1);
  }, [canNext]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, prev, next]);

  // Touch/swipe tracking
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return; // ignore tiny taps
    if (dx < 0) next();
    else prev();
  };

  const current = photos[index];
  if (!current) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center outline-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-label="Photo viewer"
        >
          <DialogPrimitive.Title className="sr-only">Photo viewer</DialogPrimitive.Title>

          {/* Close button */}
          <button
            className="absolute top-3 right-3 z-10 flex items-center justify-center h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            onClick={onClose}
            aria-label="Close photo viewer"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          {photos.length > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/50 text-white text-sm font-medium select-none">
              {index + 1} / {photos.length}
            </div>
          )}

          {/* Main image */}
          <div className="flex items-center justify-center w-full h-full px-14 sm:px-20 py-16">
            <img
              src={current.src}
              alt={current.alt ?? `Photo ${index + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg select-none"
              draggable={false}
            />
          </div>

          {/* Caption */}
          {current.caption && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-black/50 text-white text-sm text-center max-w-[80vw] truncate">
              {current.caption}
            </div>
          )}

          {/* Prev button */}
          {canPrev && (
            <button
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              onClick={prev}
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Next button */}
          {canNext && (
            <button
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              onClick={next}
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Dot indicators (when ≤ 8 photos) */}
          {photos.length > 1 && photos.length <= 8 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5" style={current.caption ? { bottom: "52px" } : {}}>
              {photos.map((_, i) => (
                <button
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to photo ${i + 1}`}
                />
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default PhotoLightbox;
