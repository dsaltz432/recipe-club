-- Recipe Club History Backfill Script
-- Run this in the Supabase SQL Editor

-- First, let's create a temporary table with the history data
CREATE TEMP TABLE history_data (
  event_date DATE,
  theme TEXT,
  participant TEXT,
  recipe_url TEXT,
  recipe_notes TEXT
);

INSERT INTO history_data (event_date, theme, participant, recipe_url, recipe_notes) VALUES
  ('2023-06-18', 'Almond', 'sarah', 'https://www.insidetherustickitchen.com/pesto-alla-trapanese/', 'Pesto Alla Trapanese'),
  ('2023-06-18', 'Almond', 'hannah', 'http://www.mrbsbistro.com/recipes_trout_amandine.php', 'Trout Amandine'),
  ('2023-06-18', 'Almond', 'hannah', 'https://www.simplyrecipes.com/marzipan-recipe-5295688', 'Marzipan'),
  ('2023-07-31', 'Pickle', 'sarah', 'https://cooking.nytimes.com/recipes/1014140-shortcut-banh-mi-with-pickled-carrots-and-daikon', 'Shortcut Banh Mi'),
  ('2023-07-31', 'Pickle', 'hannah', 'https://cooking.nytimes.com/recipes/1018808-pickled-deviled-eggs', 'Pickled Deviled Eggs'),
  ('2023-09-17', 'Soy Sauce', 'sarah', 'https://thewoksoflife.com/cantonese-soy-sauce-pan-fried-noodles/#recipe', 'Cantonese Soy Sauce Pan Fried Noodles'),
  ('2023-09-17', 'Soy Sauce', 'hannah', 'https://www.simplyrecipes.com/hetty-mckinnon-s-flourless-soy-sauce-brownies-recipe-5189221', 'Flourless Soy Sauce Brownies'),
  ('2024-03-18', 'Potato', 'sarah', 'https://www.thefrenchcookingacademy.com/recipes/pommes-dauphine', 'Pommes Dauphine'),
  ('2024-03-18', 'Potato', 'hannah', 'https://cooking.nytimes.com/recipes/1017724-cheesy-hasselback-potato-gratin', 'Cheesy Hasselback Potato Gratin'),
  ('2024-08-18', 'Soup', 'sarah', 'https://hot-thai-kitchen.com/tom-ka-gai/#recipe', 'Tom Ka Gai'),
  ('2024-08-18', 'Soup', 'hannah', 'https://cooking.nytimes.com/recipes/1019881-split-pea-soup', 'Split Pea Soup'),
  ('2024-11-05', 'Pie', 'hannah', 'https://cooking.nytimes.com/recipes/1019424-atlantic-beach-pie', 'Atlantic Beach Pie'),
  ('2024-11-05', 'Pie', 'sarah', NULL, 'Spanikopita'),
  ('2024-12-15', 'Broccoli', 'sarah', 'https://kalejunkie.com/lemon-parmesan-smashed-broccoli/', 'Lemon Parmesan Smashed Broccoli'),
  ('2024-12-15', 'Broccoli', 'hannah', 'https://cooking.nytimes.com/recipes/1022378-long-cooked-broccoli', 'Long Cooked Broccoli'),
  ('2025-01-03', 'Capers', 'sarah', 'https://themodernproper.com/chicken-piccata', 'Chicken Piccata'),
  ('2025-01-03', 'Capers', 'hannah', 'https://www.bonappetit.com/recipe/cauliflower-steaks-and-puree-with-walnut-caper-salsa', 'Cauliflower Steaks with Walnut Caper Salsa'),
  ('2025-05-06', 'Kale', 'sarah', 'https://cookieandkate.com/kale-pesto-pizza-recipe/', 'Kale Pesto Pizza'),
  ('2025-05-06', 'Kale', 'hannah', 'https://cooking.nytimes.com/recipes/1020780-coconut-creamed-kale', 'Coconut Creamed Kale'),
  ('2025-06-30', 'Lemon', 'sarah', 'https://saratane.substack.com/p/no-149-whole-lemon-marinated-grilled', 'Whole Lemon Marinated Grilled Chicken'),
  ('2025-08-04', 'Tofu', 'sarah', 'https://cooking.nytimes.com/recipes/6609-manicotti-with-cheese-filling', 'Manicotti with Tofu Ricotta'),
  ('2025-08-04', 'Tofu', 'sarah', 'https://sweetsimplevegan.com/tofu-ricotta-cheese/', 'Tofu Ricotta Cheese'),
  ('2025-08-04', 'Tofu', 'hannah', NULL, 'Double Tofu Caesar Sandwich'),
  ('2025-09-15', 'Cornmeal', 'sarah', 'https://mydominicankitchen.com/cornmeal-fritters/', 'Cornmeal Fritters'),
  ('2025-09-15', 'Cornmeal', 'hannah', 'https://cooking.nytimes.com/recipes/1021809-polenta-lasagna-with-spinach', 'Polenta Lasagna with Spinach'),
  ('2025-10-28', 'Beef', 'sarah', 'https://share.google/NIU2n7l5grCmcRmiY', 'Beef Recipe'),
  ('2026-01-12', 'Cucumber', 'sarah', 'https://food52.com/recipes/21569-crunchy-creamy-cucumber-avocado-salad', 'Crunchy Creamy Cucumber Avocado Salad'),
  ('2026-01-12', 'Cucumber', 'hannah', 'https://cooking.nytimes.com/recipes/1021338-stir-fried-cucumber-with-tofu', 'Stir Fried Cucumber with Tofu');

