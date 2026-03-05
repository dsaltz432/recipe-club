import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Use onAuthStateChange as the primary auth mechanism.
    // This handles token refreshes after returning from background tabs
    // without blocking on navigator.locks (which getSession() does).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || (!session && event === "INITIAL_SESSION")) {
        toast.info("Your session has expired. Please sign in again.");
        navigate("/");
        setIsAuthed(false);
        setIsChecking(false);
        return;
      }

      if (session) {
        setIsAuthed(true);
        setIsChecking(false);

        // Save Google OAuth refresh token when available
        if (event === "SIGNED_IN" && session.provider_refresh_token) {
          await supabase.from("user_tokens").upsert(
            {
              user_id: session.user.id,
              provider: "google",
              refresh_token: session.provider_refresh_token,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,provider" }
          );
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  if (!isAuthed) {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
