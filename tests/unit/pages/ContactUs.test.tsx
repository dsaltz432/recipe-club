import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@tests/utils";
import ContactUs from "@/pages/ContactUs";

// Router mock
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Auth mock
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Supabase mock
const mockFunctionsInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

// Sonner mock
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
import { toast } from "sonner";

const defaultUser = {
  id: "user-1",
  name: "Sarah Glickman",
  email: "sarah@example.com",
};

describe("ContactUs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(defaultUser);
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("shows loading spinner initially", () => {
    mockGetCurrentUser.mockReturnValue(new Promise(() => {}));
    render(<ContactUs />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders form after loading", async () => {
    render(<ContactUs />);
    await waitFor(() => {
      expect(screen.getByText("Contact Us")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("pre-fills name and email from current user", async () => {
    render(<ContactUs />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Sarah Glickman")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("sarah@example.com")).toBeInTheDocument();
  });

  it("submit calls edge function with form values and shows success toast", async () => {
    render(<ContactUs />);
    await waitFor(() => screen.getByLabelText("Message"));

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Can you add a dark mode?" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith("send-contact-email", {
        body: {
          name: "Sarah Glickman",
          email: "sarah@example.com",
          type: "Question",
          message: "Can you add a dark mode?",
        },
      });
      expect(toast.success).toHaveBeenCalledWith("Message sent! We'll get back to you soon.");
    });
  });

  it("shows error toast when edge function fails", async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: "failed" } });

    render(<ContactUs />);
    await waitFor(() => screen.getByLabelText("Message"));

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Help!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to send message. Please try emailing us directly."
      );
    });
  });

  it("submit button is disabled when message is empty", async () => {
    render(<ContactUs />);
    await waitFor(() => screen.getByLabelText("Message"));

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    expect(submitBtn).toBeDisabled();
  });

  it("shows direct email link", async () => {
    render(<ContactUs />);
    await waitFor(() => screen.getByText(/contact@therecipeclubhub.com/));
    const link = screen.getByRole("link", { name: /contact@therecipeclubhub.com/ });
    expect(link).toHaveAttribute("href", "mailto:contact@therecipeclubhub.com");
  });

  it("back button navigates to dashboard", async () => {
    render(<ContactUs />);
    await waitFor(() => screen.getByText("Contact Us"));

    fireEvent.click(screen.getByRole("button", { name: /Back to Dashboard/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});
