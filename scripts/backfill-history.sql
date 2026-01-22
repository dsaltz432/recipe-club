-- Recipe Club History Backfill Script
-- Run this in the Supabase SQL Editor
--
-- Current schema (as of Jan 2026):
--   ingredients: id, name, used_count, in_bank, last_used_by, last_used_date, created_by, created_at, color
--   recipes: id, name, url, event_id, ingredient_id, created_by, created_at
--   recipe_notes: id, recipe_id, user_id, notes, photos, created_at
--   recipe_ratings: id, recipe_id, user_id, event_id, would_cook_again, overall_rating, created_at
--   scheduled_events: id, ingredient_id, event_date, event_time, created_by, status, calendar_event_id, created_at

-- First, let's create a temporary table with the history data
CREATE TEMP TABLE history_data (
  event_date DATE,
  theme TEXT,
  participant TEXT,
  recipe_name TEXT,
  recipe_url TEXT
);

INSERT INTO history_data (event_date, theme, participant, recipe_name, recipe_url) VALUES
  ('2021-07-29', 'Coconut', 'sarah', 'Chicken Satay', 'https://www.delish.com/cooking/recipe-ideas/a27198099/chicken-satay-recipe/'),
  ('2021-07-29', 'Coconut', 'sarah', 'Coconut Rice', 'https://cooking.nytimes.com/recipes/1019200-coconut-rice'),
  ('2021-07-29', 'Coconut', 'hannah', 'Yellow Chicken Adobo', 'https://www.epicurious.com/recipes/food/views/yellow-chicken-adobo'),
  ('2021-09-23', 'Chickpea Flour', 'sarah', 'Vegan Crab Cakes', 'https://vanillaandbean.com/vegan-crab-cakes/'),
  ('2021-09-23', 'Chickpea Flour', 'hannah', 'Vegetable Pakora', 'https://www.indianhealthyrecipes.com/pakora-recipe-vegetable-pakora-pakoda/'),
  ('2021-09-23', 'Chickpea Flour', 'hannah', 'Mysore Pak (Chickpea Fudge)', 'https://nishkitchen.com/mysore-pak-chickpea-fudge-video/'),
  ('2021-11-08', 'Artichoke', 'sarah', 'Fried Artichokes with Lemony Garlic Aioli', 'https://cravingcalifornia.com/fried-artichokes-with-lemony-garlic-aioli/'),
  ('2021-11-08', 'Artichoke', 'hannah', 'Artichoke Soup with Pesto', 'https://www.bonappetit.com/recipe/artichoke-soup-with-pesto'),
  ('2022-01-20', 'Rice Noodles', 'sarah', 'Microwave Mushroom Cheung Fun', 'https://thefoodietakesflight.com/microwave-mushroom-cheung-fun-vegan-rice-noodle-rolls/#recipe'),
  ('2022-01-20', 'Rice Noodles', 'hannah', 'Rice Noodles with Garlicky Cashew Sauce', 'https://cooking.nytimes.com/recipes/1021532-rice-noodles-with-garlicky-cashew-sauce'),
  ('2022-02-09', 'Whitefish', 'sarah', 'Beer-Battered Fish with Malt Vinegar Aioli', 'https://www.foodandwine.com/recipes/beer-battered-fish-malt-vinegar-aioli'),
  ('2022-02-09', 'Whitefish', 'hannah', 'Easy Provencal Fish', 'https://www.thespruceeats.com/easy-provencal-fish-recipe-1807400'),
  ('2022-06-06', 'Cauliflower', 'sarah', 'Gobi 65', 'https://www.indianhealthyrecipes.com/gobi-65-recipe-baked-grilled-version-step-by-step/'),
  ('2022-06-06', 'Cauliflower', 'hannah', 'Sticky and Spicy Baked Cauliflower', 'https://www.bonappetit.com/recipe/sticky-and-spicy-baked-cauliflower'),
  ('2022-09-05', 'Beer', 'sarah', 'Chocolate Guinness Cake', 'https://cooking.nytimes.com/recipes/1875-chocolate-guinness-cake'),
  ('2022-09-05', 'Beer', 'hannah', 'Beer Bread', 'https://cooking.nytimes.com/recipes/2766-beer-bread'),
  ('2022-09-05', 'Beer', 'hannah', 'Aged Cheddar and Beer Dip', 'https://www.marthastewart.com/1518183/aged-cheddar-and-beer-dip'),
  ('2022-10-23', 'Casserole', 'sarah', 'Macaroni and Cheese', 'https://www.marthastewart.com/957243/macaroni-and-cheese'),
  ('2022-10-23', 'Casserole', 'hannah', 'Cheesy White Bean Tomato Bake', 'https://cooking.nytimes.com/recipes/1019681-cheesy-white-bean-tomato-bake'),
  ('2023-01-16', 'Fennel', 'sarah', 'Roasted Fennel Pasta', 'https://food52.com/recipes/85297-roasted-fennel-pasta'),
  ('2023-01-16', 'Fennel', 'hannah', 'Braised Fennel', 'https://bluilkrggkspxsnehfez.supabase.co/storage/v1/object/public/recipe-images/0cdace30-fec1-402a-991f-2eb2ca6ca5f1.jpg'),
  ('2023-02-19', 'Ground Meat', 'sarah', 'Mom''s Korokke (Croquette)', 'https://www.justonecookbook.com/moms-korokke-croquette/'),
  ('2023-02-19', 'Ground Meat', 'hannah', 'Chicken Larb', 'https://thewoksoflife.com/chicken-larb/'),
  ('2023-03-19', 'Allium', 'sarah', 'Stuffed Onions', 'https://cooking.nytimes.com/recipes/1022670-stuffed-onions'),
  ('2023-03-19', 'Allium', 'hannah', 'Bean Confit with Lemon Saffron and All the Alliums', 'https://www.bonappetit.com/recipe/bean-confit-with-lemon-saffron-and-all-the-alliums'),
  ('2023-06-18', 'Almond', 'sarah', 'Pesto alla Trapanese', 'https://www.insidetherustickitchen.com/pesto-alla-trapanese/'),
  ('2023-06-18', 'Almond', 'hannah', 'Trout Amandine', 'http://www.mrbsbistro.com/recipes_trout_amandine.php'),
  ('2023-07-31', 'Pickle', 'sarah', 'Shortcut Banh Mi with Pickled Carrots and Daikon', 'https://cooking.nytimes.com/recipes/1014140-shortcut-banh-mi-with-pickled-carrots-and-daikon'),
  ('2023-07-31', 'Pickle', 'hannah', 'Pickled Deviled Eggs', 'https://cooking.nytimes.com/recipes/1018808-pickled-deviled-eggs'),
  ('2023-09-17', 'Soy Sauce', 'sarah', 'Cantonese Soy Sauce Pan-Fried Noodles', 'https://thewoksoflife.com/cantonese-soy-sauce-pan-fried-noodles/#recipe'),
  ('2023-09-17', 'Soy Sauce', 'hannah', 'Hetty McKinnon''s Flourless Soy Sauce Brownies', 'https://www.simplyrecipes.com/hetty-mckinnon-s-flourless-soy-sauce-brownies-recipe-5189221'),
  ('2024-03-18', 'Potato', 'sarah', 'Pommes Dauphine', 'https://www.thefrenchcookingacademy.com/recipes/pommes-dauphine'),
  ('2024-03-18', 'Potato', 'hannah', 'Cheesy Hasselback Potato Gratin', 'https://cooking.nytimes.com/recipes/1017724-cheesy-hasselback-potato-gratin'),
  ('2024-08-18', 'Soup', 'sarah', 'Tom Kha Gai', 'https://hot-thai-kitchen.com/tom-ka-gai/#recipe'),
  ('2024-08-18', 'Soup', 'hannah', 'Split Pea Soup', 'https://cooking.nytimes.com/recipes/1019881-split-pea-soup'),
  ('2024-11-10', 'Pie', 'sarah', 'Spanakopita', 'https://www.fufuskitchen.com/spanakopita/#recipe'),
  ('2024-11-10', 'Pie', 'hannah', 'Atlantic Beach Pie', 'https://cooking.nytimes.com/recipes/1019424-atlantic-beach-pie'),
  ('2024-12-15', 'Broccoli', 'sarah', 'Lemon Parmesan Smashed Broccoli', 'https://kalejunkie.com/lemon-parmesan-smashed-broccoli/'),
  ('2024-12-15', 'Broccoli', 'hannah', 'Long-Cooked Broccoli', 'https://cooking.nytimes.com/recipes/1022378-long-cooked-broccoli'),
  ('2025-01-03', 'Capers', 'sarah', 'Chicken Piccata', 'https://themodernproper.com/chicken-piccata'),
  ('2025-01-03', 'Capers', 'hannah', 'Cauliflower Steaks and Puree with Walnut Caper Salsa', 'https://www.bonappetit.com/recipe/cauliflower-steaks-and-puree-with-walnut-caper-salsa'),
  ('2025-05-06', 'Kale', 'sarah', 'Kale Pesto Pizza', 'https://cookieandkate.com/kale-pesto-pizza-recipe/'),
  ('2025-05-06', 'Kale', 'hannah', 'Coconut Creamed Kale', 'https://cooking.nytimes.com/recipes/1020780-coconut-creamed-kale'),
  ('2025-06-30', 'Lemon', 'sarah', 'Whole Lemon Marinated Grilled Chicken', 'https://saratane.substack.com/p/no-149-whole-lemon-marinated-grilled'),
  ('2025-06-30', 'Lemon', 'hannah', 'Whole Lemon Salad', 'https://bluilkrggkspxsnehfez.supabase.co/storage/v1/object/public/recipe-images/0ea9c586-ea2b-49fc-8da1-108a1c7b1bce.pdf'),
  ('2025-08-04', 'Tofu', 'sarah', 'Manicotti with Cheese Filling and Bolognese Sauce', 'https://cooking.nytimes.com/recipes/6609-manicotti-with-cheese-filling-and-bolognese-sauce'),
  ('2025-08-04', 'Tofu', 'hannah', 'Double Tofu Caesar Sandwich', 'https://www.instagram.com/reels/DBY9V-LyXLW/'),
  ('2025-09-15', 'Cornmeal', 'sarah', 'Cornmeal Fritters', 'https://mydominicankitchen.com/cornmeal-fritters/'),
  ('2025-09-15', 'Cornmeal', 'hannah', 'Polenta Lasagna with Spinach and Herby Ricotta', 'https://cooking.nytimes.com/recipes/1021809-polenta-lasagna-with-spinach-and-herby-ricotta'),
  ('2025-10-28', 'Beef', 'sarah', 'Beef Recipe Link', 'https://share.google/NIU2n7l5grCmcRmiY'),
  ('2025-10-28', 'Beef', 'hannah', 'Skirt Steak with Jammy Shallots', 'https://mollybaz.com/celebration-steak-with-jammy-vinegar-shallots/'),
  ('2026-01-12', 'Cucumber', 'sarah', 'Crunchy Creamy Cucumber Avocado Salad', 'https://food52.com/recipes/21569-crunchy-creamy-cucumber-avocado-salad'),
  ('2026-01-12', 'Cucumber', 'hannah', 'Stir-Fried Cucumber with Tofu', 'https://cooking.nytimes.com/recipes/1021338-stir-fried-cucumber-with-tofu');

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
SELECT 'Found users:' as info;
SELECT * FROM user_mapping;

