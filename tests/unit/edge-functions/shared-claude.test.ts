import { describe, it, expect, vi, beforeEach } from "vitest";
import { callClaude, extractText, DEFAULT_MODEL, FAST_MODEL } from "@edge/_shared/claude.ts";

const mockFetch = vi.fn();

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

describe("model defaults", () => {
  it("defaults to Opus 5.5, with Haiku 5.5 as the fast model", () => {
    expect(DEFAULT_MODEL).toBe("claude-opus-5-5");
    expect(FAST_MODEL).toBe("claude-haiku-5-5");
  });
});

describe("extractText", () => {
  it("skips thinking blocks that come before the answer", () => {
    expect(
      extractText({
        content: [
          { type: "thinking", text: undefined },
          { type: "text", text: '{"ok":' },
          { type: "text", text: "true}" },
        ],
        stop_reason: "end_turn",
      })
    ).toBe('{"ok":true}');
  });

  it("throws a clear error when the model declines", () => {
    expect(() => extractText({ content: [], stop_reason: "refusal" })).toThrow(/declined/);
  });
});

describe("callClaude", () => {
  it("sends refusal fallbacks for Sonnet 5.5 and leaves room for thinking", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ content: [{ type: "text", text: "hi" }] }));

    const text = await callClaude({
      apiKey: "key",
      model: "claude-sonnet-5-5",
      system: "sys",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(text).toBe("hi");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      system: "sys",
      fallbacks: "default",
    });
  });

  it("does not send fallbacks for Haiku 5.5, which doesn't support them", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ content: [{ type: "text", text: "hi" }] }));

    await callClaude({ apiKey: "key", model: "claude-haiku-5-5", messages: [] });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["anthropic-beta"]).toBeUndefined();
    expect(JSON.parse(init.body).fallbacks).toBeUndefined();
  });

  it("throws with the API's error text on non-2xx responses", async () => {
    mockFetch.mockResolvedValueOnce(new Response("overloaded", { status: 529 }));

    await expect(
      callClaude({ apiKey: "key", model: "claude-opus-5-5", messages: [] })
    ).rejects.toThrow("AI API error: 529 - overloaded");
  });
});
