import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@tests/utils";
import UserManagementPage from "@/pages/UserManagementPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockGetCurrentUser = vi.fn();
const mockGetAllowedUser = vi.fn();
const mockIsMemberOrAdmin = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getAllowedUser: (...args: unknown[]) => mockGetAllowedUser(...args),
  isMemberOrAdmin: (...args: unknown[]) => mockIsMemberOrAdmin(...args),
}));

// Mock UserManagement component
vi.mock("@/components/admin/UserManagement", () => ({
  default: ({ currentUserEmail }: { currentUserEmail: string }) => (
    <div data-testid="user-management">UserManagement for {currentUserEmail}</div>
  ),
}));

describe("UserManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockGetCurrentUser.mockReturnValue(new Promise(() => {}));
    const { container } = render(<UserManagementPage />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("redirects viewer to dashboard", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Viewer",
      email: "viewer@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer" });
    mockIsMemberOrAdmin.mockReturnValue(false);

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirects to / when no email", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: null,
    });

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("renders for admin users", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Admin",
      email: "admin@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "admin" });
    mockIsMemberOrAdmin.mockReturnValue(true);

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("User Management")).toBeInTheDocument();
    });

    expect(screen.getByTestId("user-management")).toBeInTheDocument();
    expect(screen.getByText("UserManagement for admin@test.com")).toBeInTheDocument();
  });

  it("renders back to dashboard button", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Admin",
      email: "admin@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "admin" });
    mockIsMemberOrAdmin.mockReturnValue(true);

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("User Management")).toBeInTheDocument();
    });

    // Click "Back" button
    const backButton = screen.getByRole("button", { name: /^back$/i });
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalled();
  });

  it("passes empty email when user has no email", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Admin",
      email: undefined,
    });

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("renders for member users", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Member",
      email: "member@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "member" });
    mockIsMemberOrAdmin.mockReturnValue(true);

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("User Management")).toBeInTheDocument();
    });

    expect(screen.getByTestId("user-management")).toBeInTheDocument();
  });

  it("returns null when viewer after loading", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Viewer",
      email: "viewer@test.com",
    });
    mockGetAllowedUser.mockResolvedValue({ role: "viewer" });
    mockIsMemberOrAdmin.mockReturnValue(false);

    const { container } = render(<UserManagementPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });

    // After loading, viewer cannot manage, so returns null
    await waitFor(() => {
      expect(container.querySelector(".min-h-screen")).toBeFalsy();
    });
  });
});
