import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAdmin, type AllowedUser } from "@/lib/auth";

// Mock the supabase client module
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("isAdmin", () => {
  it("should return true for admin role", () => {
    const adminUser: AllowedUser = {
      id: "user-123",
      email: "admin@example.com",
      role: "admin",
      is_club_member: true,
    };

    expect(isAdmin(adminUser)).toBe(true);
  });

  it("should return false for viewer role", () => {
    const viewerUser: AllowedUser = {
      id: "user-123",
      email: "viewer@example.com",
      role: "viewer",
      is_club_member: true,
    };

    expect(isAdmin(viewerUser)).toBe(false);
  });

  it("should return false for null user", () => {
    expect(isAdmin(null)).toBe(false);
  });
});

describe("AllowedUser type", () => {
  it("should have correct structure", () => {
    const user: AllowedUser = {
      id: "test-id",
      email: "test@example.com",
      role: "admin",
      is_club_member: true,
    };

    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.role).toMatch(/^(admin|viewer)$/);
    expect(typeof user.is_club_member).toBe("boolean");
  });

  it("should enforce valid role values", () => {
    const adminUser: AllowedUser = {
      id: "1",
      email: "admin@test.com",
      role: "admin",
      is_club_member: true,
    };

    const viewerUser: AllowedUser = {
      id: "2",
      email: "viewer@test.com",
      role: "viewer",
      is_club_member: false,
    };

    expect(["admin", "viewer"]).toContain(adminUser.role);
    expect(["admin", "viewer"]).toContain(viewerUser.role);
  });
});

describe("Auth module integration", () => {
  let mockSupabase: {
    auth: {
      getSession: ReturnType<typeof vi.fn>;
      signInWithOAuth: ReturnType<typeof vi.fn>;
      signOut: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.resetModules();

    mockSupabase = {
      auth: {
        getSession: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
    };

    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: mockSupabase,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle session check when user is authenticated", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-123",
            email: "test@example.com",
          },
        },
      },
      error: null,
    });

    const { isAuthenticated } = await import("@/lib/auth");
    const result = await isAuthenticated();
    expect(result).toBe(true);
  });

  it("should handle session check when user is not authenticated", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { isAuthenticated } = await import("@/lib/auth");
    const result = await isAuthenticated();
    expect(result).toBe(false);
  });

  it("should fetch allowed user by email", async () => {
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "allowed-user-123",
          email: "test@example.com",
          role: "admin",
          is_club_member: true,
        },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockQueryBuilder);

    const { getAllowedUser } = await import("@/lib/auth");
    const result = await getAllowedUser("test@example.com");

    expect(mockSupabase.from).toHaveBeenCalledWith("allowed_users");
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      "email",
      "test@example.com"
    );
    expect(result).toEqual({
      id: "allowed-user-123",
      email: "test@example.com",
      role: "admin",
      is_club_member: true,
    });
  });

  it("should return null when user is not in allowed_users table", async () => {
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockQueryBuilder);

    const { getAllowedUser } = await import("@/lib/auth");
    const result = await getAllowedUser("unknown@example.com");

    expect(result).toBeNull();
  });

  it("should lowercase email when checking allowed users", async () => {
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockQueryBuilder);

    const { getAllowedUser } = await import("@/lib/auth");
    await getAllowedUser("TEST@EXAMPLE.COM");

    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      "email",
      "test@example.com"
    );
  });

  it("should get club member emails", async () => {
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { email: "member1@test.com" },
          { email: "member2@test.com" },
        ],
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockQueryBuilder);

    const { getClubMemberEmails } = await import("@/lib/auth");
    const result = await getClubMemberEmails();

    expect(mockSupabase.from).toHaveBeenCalledWith("allowed_users");
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("is_club_member", true);
    expect(result).toEqual(["member1@test.com", "member2@test.com"]);
  });

  it("should return empty array when no club members found", async () => {
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockQueryBuilder);

    const { getClubMemberEmails } = await import("@/lib/auth");
    const result = await getClubMemberEmails();

    expect(result).toEqual([]);
  });

  it("should handle error when fetching club member emails", async () => {
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      }),
    };

    mockSupabase.from.mockReturnValue(mockQueryBuilder);

    const { getClubMemberEmails } = await import("@/lib/auth");
    const result = await getClubMemberEmails();

    expect(result).toEqual([]);
  });

  it("should handle error when fetching allowed user", async () => {
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      }),
    };

    mockSupabase.from.mockReturnValue(mockQueryBuilder);

    const { getAllowedUser } = await import("@/lib/auth");
    const result = await getAllowedUser("test@example.com");

    expect(result).toBeNull();
  });
});