-- Create a temp table to map participant names to user IDs
CREATE TEMP TABLE user_mapping AS
SELECT
  CASE
    WHEN email = 'sarahgsaltz@gmail.com' THEN 'sarah'
    WHEN email = 'hannah.glickman@gmail.com' THEN 'hannah'
  END as participant,
  id as user_id
FROM auth.users
WHERE email IN ('sarahgsaltz@gmail.com', 'hannah.glickman@gmail.com');

-- Show found users (for debugging)
SELECT * FROM user_mapping;

-- 1. Insert ingredients (skip if they already exist)
INSERT INTO ingredients (name, is_used)
SELECT DISTINCT theme, true
FROM history_data
WHERE NOT EXISTS (
  SELECT 1 FROM ingredients WHERE ingredients.name = history_data.theme
)
ON CONFLICT DO NOTHING;

-- Show created ingredients
SELECT id, name FROM ingredients WHERE name IN (SELECT DISTINCT theme FROM history_data);

-- 2. Insert scheduled_events (completed status)
INSERT INTO scheduled_events (event_date, ingredient_id, status)
SELECT DISTINCT
  h.event_date,
  i.id as ingredient_id,
  'completed' as status
FROM history_data h
JOIN ingredients i ON i.name = h.theme
WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_events se
  WHERE se.event_date = h.event_date
  AND se.ingredient_id = i.id
);

-- Show created events
SELECT se.id, se.event_date, i.name as ingredient, se.status
FROM scheduled_events se
JOIN ingredients i ON i.id = se.ingredient_id
WHERE se.event_date IN (SELECT DISTINCT event_date FROM history_data)
ORDER BY se.event_date;

-- 3. Insert recipes
INSERT INTO recipes (name, url, notes, user_id, ingredient_id, event_date)
SELECT
  h.recipe_notes as name,
  h.recipe_url as url,
  CASE WHEN h.recipe_url IS NULL THEN h.recipe_notes ELSE NULL END as notes,
  u.user_id,
  i.id as ingredient_id,
  h.event_date
FROM history_data h
LEFT JOIN user_mapping u ON u.participant = h.participant
JOIN ingredients i ON i.name = h.theme
WHERE NOT EXISTS (
  SELECT 1 FROM recipes r
  WHERE r.event_date = h.event_date
  AND r.name = h.recipe_notes
  AND (r.user_id = u.user_id OR (r.user_id IS NULL AND u.user_id IS NULL))
);

-- Show created recipes
SELECT
  r.name,
  r.event_date,
  i.name as ingredient,
  COALESCE(p.name, 'Unknown') as participant
FROM recipes r
JOIN ingredients i ON i.id = r.ingredient_id
LEFT JOIN profiles p ON p.id = r.user_id
WHERE r.event_date IN (SELECT DISTINCT event_date FROM history_data)
ORDER BY r.event_date, r.name;

-- Clean up temp tables
DROP TABLE history_data;
DROP TABLE user_mapping;
