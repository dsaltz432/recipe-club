import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAllowedUser, isMemberOrAdmin, signInWithGoogle } from "@/lib/auth";
import { isDevMode } from "@/lib/devMode";
import {
  CALENDAR_RECONNECT_EVENT,
  checkCalendarConnection,
  type CalendarConnectionStatus,
} from "@/lib/googleCalendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const CHECKED_KEY = "gcal-connection-checked";
export const DISMISSED_KEY = "gcal-reconnect-dismissed";

const safeGet = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode etc.) — check will just rerun
  }
};

interface CalendarReconnectPromptProps {
  /**
   * Changes whenever AuthGuard saves a new Google refresh token, so the
   * connection is re-checked (and "connected" recorded) right after reconnecting.
   */
  tokenSavedAt?: number | null;
}

/**
 * Checks once per browser session whether a club member's Google Calendar
 * connection still works, and asks them to reconnect if it doesn't. Also opens
 * on demand when an invite fails (see requestCalendarReconnect).
 */
const CalendarReconnectPrompt = ({ tokenSavedAt = null }: CalendarReconnectPromptProps) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CalendarConnectionStatus | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const runCheck = useCallback(async (force: boolean) => {
    if (isDevMode()) return;
    if (!force && safeGet(CHECKED_KEY)) return;

    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user?.email) return;

    // Only Google sign-ins can send invites; email/password users can't connect.
    const providers: string[] = (user.app_metadata?.providers as string[] | undefined) ??
      (user.app_metadata?.provider ? [user.app_metadata.provider as string] : []);
    if (!providers.includes("google")) return;

    // Only members/admins create club events.
    const allowed = await getAllowedUser(user.email);
    if (!isMemberOrAdmin(allowed)) return;

    const result = await checkCalendarConnection();
    // Don't mark as checked on transient errors, so the next load tries again.
    if (result.status !== "error") safeSet(CHECKED_KEY, "1");

    setStatus(result.status);
    if (result.needsReconnect && !safeGet(DISMISSED_KEY)) {
      setOpen(true);
    }
    if (result.status === "connected") {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    // runCheck only sets state after awaiting the network check
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runCheck(tokenSavedAt !== null);
  }, [runCheck, tokenSavedAt]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(CALENDAR_RECONNECT_EVENT, handler);
    return () => window.removeEventListener(CALENDAR_RECONNECT_EVENT, handler);
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      // forceConsent so Google issues a new refresh token
      await signInWithGoogle(true, window.location.href);
    } catch {
      setIsReconnecting(false);
    }
  };

  const handleDismiss = () => {
    safeSet(DISMISSED_KEY, "1");
    setOpen(false);
  };

  const description =
    status === "missing_scope"
      ? "Recipe Club doesn't have permission to add events to your Google Calendar, so invites can't be sent when you create an event. Reconnect and make sure calendar access is checked."
      : "Your Google Calendar connection has expired, so calendar invites can't be sent when you create an event. Reconnect to fix it — it only takes a moment.";

  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleDismiss())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reconnect Google Calendar</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDismiss}>Not now</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleReconnect();
            }}
            disabled={isReconnecting}
          >
            {isReconnecting ? "Redirecting…" : "Reconnect"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CalendarReconnectPrompt;