describe("getCurrentUser", () => {
  let mockSupabase: {
    auth: {
      getSession: ReturnType<typeof vi.fn>;
      signInWithOAuth: ReturnType<typeof vi.fn>;
      signOut: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.resetModules();

    mockSupabase = {
      auth: {
        getSession: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
    };

    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: mockSupabase,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when no session exists", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { getCurrentUser } = await import("@/lib/auth");
    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it("should return user from profile when profile exists", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-123",
            email: "test@example.com",
            user_metadata: {
              name: "Session Name",
              avatar_url: "session-avatar.jpg",
            },
          },
        },
      },
      error: null,
    });

    const mockProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          name: "Profile Name",
          avatar_url: "profile-avatar.jpg",
        },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockProfileQuery);

    const { getCurrentUser } = await import("@/lib/auth");
    const result = await getCurrentUser();

    expect(result).toEqual({
      id: "user-123",
      name: "Profile Name",
      email: "test@example.com",
      avatar_url: "profile-avatar.jpg",
    });
  });

  it("should fallback to session metadata when profile name is missing", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-123",
            email: "test@example.com",
            user_metadata: {
              name: "Session Name",
              avatar_url: "session-avatar.jpg",
            },
          },
        },
      },
      error: null,
    });

    const mockProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          name: null,
          avatar_url: null,
        },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockProfileQuery);

    const { getCurrentUser } = await import("@/lib/auth");
    const result = await getCurrentUser();

    expect(result).toEqual({
      id: "user-123",
      name: "Session Name",
      email: "test@example.com",
      avatar_url: "session-avatar.jpg",
    });
  });

  it("should fallback to email username when profile exists but has no name and no session name", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-123",
            email: "profileuser@example.com",
            user_metadata: {}, // No name in metadata
          },
        },
      },
      error: null,
    });

    const mockProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          name: null, // Profile exists but name is null
          avatar_url: "profile-avatar.jpg",
        },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockProfileQuery);

    const { getCurrentUser } = await import("@/lib/auth");
    const result = await getCurrentUser();

    expect(result).toEqual({
      id: "user-123",
      name: "profileuser", // Falls back to email username
      email: "profileuser@example.com",
      avatar_url: "profile-avatar.jpg",
    });
  });

  it("should fallback to 'User' when profile exists but has no name, no session name, and no email", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-123",
            email: undefined, // No email
            user_metadata: {}, // No name in metadata
          },
        },
      },
      error: null,
    });

    const mockProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          name: null, // Profile exists but name is null
          avatar_url: null,
        },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockProfileQuery);

    const { getCurrentUser } = await import("@/lib/auth");
    const result = await getCurrentUser();

    expect(result).toEqual({
      id: "user-123",
      name: "User", // Falls back to default "User"
      email: "",
      avatar_url: undefined,
    });
  });

  it("should fallback to email username when no name available (no profile)", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-123",
            email: "testuser@example.com",
            user_metadata: {},
          },
        },
      },
      error: null,
    });

    const mockProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockProfileQuery);

    const { getCurrentUser } = await import("@/lib/auth");
    const result = await getCurrentUser();

    expect(result).toEqual({
      id: "user-123",
      name: "testuser",
      email: "testuser@example.com",
      avatar_url: undefined,
    });
  });

  it("should fallback to 'User' when no name or email available", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-123",
            email: undefined,
            user_metadata: {},
          },
        },
      },
      error: null,
    });

    const mockProfileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockProfileQuery);

    const { getCurrentUser } = await import("@/lib/auth");
    const result = await getCurrentUser();

    expect(result).toEqual({
      id: "user-123",
      name: "User",
      email: "",
      avatar_url: undefined,
    });
  });
});

