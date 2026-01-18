/**
 * Backfill script to import historical Recipe Club events and recipes
 *
 * Run with: npx ts-node scripts/backfill-history.ts
 * Or with Deno: deno run --allow-net --allow-env scripts/backfill-history.ts
 *
 * Make sure to set environment variables:
 *   SUPABASE_URL=your_project_url
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "YOUR_SERVICE_ROLE_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Map participant names to emails
const PARTICIPANT_EMAILS: Record<string, string> = {
  sarah: "sarahgsaltz@gmail.com",
  hannah: "hannah.glickman@gmail.com",
};

// Historical data from CSV
const HISTORY_DATA = [
  { date: "2023-06-18", theme: "Almond", participant: "Sarah", url: "https://www.insidetherustickitchen.com/pesto-alla-trapanese/" },
  { date: "2023-06-18", theme: "Almond", participant: "Hannah", url: "http://www.mrbsbistro.com/recipes_trout_amandine.php" },
  { date: "2023-06-18", theme: "Almond", participant: "Hannah", url: "https://www.simplyrecipes.com/marzipan-recipe-5295688" },
  { date: "2023-07-31", theme: "Pickle", participant: "Sarah", url: "https://cooking.nytimes.com/recipes/1014140-shortcut-banh-mi-with-pickled-carrots-and-daikon" },
  { date: "2023-07-31", theme: "Pickle", participant: "Hannah", url: "https://cooking.nytimes.com/recipes/1018808-pickled-deviled-eggs" },
  { date: "2023-09-17", theme: "Soy Sauce", participant: "Sarah", url: "https://thewoksoflife.com/cantonese-soy-sauce-pan-fried-noodles/#recipe" },
  { date: "2023-09-17", theme: "Soy Sauce", participant: "Hannah", url: "https://www.simplyrecipes.com/hetty-mckinnon-s-flourless-soy-sauce-brownies-recipe-5189221" },
  { date: "2024-03-18", theme: "Potato", participant: "Sarah", url: "https://www.thefrenchcookingacademy.com/recipes/pommes-dauphine" },
  { date: "2024-03-18", theme: "Potato", participant: "Hannah", url: "https://cooking.nytimes.com/recipes/1017724-cheesy-hasselback-potato-gratin" },
  { date: "2024-08-18", theme: "Soup", participant: "Sarah", url: "https://hot-thai-kitchen.com/tom-ka-gai/#recipe" },
  { date: "2024-08-18", theme: "Soup", participant: "Hannah", url: "https://cooking.nytimes.com/recipes/1019881-split-pea-soup" },
  { date: "2024-11-05", theme: "Pie", participant: "Hannah", url: "https://cooking.nytimes.com/recipes/1019424-atlantic-beach-pie" },
  { date: "2024-11-05", theme: "Pie", participant: "Sarah", url: null, notes: "Spanikopita" },
  { date: "2024-12-15", theme: "Broccoli", participant: "Sarah", url: "https://kalejunkie.com/lemon-parmesan-smashed-broccoli/" },
  { date: "2024-12-15", theme: "Broccoli", participant: "Hannah", url: "https://cooking.nytimes.com/recipes/1022378-long-cooked-broccoli" },
  { date: "2025-01-03", theme: "Capers", participant: "Sarah", url: "https://themodernproper.com/chicken-piccata" },
  { date: "2025-01-03", theme: "Capers", participant: "Hannah", url: "https://www.bonappetit.com/recipe/cauliflower-steaks-and-puree-with-walnut-caper-salsa" },
  { date: "2025-05-06", theme: "Kale", participant: "Sarah", url: "https://cookieandkate.com/kale-pesto-pizza-recipe/" },
  { date: "2025-05-06", theme: "Kale", participant: "Hannah", url: "https://cooking.nytimes.com/recipes/1020780-coconut-creamed-kale" },
  { date: "2025-06-30", theme: "Lemon", participant: "Sarah", url: "https://saratane.substack.com/p/no-149-whole-lemon-marinated-grilled" },
  { date: "2025-08-04", theme: "Tofu", participant: "Sarah", url: "https://cooking.nytimes.com/recipes/6609-manicotti-with-cheese-filling" },
  { date: "2025-08-04", theme: "Tofu", participant: "Sarah", url: "https://sweetsimplevegan.com/tofu-ricotta-cheese/" },
  { date: "2025-08-04", theme: "Tofu", participant: "Hannah", url: null, notes: "Double Tofu Caesar Sandwich" },
  { date: "2025-09-15", theme: "Cornmeal", participant: "Sarah", url: "https://mydominicankitchen.com/cornmeal-fritters/" },
  { date: "2025-09-15", theme: "Cornmeal", participant: "Hannah", url: "https://cooking.nytimes.com/recipes/1021809-polenta-lasagna-with-spinach" },
  { date: "2025-10-28", theme: "Beef", participant: "Sarah", url: "https://share.google/NIU2n7l5grCmcRmiY" },
  { date: "2026-01-12", theme: "Cucumber", participant: "Sarah", url: "https://food52.com/recipes/21569-crunchy-creamy-cucumber-avocado-salad" },
  { date: "2026-01-12", theme: "Cucumber", participant: "Hannah", url: "https://cooking.nytimes.com/recipes/1021338-stir-fried-cucumber-with-tofu" },
];

async function backfill() {
  console.log("Starting backfill...\n");

  // 1. Get user IDs from auth.users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error("Error fetching users:", usersError);
    return;
  }

  const userEmailToId = new Map<string, string>();
  for (const user of users.users) {
    if (user.email) {
      userEmailToId.set(user.email.toLowerCase(), user.id);
    }
  }

  console.log("Found users:", Array.from(userEmailToId.keys()));

  // 2. Get unique themes and create ingredients
  const themes = [...new Set(HISTORY_DATA.map((d) => d.theme))];
  console.log("\nCreating ingredients for themes:", themes);

  const ingredientNameToId = new Map<string, string>();

  for (const theme of themes) {
    // Check if ingredient already exists
    const { data: existing } = await supabase
      .from("ingredients")
      .select("id")
      .eq("name", theme)
      .single();

    if (existing) {
      ingredientNameToId.set(theme, existing.id);
      console.log(`  Ingredient "${theme}" already exists`);
    } else {
      const { data: newIngredient, error } = await supabase
        .from("ingredients")
        .insert({ name: theme, is_used: true })
        .select("id")
        .single();

      if (error) {
        console.error(`  Error creating ingredient "${theme}":`, error);
      } else {
        ingredientNameToId.set(theme, newIngredient.id);
        console.log(`  Created ingredient "${theme}"`);
      }
    }
  }

  // 3. Get unique events (date + theme combinations) and create scheduled_events
  const eventKeys = [...new Set(HISTORY_DATA.map((d) => `${d.date}|${d.theme}`))];
  console.log("\nCreating events...");

  const eventKeyToId = new Map<string, string>();

  for (const eventKey of eventKeys) {
    const [date, theme] = eventKey.split("|");
    const ingredientId = ingredientNameToId.get(theme);

    // Check if event already exists
    const { data: existing } = await supabase
      .from("scheduled_events")
      .select("id")
      .eq("event_date", date)
      .eq("ingredient_id", ingredientId)
      .single();

    if (existing) {
      eventKeyToId.set(eventKey, existing.id);
      console.log(`  Event "${theme}" on ${date} already exists`);
    } else {
      const { data: newEvent, error } = await supabase
        .from("scheduled_events")
        .insert({
          event_date: date,
          ingredient_id: ingredientId,
          status: "completed",
        })
        .select("id")
        .single();

      if (error) {
        console.error(`  Error creating event "${theme}" on ${date}:`, error);
      } else {
        eventKeyToId.set(eventKey, newEvent.id);
        console.log(`  Created event "${theme}" on ${date}`);
      }
    }
  }

  // 4. Create recipes
  console.log("\nCreating recipes...");

  for (const record of HISTORY_DATA) {
    const participantEmail = PARTICIPANT_EMAILS[record.participant.toLowerCase()];
    const userId = participantEmail ? userEmailToId.get(participantEmail.toLowerCase()) : null;
    const ingredientId = ingredientNameToId.get(record.theme);

    // Extract recipe name from URL or use notes
    let recipeName = record.notes || extractRecipeName(record.url);

    // Check if recipe already exists (by user, date, and URL/name)
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("event_date", record.date)
      .eq("user_id", userId)
      .eq("name", recipeName)
      .single();

    if (existing) {
      console.log(`  Recipe "${recipeName}" by ${record.participant} on ${record.date} already exists`);
      continue;
    }

    const { error } = await supabase.from("recipes").insert({
      name: recipeName,
      url: record.url,
      notes: record.notes || null,
      user_id: userId,
      ingredient_id: ingredientId,
      event_date: record.date,
    });

    if (error) {
      console.error(`  Error creating recipe "${recipeName}":`, error);
    } else {
      console.log(`  Created recipe "${recipeName}" by ${record.participant}`);
    }
  }

  console.log("\nBackfill complete!");
}

function extractRecipeName(url: string | null): string {
  if (!url) return "Unknown Recipe";

  try {
    // Extract the last path segment and clean it up
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || segments[segments.length - 2];

    if (!lastSegment) return "Recipe";

    // Remove file extensions, hashes, and clean up
    return lastSegment
      .replace(/[-_]/g, " ")
      .replace(/#.*$/, "")
      .replace(/\.\w+$/, "")
      .replace(/recipe$/i, "")
      .replace(/\d+$/, "")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
      .trim() || "Recipe";
  } catch {
    return "Recipe";
  }
}

backfill().catch(console.error);
