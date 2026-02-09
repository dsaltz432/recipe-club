import { supabase } from "../integrations/supabase/client";
import type { User } from "../types";
import { toast } from "sonner";

export interface AllowedUser {
  id: string;
  email: string;
  role: "admin" | "viewer";
  is_club_member: boolean;
}

export const isAuthenticated = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
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
    role: data.role as "admin" | "viewer",
    is_club_member: data.is_club_member,
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

// Synchronous check - requires allowedUser data to be passed in
export const isAdmin = (allowedUser: AllowedUser | null): boolean => {
  return allowedUser?.role === "admin";
};

export const signInWithGoogle = async (): Promise<void> => {
  // Get the current site URL dynamically
  const siteUrl = window.location.origin;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: siteUrl + "/dashboard",
      scopes: "https://www.googleapis.com/auth/calendar.events",
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
