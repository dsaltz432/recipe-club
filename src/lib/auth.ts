import { supabase } from "../integrations/supabase/client";
import type { User } from "../types";
import { toast } from "sonner";

export interface AllowedUser {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  is_club_member: boolean;
  access_type: "club";
}

/**
 * getSession() can throw LockAcquireTimeoutError when navigator.locks is
 * contended (e.g. token refresh after returning from a background tab).
 * This helper retries with a short delay to wait for the lock to clear.
 */
async function getSessionWithRetry(retries = 3, delayMs = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await supabase.auth.getSession();
    } catch {
      if (i === retries) return null;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

export const isAuthenticated = async (): Promise<boolean> => {
  const result = await getSessionWithRetry();
  return result?.data?.session !== null;
};

export const getAllowedUser = async (email: string): Promise<AllowedUser | null> => {
  const { data, error } = await supabase
    .from("allowed_users")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    role: data.role as "admin" | "member" | "viewer",
    is_club_member: data.is_club_member,
    access_type: "club",
  };
};

export const getClubMemberEmails = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("allowed_users")
    .select("email")
    .eq("is_club_member", true);

  if (error || !data) {
    return [];
  }

  return data.map((u) => u.email);
};


export const getCurrentUser = async (): Promise<User | null> => {
  const result = await getSessionWithRetry();
  const session = result?.data?.session;

  if (!session) {
    return null;
  }

  // First try to get the user from the profiles table
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (profileError) {
    console.error("Profile query failed:", profileError);
  }

  if (profileData) {
    return {
      id: session.user.id,
      name:
        profileData.name ||
        session.user.user_metadata.name ||
        session.user.email?.split("@")[0] ||
        "User",
      email: session.user.email || "",
      avatar_url:
        profileData.avatar_url ||
        session.user.user_metadata.avatar_url,
    };
  }

  // If no profile found, use the user data from the session
  return {
    id: session.user.id,
    name:
      session.user.user_metadata.name ||
      session.user.email?.split("@")[0] ||
      "User",
    email: session.user.email || "",
    avatar_url: session.user.user_metadata.avatar_url,
  };
};

// Synchronous check - requires allowedUser data to be passed in
export const isAdmin = (allowedUser: AllowedUser | null): boolean => {
  return allowedUser?.role === "admin";
};

export const isMemberOrAdmin = (allowedUser: AllowedUser | null): boolean => {
  return allowedUser?.role === "admin" || allowedUser?.role === "member";
};

export const signInWithGoogle = async (forceConsent = false, redirectTo?: string): Promise<void> => {
  // Get the current site URL dynamically
  const siteUrl = window.location.origin;

  const queryParams: Record<string, string> = { access_type: "offline" };
  if (forceConsent) {
    queryParams.prompt = "consent";
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo ?? siteUrl + "/dashboard",
      scopes: "https://www.googleapis.com/auth/calendar.events",
      queryParams,
    },
  });

  if (error) {
    toast.error("Failed to sign in with Google: " + error.message);
    throw error;
  }
};

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<void> => {
  // Try to sign in first
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInError) {
    return;
  }

  // If invalid credentials, try to sign up (auto-creates in local dev)
  // Check for various error messages across Supabase versions
  const isInvalidCreds =
    signInError.message.includes("Invalid login credentials") ||
    signInError.message.includes("invalid_credentials") ||
    signInError.status === 400;

  if (isInvalidCreds) {
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      // User exists but wrong password — tell them to use the right one
      if (signUpError.message.includes("already registered")) {
        toast.error(
          "Wrong password. Use the password you first signed up with, or run 'npm run dev:reset' to reset the local database."
        );
        throw signUpError;
      }
      toast.error("Failed to create account: " + signUpError.message);
      throw signUpError;
    }
    return;
  }

  toast.error("Failed to sign in: " + signInError.message);
  throw signInError;
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