-- Calculate usage stats per ingredient
CREATE TEMP TABLE ingredient_stats AS
SELECT
  theme,
  COUNT(DISTINCT event_date) as used_count,
  MAX(event_date) as last_used_date
FROM history_data
GROUP BY theme;

-- Get last user for each ingredient (user from the most recent event)
CREATE TEMP TABLE ingredient_last_user AS
SELECT DISTINCT ON (h.theme)
  h.theme,
  u.user_id as last_used_by
FROM history_data h
JOIN user_mapping u ON u.participant = h.participant
ORDER BY h.theme, h.event_date DESC;

-- 1. Insert or update ingredients (historical ingredients with in_bank = false)
SELECT 'Creating ingredients...' as info;

-- First, insert new ingredients that don't exist
INSERT INTO ingredients (name, used_count, in_bank, last_used_date, last_used_by)
SELECT
  s.theme,
  s.used_count,
  false as in_bank,  -- Historical ingredients are not in the active bank
  s.last_used_date,
  lu.last_used_by
FROM ingredient_stats s
LEFT JOIN ingredient_last_user lu ON lu.theme = s.theme
WHERE NOT EXISTS (
  SELECT 1 FROM ingredients WHERE ingredients.name = s.theme
);

-- Then, update existing ingredients with usage stats
UPDATE ingredients i
SET
  used_count = s.used_count,
  last_used_date = s.last_used_date,
  last_used_by = lu.last_used_by
