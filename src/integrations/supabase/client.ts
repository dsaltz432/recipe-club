import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://bluilkrggkspxsnehfez.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e9bWpxdZWh3HcX1wq8OS5Q__uJFMBmL";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
