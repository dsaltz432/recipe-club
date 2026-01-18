import { vi } from "vitest";

// Mock Supabase query builder
export const createMockQueryBuilder = (data: unknown = null, error: unknown = null) => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn((resolve) => resolve({ data, error })),
  };

  // Make builder thenable
  builder.then = vi.fn((resolve) => Promise.resolve({ data, error }).then(resolve));

  return builder;
};

// Mock session data
export const mockSession = {
  user: {
    id: "test-user-id",
    email: "test@example.com",
    user_metadata: {
      name: "Test User",
      avatar_url: "https://example.com/avatar.jpg",
    },
  },
  provider_token: "mock-google-token",
};

// Mock auth module
export const createMockAuth = (session = mockSession) => ({
  getSession: vi.fn().mockResolvedValue({
    data: { session },
    error: null,
  }),
  signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  onAuthStateChange: vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  }),
});

// Mock Supabase client
export const createMockSupabase = (queryBuilder = createMockQueryBuilder()) => ({
  from: vi.fn().mockReturnValue(queryBuilder),
  auth: createMockAuth(),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "test/path" }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: "https://example.com/image.jpg" },
      }),
    }),
  },
});

// Default mock instance
export const mockSupabase = createMockSupabase();