FROM ingredient_stats s
LEFT JOIN ingredient_last_user lu ON lu.theme = s.theme
WHERE i.name = s.theme;

-- Show created/updated ingredients
SELECT 'Ingredients:' as info;
SELECT id, name, used_count, in_bank, last_used_date FROM ingredients
WHERE name IN (SELECT DISTINCT theme FROM history_data)
ORDER BY name;

-- 2. Insert scheduled_events (completed status)
SELECT 'Creating events...' as info;

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
SELECT 'Events:' as info;
SELECT se.id, se.event_date, i.name as ingredient, se.status
FROM scheduled_events se
JOIN ingredients i ON i.id = se.ingredient_id
WHERE se.event_date IN (SELECT DISTINCT event_date FROM history_data)
ORDER BY se.event_date;

-- 3. Insert recipes (with event_id and ingredient_id)
-- Each recipe is now tied to a specific event
SELECT 'Creating recipes...' as info;

INSERT INTO recipes (name, url, event_id, ingredient_id, created_by)
SELECT
  h.recipe_name,
  h.recipe_url,
  se.id as event_id,
  i.id as ingredient_id,
  u.user_id as created_by
FROM history_data h
JOIN ingredients i ON i.name = h.theme
JOIN scheduled_events se ON se.event_date = h.event_date AND se.ingredient_id = i.id
LEFT JOIN user_mapping u ON u.participant = h.participant
WHERE NOT EXISTS (
  -- Check for existing recipe by name + event (since recipes are now event-specific)
  SELECT 1 FROM recipes r
  WHERE r.name = h.recipe_name
  AND r.event_id = se.id
);

-- Show created recipes
SELECT 'Recipes:' as info;
SELECT r.id, r.name, r.url IS NOT NULL as has_url, i.name as ingredient, se.event_date
FROM recipes r
JOIN scheduled_events se ON se.id = r.event_id
JOIN ingredients i ON i.id = r.ingredient_id
WHERE r.name IN (SELECT DISTINCT recipe_name FROM history_data)
ORDER BY se.event_date, r.name;

-- Note: recipe_notes and recipe_ratings tables are for user-generated content.
-- Historical data doesn't include notes or ratings, so we skip creating those entries.
-- Users can add notes and ratings later through the app interface.

-- Clean up temp tables
DROP TABLE history_data;
DROP TABLE user_mapping;
DROP TABLE ingredient_stats;
DROP TABLE ingredient_last_user;

SELECT 'Backfill complete!' as info;
SELECT 'Total events: ' || COUNT(DISTINCT event_date) as summary FROM scheduled_events WHERE status = 'completed';
SELECT 'Total ingredients: ' || COUNT(*) as summary FROM ingredients WHERE used_count > 0;
SELECT 'Total recipes: ' || COUNT(*) as summary FROM recipes WHERE event_id IS NOT NULL;
