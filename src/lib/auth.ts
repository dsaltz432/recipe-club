import { supabase } from "../integrations/supabase/client";
import type { User } from "../types";
import { toast } from "sonner";

export const isAuthenticated = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
};

export const getCurrentUser = async (): Promise<User | null> => {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return null;
  }

  // First try to get the user from the profiles table
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", sessionData.session.user.id)
    .single();

  if (profileData) {
    return {
      id: sessionData.session.user.id,
      name:
        profileData.name ||
        sessionData.session.user.user_metadata.name ||
        sessionData.session.user.email?.split("@")[0] ||
        "User",
      email: sessionData.session.user.email || "",
      avatar_url:
        profileData.avatar_url ||
        sessionData.session.user.user_metadata.avatar_url,
    };
  }

  // If no profile found, use the user data from the session
  return {
    id: sessionData.session.user.id,
    name:
      sessionData.session.user.user_metadata.name ||
      sessionData.session.user.email?.split("@")[0] ||
      "User",
    email: sessionData.session.user.email || "",
    avatar_url: sessionData.session.user.user_metadata.avatar_url,
  };
};

export const signInWithGoogle = async (): Promise<void> => {
  // Get the current site URL dynamically
  const siteUrl = window.location.origin;

  console.log("Redirecting to:", siteUrl + "/dashboard");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: siteUrl + "/dashboard",
    },
  });

  if (error) {
    toast.error("Failed to sign in with Google: " + error.message);
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    toast.error("Failed to sign out: " + error.message);
    throw error;
  }

  // Immediately redirect to homepage after signout
  window.location.href = "/";
};
