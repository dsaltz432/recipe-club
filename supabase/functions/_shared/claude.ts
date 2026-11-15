/**
 * Shared helpers for calling the Claude Messages API from edge functions.
 *
 * Current models (Haiku 5.5, Sonnet 5.5, Opus 5.5) think by default, so a
 * response's first content block may be a `thinking` block rather than the
 * answer — always look for the `text` blocks instead of reading content[0].
 */

export const DEFAULT_MODEL = "claude-opus-5-5";
export const FAST_MODEL = "claude-haiku-5-5";

/**
 * Thinking happens inside max_tokens, so leave room for it on top of the
 * answer itself.
 */
export const DEFAULT_MAX_TOKENS = 16000;

// Models that support server-side refusal fallbacks ("default" routes by
// refusal category, so no fallback model list to maintain).
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

interface ClaudeRequest {
  apiKey: string;
  model: string;
  system?: string;
  messages: unknown[];
  maxTokens?: number;
}

interface ClaudeContentBlock {
  type: string;
  text?: string;
}

interface ClaudeResponse {
  content?: ClaudeContentBlock[];
  stop_reason?: string;
}

/** Join the response's text blocks, skipping thinking/fallback blocks. */
export function extractText(result: ClaudeResponse): string {
  if (result.stop_reason === "refusal") {
    throw new Error("The AI model declined to process this request.");
  }
  return (result.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

/** Call the Messages API and return the answer text. */
export async function callClaude({
  apiKey,
  model,
  system,
  messages,
  maxTokens = DEFAULT_MAX_TOKENS,
}: ClaudeRequest): Promise<string> {
  const useFallbacks = FALLBACK_MODELS.has(model);

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };
  if (useFallbacks) headers["anthropic-beta"] = FALLBACK_BETA;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
      ...(useFallbacks ? { fallbacks: "default" } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  return extractText(await response.json());
}
