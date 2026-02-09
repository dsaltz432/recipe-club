/**
 * Preload script that makes import.meta.env available for Node.js,
 * allowing Vite-dependent modules (like src/integrations/supabase/client.ts) to load.
 *
 * Usage: npx tsx --tsconfig tsconfig.app.json --import ./scripts/_mock-env.mjs <script>
 */

// Node.js ESM doesn't have import.meta.env by default.
// tsx/esbuild replaces import.meta.env references during transpilation,
// so we need to define it globally via a custom resolve hook.
// The simplest approach: register a loader that intercepts the supabase client.

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./scripts/_mock-loader.mjs", pathToFileURL("./"));