describe("signInWithGoogle", () => {
  let mockSupabase: {
    auth: {
      getSession: ReturnType<typeof vi.fn>;
      signInWithOAuth: ReturnType<typeof vi.fn>;
      signOut: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
  };
  let mockToast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();

    mockSupabase = {
      auth: {
        getSession: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
    };

    mockToast = {
      error: vi.fn(),
      success: vi.fn(),
    };

    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: mockSupabase,
    }));

    vi.doMock("sonner", () => ({
      toast: mockToast,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call signInWithOAuth with correct parameters", async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error: null });

    const { signInWithGoogle } = await import("@/lib/auth");
    await signInWithGoogle();

    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringContaining("/dashboard"),
        scopes: "https://www.googleapis.com/auth/calendar.events",
      },
    });
  });

  it("should throw and show toast on error", async () => {
    const error = { message: "OAuth error" };
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({ error });

    const { signInWithGoogle } = await import("@/lib/auth");

    await expect(signInWithGoogle()).rejects.toEqual(error);
    expect(mockToast.error).toHaveBeenCalledWith(
      "Failed to sign in with Google: OAuth error"
    );
  });
});

describe("signInWithEmail", () => {
  let mockSupabase: {
    auth: {
      getSession: ReturnType<typeof vi.fn>;
      signInWithOAuth: ReturnType<typeof vi.fn>;
      signInWithPassword: ReturnType<typeof vi.fn>;
      signUp: ReturnType<typeof vi.fn>;
      signOut: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
  };
  let mockToast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();

    mockSupabase = {
      auth: {
        getSession: vi.fn(),
        signInWithOAuth: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
    };

    mockToast = {
      error: vi.fn(),
      success: vi.fn(),
    };

    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: mockSupabase,
    }));

    vi.doMock("sonner", () => ({
      toast: mockToast,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should sign in successfully with email and password", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ error: null });

    const { signInWithEmail } = await import("@/lib/auth");
    await signInWithEmail("dev@example.com", "password123");

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "dev@example.com",
      password: "password123",
    });
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("should auto-signup when credentials are invalid (new user)", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    mockSupabase.auth.signUp.mockResolvedValue({ error: null });

    const { signInWithEmail } = await import("@/lib/auth");
    await signInWithEmail("new@example.com", "password123");

    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
    });
  });

  it("should show error toast and throw when signup fails", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const signUpError = { message: "Signup failed" };
    mockSupabase.auth.signUp.mockResolvedValue({ error: signUpError });

    const { signInWithEmail } = await import("@/lib/auth");
    await expect(signInWithEmail("test@example.com", "password123")).rejects.toEqual(signUpError);
    expect(mockToast.error).toHaveBeenCalledWith("Failed to create account: Signup failed");
  });

  it("should show error toast and throw for non-credential errors", async () => {
    const signInError = { message: "Server error" };
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      error: signInError,
    });

    const { signInWithEmail } = await import("@/lib/auth");
    await expect(signInWithEmail("test@example.com", "password123")).rejects.toEqual(signInError);
    expect(mockToast.error).toHaveBeenCalledWith("Failed to sign in: Server error");
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  let mockSupabase: {
    auth: {
      getSession: ReturnType<typeof vi.fn>;
      signInWithOAuth: ReturnType<typeof vi.fn>;
      signOut: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
  };
  let mockToast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
  const originalLocation = window.location;

  beforeEach(async () => {
    vi.resetModules();

    mockSupabase = {
      auth: {
        getSession: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
    };

    mockToast = {
      error: vi.fn(),
      success: vi.fn(),
    };

    // Mock window.location
    delete (window as { location?: Location }).location;
    window.location = { ...originalLocation, href: "" } as Location;

    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: mockSupabase,
    }));

    vi.doMock("sonner", () => ({
      toast: mockToast,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.location = originalLocation;
  });

  it("should call signOut and redirect to homepage", async () => {
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });

    const { signOut } = await import("@/lib/auth");
    await signOut();

    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    expect(window.location.href).toBe("/");
  });

  it("should throw and show toast on error", async () => {
    const error = { message: "Sign out error" };
    mockSupabase.auth.signOut.mockResolvedValue({ error });

    const { signOut } = await import("@/lib/auth");

    await expect(signOut()).rejects.toEqual(error);
    expect(mockToast.error).toHaveBeenCalledWith(
      "Failed to sign out: Sign out error"
    );
  });
});
