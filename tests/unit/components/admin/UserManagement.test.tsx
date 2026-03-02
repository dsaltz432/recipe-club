import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import UserManagement from "@/components/admin/UserManagement";

// Build a mock chain helper
const createMockChain = () => ({
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
});

let mockChain = createMockChain();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => mockChain,
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "admin-user-1" } } },
      }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const mockUsers = [
  {
    id: "user-1",
    email: "admin@test.com",
    role: "admin",
    is_club_member: true,
    created_at: "2024-01-01",
  },
  {
    id: "user-2",
    email: "viewer@test.com",
    role: "viewer",
    is_club_member: false,
    created_at: "2024-01-02",
  },
  {
    id: "user-3",
    email: "member@test.com",
    role: "member",
    is_club_member: true,
    created_at: "2024-01-03",
  },
];

describe("UserManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createMockChain();
    // Default: order returns user data
    mockChain.order.mockResolvedValue({ data: mockUsers, error: null });
    // Default for other chain ends
    mockChain.eq.mockResolvedValue({ data: null, error: null });
  });

  it("shows loading spinner initially then renders users", async () => {
    // Make order hang initially to show loading
    let resolveLoad!: (v: unknown) => void;
    mockChain.order.mockReturnValue(new Promise((r) => { resolveLoad = r; }));

    const { container } = render(<UserManagement currentUserEmail="admin@test.com" />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();

    resolveLoad({ data: mockUsers, error: null });

    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    });
  });

  it("renders user list after loading", async () => {
    render(<UserManagement currentUserEmail="admin@test.com" />);

    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      expect(screen.getByText("member@test.com")).toBeInTheDocument();
    });

    expect(screen.getByText("User Management")).toBeInTheDocument();
    expect(screen.getByText("Invite User")).toBeInTheDocument();
  });

  it("shows 'You' badge for current user", async () => {
    render(<UserManagement currentUserEmail="admin@test.com" />);

    await waitFor(() => {
      expect(screen.getByText("You")).toBeInTheDocument();
    });
  });

  it("does not show 'Club Member' badge inline (managed via toggle)", async () => {
    render(<UserManagement currentUserEmail="admin@test.com" />);

    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    });

    expect(screen.queryByText("Club Member")).not.toBeInTheDocument();
  });

  it("shows user stats in header", async () => {
    render(<UserManagement currentUserEmail="admin@test.com" />);

    await waitFor(() => {
      expect(screen.getByText(/1 admin/)).toBeInTheDocument();
      expect(screen.getByText(/1 editor(?!s)/)).toBeInTheDocument();
      expect(screen.getByText(/1 viewer/)).toBeInTheDocument();
      expect(screen.getByText(/2 club members/)).toBeInTheDocument();
    });
  });

  it("shows empty state when no users", async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null });

    render(<UserManagement currentUserEmail="admin@test.com" />);

    await waitFor(() => {
      expect(screen.getByText("No users yet. Invite someone to get started!")).toBeInTheDocument();
    });
  });

  it("shows error toast on load failure", async () => {
    mockChain.order.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<UserManagement currentUserEmail="admin@test.com" />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load users");
    });

    consoleSpy.mockRestore();
  });

  describe("Add User Dialog", () => {
    it("opens and closes dialog", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("Invite User")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));
      expect(screen.getByText("Add a new user who can access Recipe Club Hub.")).toBeInTheDocument();

      // Close it
      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelBtn);
    });

    it("validates empty email - button is disabled when email trims to empty", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("Invite User")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));

      // Empty email keeps button disabled (defensive guard in handler is unreachable via UI)
      const emailInput = screen.getByPlaceholderText("user@example.com");
      fireEvent.change(emailInput, { target: { value: "" } });

      const btns = screen.getAllByRole("button").filter(b => b.textContent?.includes("Invite User"));
      const dialogBtn = btns[btns.length - 1];
      expect(dialogBtn).toBeDisabled();
    });

    it("validates invalid email format", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));

      const emailInput = screen.getByPlaceholderText("user@example.com");
      fireEvent.change(emailInput, { target: { value: "not-an-email" } });

      // Find the invite button in the dialog and click it
      const btns = screen.getAllByRole("button").filter(b => b.textContent?.includes("Invite User"));
      const dialogBtn = btns[btns.length - 1]; // Last one should be in dialog
      fireEvent.click(dialogBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Please enter a valid email address");
      });
    });

    it("validates duplicate email", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));

      const emailInput = screen.getByPlaceholderText("user@example.com");
      fireEvent.change(emailInput, { target: { value: "admin@test.com" } });

      const btns = screen.getAllByRole("button").filter(b => b.textContent?.includes("Invite User"));
      const dialogBtn = btns[btns.length - 1];
      fireEvent.click(dialogBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("This user has already been invited");
      });
    });

    it("changes role in add dialog", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));

      // The dialog should show role select
      // Find the dialog's role select trigger
      const dialog = screen.getByRole("dialog");
      const selectTriggers = dialog.querySelectorAll("button[role='combobox']");
      // There's one select in the dialog for role
      if (selectTriggers.length > 0) {
        fireEvent.click(selectTriggers[0] as HTMLButtonElement);
      }

      // Select "Admin" option
      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const adminOption = options.find(o => o.textContent?.includes("Admin"));
        if (adminOption) fireEvent.click(adminOption);
      });
    });

    it("shows member option in add dialog role selector", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));

      const dialog = screen.getByRole("dialog");
      const selectTriggers = dialog.querySelectorAll("button[role='combobox']");
      if (selectTriggers.length > 0) {
        fireEvent.click(selectTriggers[0] as HTMLButtonElement);
      }

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const memberOption = options.find(o => o.textContent?.includes("Editor"));
        expect(memberOption).toBeDefined();
      });
    });

    it("toggles club member switch in add dialog", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));

      // Find the switch in the dialog (for "Include in Club")
      const dialog = screen.getByRole("dialog");
      const dialogSwitch = dialog.querySelector("button[role='switch']") as HTMLButtonElement;
      if (dialogSwitch) {
        fireEvent.click(dialogSwitch); // Toggle off
        fireEvent.click(dialogSwitch); // Toggle back on
      }
    });

    it("adds user successfully", async () => {
      // For insert, make eq resolve success, and for reload, return updated user list
      let callCount = 0;
      mockChain.order.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: mockUsers, error: null });
        }
        return Promise.resolve({
          data: [...mockUsers, { id: "user-3", email: "new@test.com", role: "viewer", is_club_member: true, created_at: "2024-01-03" }],
          error: null,
        });
      });
      mockChain.insert.mockResolvedValue({ error: null });

      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));

      const emailInput = screen.getByPlaceholderText("user@example.com");
      fireEvent.change(emailInput, { target: { value: "new@test.com" } });

      const btns = screen.getAllByRole("button").filter(b => b.textContent?.includes("Invite User"));
      const dialogBtn = btns[btns.length - 1];
      fireEvent.click(dialogBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Invited new@test.com");
      });
    });

    it("triggers empty email guard via _testForceEmptyEmailSubmit prop", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" _testForceEmptyEmailSubmit={true} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Please enter an email address");
      });
    });

    it("shows session expired error when no session", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce(
        { data: { session: null }, error: null } as Awaited<ReturnType<typeof supabase.auth.getSession>>
      );

      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));

      const emailInput = screen.getByPlaceholderText("user@example.com");
      fireEvent.change(emailInput, { target: { value: "new@test.com" } });

      const btns = screen.getAllByRole("button").filter(b => b.textContent?.includes("Invite User"));
      const dialogBtn = btns[btns.length - 1];
      fireEvent.click(dialogBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Session expired. Please sign in again.");
      });
    });

    it("handles add user error", async () => {
      mockChain.insert.mockResolvedValue({ error: { message: "Insert error" } });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Invite User"));

      const emailInput = screen.getByPlaceholderText("user@example.com");
      fireEvent.change(emailInput, { target: { value: "new@test.com" } });

      const btns = screen.getAllByRole("button").filter(b => b.textContent?.includes("Invite User"));
      const dialogBtn = btns[btns.length - 1];
      fireEvent.click(dialogBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to invite user");
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Delete User", () => {
    it("prevents deleting yourself (disabled button)", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      // The delete button for current user should be disabled
      const adminRow = screen.getByText("admin@test.com").closest(".rounded-lg");
      const rowButtons = adminRow?.querySelectorAll("button") || [];
      const lastBtn = rowButtons[rowButtons.length - 1] as HTMLButtonElement;
      expect(lastBtn?.disabled).toBe(true);
    });

    it("triggers self-delete guard via _testForceDeleteSelf prop", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" _testForceDeleteSelf={true} />);

      await waitFor(() => {
        expect(screen.getByText("Remove User?")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Remove"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("You cannot remove yourself");
      });
    });

    it("opens delete confirmation for other users", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      // The viewer row has a trash button that's not disabled
      // Find buttons with icon size that are in the viewer's row
      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      // Get the last button in the row (which is the trash button)
      const rowButtons = viewerRow?.querySelectorAll("button") || [];
      const lastRowBtn = rowButtons[rowButtons.length - 1] as HTMLButtonElement;

      if (lastRowBtn && !lastRowBtn.disabled) {
        fireEvent.click(lastRowBtn);
      }

      await waitFor(() => {
        expect(screen.getByText("Remove User?")).toBeInTheDocument();
      });
    });

    it("deletes user successfully", async () => {
      mockChain.eq.mockResolvedValue({ error: null });

      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const rowButtons = viewerRow?.querySelectorAll("button") || [];
      const lastRowBtn = rowButtons[rowButtons.length - 1] as HTMLButtonElement;

      if (lastRowBtn && !lastRowBtn.disabled) {
        fireEvent.click(lastRowBtn);
      }

      await waitFor(() => {
        expect(screen.getByText("Remove User?")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Remove"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Removed viewer@test.com");
      });
    });

    it("handles delete error", async () => {
      mockChain.eq.mockResolvedValue({ error: { message: "Delete error" } });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const rowButtons = viewerRow?.querySelectorAll("button") || [];
      const lastRowBtn = rowButtons[rowButtons.length - 1] as HTMLButtonElement;

      if (lastRowBtn && !lastRowBtn.disabled) {
        fireEvent.click(lastRowBtn);
      }

      await waitFor(() => {
        expect(screen.getByText("Remove User?")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Remove"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to remove user");
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Update Role", () => {
    it("prevents changing own role", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      // The role select for the current user should be disabled
      // Find the admin row and verify its select trigger is disabled
      const adminRow = screen.getByText("admin@test.com").closest(".rounded-lg");
      const selectTrigger = adminRow?.querySelector("button[role='combobox']") as HTMLButtonElement;
      expect(selectTrigger?.disabled).toBe(true);
    });

    it("queues role change and shows unsaved indicator", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const selectTrigger = viewerRow?.querySelector("button[role='combobox']") as HTMLButtonElement;
      expect(selectTrigger?.disabled).toBeFalsy();

      if (selectTrigger) {
        fireEvent.click(selectTrigger);
      }

      await waitFor(() => {
        const memberOption = screen.getByRole("option", { name: /editor/i });
        fireEvent.click(memberOption);
      });

      // Should show unsaved indicator, not fire a toast yet
      await waitFor(() => {
        expect(screen.getByText(/1 unsaved change/)).toBeInTheDocument();
        expect(screen.getByText("Save Changes")).toBeInTheDocument();
      });
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("saves queued role changes on Save Changes click", async () => {
      mockChain.eq.mockResolvedValue({ error: null });

      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const selectTrigger = viewerRow?.querySelector("button[role='combobox']") as HTMLButtonElement;

      if (selectTrigger) {
        fireEvent.click(selectTrigger);
      }

      await waitFor(() => {
        const memberOption = screen.getByRole("option", { name: /editor/i });
        fireEvent.click(memberOption);
      });

      await waitFor(() => {
        expect(screen.getByText("Save Changes")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Saved 1 change");
      });
    });

    it("discards queued role changes on Discard click", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const selectTrigger = viewerRow?.querySelector("button[role='combobox']") as HTMLButtonElement;

      if (selectTrigger) {
        fireEvent.click(selectTrigger);
      }

      await waitFor(() => {
        const memberOption = screen.getByRole("option", { name: /editor/i });
        fireEvent.click(memberOption);
      });

      await waitFor(() => {
        expect(screen.getByText("Discard")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Discard"));

      await waitFor(() => {
        expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
        expect(screen.queryByText("Save Changes")).not.toBeInTheDocument();
      });
    });

    it("removes pending change when reverting to original role", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const selectTrigger = viewerRow?.querySelector("button[role='combobox']") as HTMLButtonElement;

      // Change to editor
      if (selectTrigger) fireEvent.click(selectTrigger);
      await waitFor(() => {
        fireEvent.click(screen.getByRole("option", { name: /editor/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/1 unsaved change/)).toBeInTheDocument();
      });

      // Change back to viewer (original)
      if (selectTrigger) fireEvent.click(selectTrigger);
      await waitFor(() => {
        fireEvent.click(screen.getByRole("option", { name: /viewer/i }));
      });

      await waitFor(() => {
        expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
      });
    });

    it("triggers self-role-change guard via _testForceRoleChangeSelf prop (admin user)", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" _testForceRoleChangeSelf={true} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("You cannot change your own role");
      });
    });

    it("triggers self-role-change guard via _testForceRoleChangeSelf prop (viewer user)", async () => {
      render(<UserManagement currentUserEmail="viewer@test.com" _testForceRoleChangeSelf={true} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("You cannot change your own role");
      });
    });

    it("handles save role error", async () => {
      mockChain.eq.mockResolvedValue({ error: { message: "Update error" } });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const selectTrigger = viewerRow?.querySelector("button[role='combobox']") as HTMLButtonElement;

      if (selectTrigger) {
        fireEvent.click(selectTrigger);
      }

      await waitFor(() => {
        const memberOption = screen.getByRole("option", { name: /editor/i });
        fireEvent.click(memberOption);
      });

      await waitFor(() => {
        expect(screen.getByText("Save Changes")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to save changes");
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Toggle Club Member", () => {
    it("queues club member toggle as unsaved change", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      // viewer is not a club member (is_club_member: false)
      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const viewerSwitch = viewerRow?.querySelector("button[role='switch']") as HTMLButtonElement;
      if (viewerSwitch) {
        fireEvent.click(viewerSwitch);
      }

      await waitFor(() => {
        expect(screen.getByText(/1 unsaved change/)).toBeInTheDocument();
        expect(screen.getByText("Save Changes")).toBeInTheDocument();
      });
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("saves club member toggle on Save Changes click", async () => {
      mockChain.eq.mockResolvedValue({ error: null });

      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const viewerSwitch = viewerRow?.querySelector("button[role='switch']") as HTMLButtonElement;
      if (viewerSwitch) {
        fireEvent.click(viewerSwitch);
      }

      await waitFor(() => {
        expect(screen.getByText("Save Changes")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Saved 1 change");
      });
    });

    it("reverts club member toggle when toggled back", async () => {
      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      });

      // admin has is_club_member: true — toggle off
      const adminRow = screen.getByText("admin@test.com").closest(".rounded-lg");
      const adminSwitch = adminRow?.querySelector("button[role='switch']") as HTMLButtonElement;
      if (adminSwitch) {
        fireEvent.click(adminSwitch); // toggle off
      }

      await waitFor(() => {
        expect(screen.getByText(/1 unsaved change/)).toBeInTheDocument();
      });

      // toggle back on (revert)
      if (adminSwitch) {
        fireEvent.click(adminSwitch);
      }

      await waitFor(() => {
        expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
      });
    });

    it("handles save error for club member toggle", async () => {
      mockChain.eq.mockResolvedValue({ error: { message: "Toggle error" } });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(<UserManagement currentUserEmail="admin@test.com" />);

      await waitFor(() => {
        expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
      });

      const viewerRow = screen.getByText("viewer@test.com").closest(".rounded-lg");
      const viewerSwitch = viewerRow?.querySelector("button[role='switch']") as HTMLButtonElement;
      if (viewerSwitch) {
        fireEvent.click(viewerSwitch);
      }

      await waitFor(() => {
        expect(screen.getByText("Save Changes")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to save changes");
      });

      consoleSpy.mockRestore();
    });
  });

  it("handles data=null from loadUsers gracefully", async () => {
    mockChain.order.mockResolvedValue({ data: null, error: null });

    render(<UserManagement currentUserEmail="admin@test.com" />);

    await waitFor(() => {
      expect(screen.getByText("No users yet. Invite someone to get started!")).toBeInTheDocument();
    });
  });

  it("handles handleDeleteUser when userToDelete is null via _testForceDeleteNull", async () => {
    render(<UserManagement currentUserEmail="admin@test.com" _testForceDeleteNull={true} />);

    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    });

    // handleDeleteUser returns immediately when userToDelete is null
    expect(toast.error).not.toHaveBeenCalledWith("You cannot remove yourself");
  });

  it("shows plural stats correctly", async () => {
    mockChain.order.mockResolvedValue({
      data: [
        ...mockUsers,
        { id: "user-4", email: "admin2@test.com", role: "admin", is_club_member: true, created_at: "2024-01-04" },
      ],
      error: null,
    });

    render(<UserManagement currentUserEmail="admin@test.com" />);

    await waitFor(() => {
      expect(screen.getByText(/2 admins/)).toBeInTheDocument();
      expect(screen.getByText(/3 club members/)).toBeInTheDocument();
    });
  });
});
