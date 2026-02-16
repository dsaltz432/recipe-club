import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@tests/utils";
import AIChatPanel from "@/components/mealplan/AIChatPanel";

describe("AIChatPanel", () => {
  const defaultProps = {
    messages: [] as { role: "user" | "assistant"; content: string }[],
    onSendMessage: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Chat with AI header", () => {
    render(<AIChatPanel {...defaultProps} />);

    expect(screen.getByText("Chat with AI")).toBeInTheDocument();
  });

  it("shows empty state when no messages", () => {
    render(<AIChatPanel {...defaultProps} />);

    expect(screen.getByText(/ask for meal suggestions/i)).toBeInTheDocument();
  });

  it("renders user messages", () => {
    const messages = [
      { role: "user" as const, content: "Suggest something healthy" },
    ];

    render(<AIChatPanel {...defaultProps} messages={messages} />);

    expect(screen.getByText("Suggest something healthy")).toBeInTheDocument();
  });

  it("renders assistant messages", () => {
    const messages = [
      { role: "assistant" as const, content: "Here are some ideas!" },
    ];

    render(<AIChatPanel {...defaultProps} messages={messages} />);

    expect(screen.getByText("Here are some ideas!")).toBeInTheDocument();
  });

  it("renders multiple messages", () => {
    const messages = [
      { role: "user" as const, content: "What should I cook?" },
      { role: "assistant" as const, content: "Try some pasta!" },
    ];

    render(<AIChatPanel {...defaultProps} messages={messages} />);

    expect(screen.getByText("What should I cook?")).toBeInTheDocument();
    expect(screen.getByText("Try some pasta!")).toBeInTheDocument();
  });

  it("shows Thinking... when loading", () => {
    render(<AIChatPanel {...defaultProps} isLoading={true} />);

    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("sends message on button click", () => {
    render(<AIChatPanel {...defaultProps} />);

    const input = screen.getByPlaceholderText("Ask about meals...");
    fireEvent.change(input, { target: { value: "Quick dinner ideas" } });
    fireEvent.click(screen.getByRole("button", { name: "" })); // Send button

    expect(defaultProps.onSendMessage).toHaveBeenCalledWith("Quick dinner ideas");
  });

  it("sends message on Enter key", () => {
    render(<AIChatPanel {...defaultProps} />);

    const input = screen.getByPlaceholderText("Ask about meals...");
    fireEvent.change(input, { target: { value: "Lunch ideas" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(defaultProps.onSendMessage).toHaveBeenCalledWith("Lunch ideas");
  });

  it("clears input after sending", () => {
    render(<AIChatPanel {...defaultProps} />);

    const input = screen.getByPlaceholderText("Ask about meals...");
    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.click(screen.getByRole("button", { name: "" }));

    expect(input).toHaveValue("");
  });

  it("does not send empty message", () => {
    render(<AIChatPanel {...defaultProps} />);

    const input = screen.getByPlaceholderText("Ask about meals...");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(defaultProps.onSendMessage).not.toHaveBeenCalled();
  });

  it("disables input when loading", () => {
    render(<AIChatPanel {...defaultProps} isLoading={true} />);

    const input = screen.getByPlaceholderText("Ask about meals...");
    expect(input).toBeDisabled();
  });

  it("does not send on non-Enter key", () => {
    render(<AIChatPanel {...defaultProps} />);

    const input = screen.getByPlaceholderText("Ask about meals...");
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.keyDown(input, { key: "a" });

    expect(defaultProps.onSendMessage).not.toHaveBeenCalled();
  });
});
