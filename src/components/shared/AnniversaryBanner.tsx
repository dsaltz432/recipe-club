import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import { PartyPopper, X } from "lucide-react";
import { CLUB_FOUNDED_DATE, getAnniversaryInfo, toOrdinal } from "@/lib/anniversary";

const COLORS = ["#9b87f5", "#F97316", "#F6A000", "#E5DEFF", "#FEC6A1"];

const dismissedKey = (year: number) => `recipe-club-anniversary-dismissed-${year}`;

// Storage can throw (private mode, blocked site data) — treat that as "not set"
const readFlag = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key) === "true";
  } catch {
    return false;
  }
};

const writeFlag = (storage: Storage, key: string) => {
  try {
    storage.setItem(key, "true");
  } catch {
    // ignore
  }
};

const AnniversaryBanner = () => {
  const [info] = useState(() => getAnniversaryInfo());
  const year = info?.date.getFullYear() ?? 0;
  const [dismissed, setDismissed] = useState(() => !info || readFlag(localStorage, dismissedKey(year)));

  // One short burst each time the banner appears — celebratory, then out of the way.
  // The confetti canvas ignores pointer events, so the page stays usable.
  useEffect(() => {
    if (!info || dismissed) return;

    const shared = {
      particleCount: 60,
      spread: 60,
      startVelocity: 45,
      ticks: 180,
      colors: COLORS,
      disableForReducedMotion: true,
    };
    confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.7 } });
    confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.7 } });
  }, [info, dismissed]);

  if (!info || dismissed) return null;

  const handleDismiss = () => {
    writeFlag(localStorage, dismissedKey(year));
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="relative max-w-3xl mx-auto mb-4 md:mb-6 rounded-xl border border-purple/20 bg-gradient-to-r from-purple-light/70 via-white to-orange-light/60 px-4 py-3 pr-10 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <PartyPopper className="h-6 w-6 shrink-0 text-orange" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-display text-base sm:text-lg font-bold text-gray-900">
            Happy {toOrdinal(info.years)} Anniversary, Recipe Club!
          </p>
          <p className="text-sm text-muted-foreground">
            {info.isToday
              ? `${info.years} years ago today, the club was born. Here's to many more meals together.`
              : `Cooking together since ${format(CLUB_FOUNDED_DATE, "MMMM d, yyyy")}. Here's to many more meals together.`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss anniversary banner"
        className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:bg-purple/10 hover:text-gray-900 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default AnniversaryBanner;
