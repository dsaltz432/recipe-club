import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, signInWithGoogle } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthGuardProps {
  children: React.ReactNode;
}

// Module-level flag to prevent duplicate onAuthStateChange listeners
let refreshTokenListenerRegistered = false;

const AuthGuard = ({ children }: AuthGuardProps) => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      if (!mounted) return;
      if (!authenticated) {
        toast.info("Your session has expired. Please sign in again.");
        navigate("/");
      } else {
        setIsAuthed(true);
      }
      setIsChecking(false);
    };

    checkAuth();
    return () => { mounted = false; };
  }, [navigate]);

  // Register a one-time listener to capture Google OAuth refresh tokens
  useEffect(() => {
    if (refreshTokenListenerRegistered) return;
    refreshTokenListenerRegistered = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN") {
        if (session?.provider_refresh_token) {
          // Save the refresh token we just received
          await supabase.from("user_tokens").upsert(
            {
              user_id: session.user.id,
              provider: "google",
              refresh_token: session.provider_refresh_token,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,provider" }
          );
        } else if (session) {
          // No refresh token returned (repeat login) — check if we already have one stored.
          // If not, force re-consent so Google issues a new refresh token.
          const { data } = await supabase
            .from("user_tokens")
            .select("user_id")
            .eq("user_id", session.user.id)
            .eq("provider", "google")
            .maybeSingle();
          if (!data) {
            await signInWithGoogle(true);
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      refreshTokenListenerRegistered = false;
    };
  }, []);

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
