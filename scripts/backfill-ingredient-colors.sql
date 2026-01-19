-- Backfill colors for existing ingredients
-- Run this script once after applying the 20260118_ingredient_colors.sql migration

-- Yellow/Orange ingredients
UPDATE ingredients SET color = '#FFB347' WHERE LOWER(name) LIKE '%mango%' AND color IS NULL;
UPDATE ingredients SET color = '#FFE135' WHERE LOWER(name) LIKE '%banana%' AND color IS NULL;
UPDATE ingredients SET color = '#FFF44F' WHERE LOWER(name) LIKE '%lemon%' AND color IS NULL;
UPDATE ingredients SET color = '#FBEC5D' WHERE LOWER(name) LIKE '%corn%' AND color IS NULL;
UPDATE ingredients SET color = '#FFD700' WHERE LOWER(name) LIKE '%pineapple%' AND color IS NULL;
UPDATE ingredients SET color = '#E8A317' WHERE LOWER(name) LIKE '%squash%' AND color IS NULL;
UPDATE ingredients SET color = '#FF7518' WHERE LOWER(name) LIKE '%pumpkin%' AND color IS NULL;
UPDATE ingredients SET color = '#FFA500' WHERE LOWER(name) LIKE '%orange%' AND color IS NULL;
UPDATE ingredients SET color = '#ED9121' WHERE LOWER(name) LIKE '%carrot%' AND color IS NULL;
UPDATE ingredients SET color = '#D2691E' WHERE LOWER(name) LIKE '%sweet potato%' AND color IS NULL;
UPDATE ingredients SET color = '#FFCBA4' WHERE LOWER(name) LIKE '%peach%' AND color IS NULL;
UPDATE ingredients SET color = '#FBCEB1' WHERE LOWER(name) LIKE '%apricot%' AND color IS NULL;
UPDATE ingredients SET color = '#FFD54F' WHERE LOWER(name) LIKE '%turmeric%' AND color IS NULL;
UPDATE ingredients SET color = '#D4A574' WHERE LOWER(name) LIKE '%ginger%' AND color IS NULL;
UPDATE ingredients SET color = '#E8A317' WHERE LOWER(name) LIKE '%butternut%' AND color IS NULL;
UPDATE ingredients SET color = '#FFA62F' WHERE LOWER(name) LIKE '%cantaloupe%' AND color IS NULL;
UPDATE ingredients SET color = '#FFEFD5' WHERE LOWER(name) LIKE '%papaya%' AND color IS NULL;
UPDATE ingredients SET color = '#EC5800' WHERE LOWER(name) LIKE '%persimmon%' AND color IS NULL;

-- Red/Pink ingredients
UPDATE ingredients SET color = '#FF6347' WHERE LOWER(name) LIKE '%tomato%' AND color IS NULL;
UPDATE ingredients SET color = '#FC5A8D' WHERE LOWER(name) LIKE '%strawberry%' AND color IS NULL;
UPDATE ingredients SET color = '#E30B5C' WHERE LOWER(name) LIKE '%raspberry%' AND color IS NULL;
UPDATE ingredients SET color = '#DE3163' WHERE LOWER(name) LIKE '%cherry%' AND color IS NULL;
UPDATE ingredients SET color = '#FC6C85' WHERE LOWER(name) LIKE '%watermelon%' AND color IS NULL;
UPDATE ingredients SET color = '#8E4585' WHERE LOWER(name) LIKE '%beet%' AND color IS NULL;
UPDATE ingredients SET color = '#FF6B6B' WHERE LOWER(name) LIKE '%radish%' AND color IS NULL;
UPDATE ingredients SET color = '#FF4444' WHERE LOWER(name) LIKE '%red pepper%' AND color IS NULL;
UPDATE ingredients SET color = '#FF4444' WHERE LOWER(name) LIKE '%bell pepper%' AND color IS NULL;
UPDATE ingredients SET color = '#C41E3A' WHERE LOWER(name) LIKE '%pomegranate%' AND color IS NULL;
UPDATE ingredients SET color = '#9F000F' WHERE LOWER(name) LIKE '%cranberry%' AND color IS NULL;
UPDATE ingredients SET color = '#E34234' WHERE LOWER(name) LIKE '%rhubarb%' AND color IS NULL;
UPDATE ingredients SET color = '#CC5500' WHERE LOWER(name) LIKE '%blood orange%' AND color IS NULL;

-- Green ingredients
UPDATE ingredients SET color = '#3CB371' WHERE LOWER(name) LIKE '%spinach%' AND color IS NULL;
UPDATE ingredients SET color = '#4A7023' WHERE LOWER(name) LIKE '%kale%' AND color IS NULL;
UPDATE ingredients SET color = '#4F7942' WHERE LOWER(name) LIKE '%broccoli%' AND color IS NULL;
UPDATE ingredients SET color = '#77DD77' WHERE LOWER(name) LIKE '%cucumber%' AND color IS NULL;
UPDATE ingredients SET color = '#568203' WHERE LOWER(name) LIKE '%avocado%' AND color IS NULL;
UPDATE ingredients SET color = '#32CD32' WHERE LOWER(name) LIKE '%lime%' AND color IS NULL;
UPDATE ingredients SET color = '#89C35C' WHERE LOWER(name) LIKE '%pea%' AND color IS NULL;
UPDATE ingredients SET color = '#6B8E23' WHERE LOWER(name) LIKE '%green bean%' AND color IS NULL;
UPDATE ingredients SET color = '#7BA05B' WHERE LOWER(name) LIKE '%zucchini%' AND color IS NULL;
UPDATE ingredients SET color = '#87A96B' WHERE LOWER(name) LIKE '%asparagus%' AND color IS NULL;
UPDATE ingredients SET color = '#ACE1AF' WHERE LOWER(name) LIKE '%celery%' AND color IS NULL;
UPDATE ingredients SET color = '#7CFC00' WHERE LOWER(name) LIKE '%lettuce%' AND color IS NULL;
UPDATE ingredients SET color = '#5F9341' WHERE LOWER(name) LIKE '%basil%' AND color IS NULL;
UPDATE ingredients SET color = '#98FB98' WHERE LOWER(name) LIKE '%mint%' AND color IS NULL;
UPDATE ingredients SET color = '#7BB661' WHERE LOWER(name) LIKE '%cilantro%' AND color IS NULL;
UPDATE ingredients SET color = '#5DA130' WHERE LOWER(name) LIKE '%parsley%' AND color IS NULL;
UPDATE ingredients SET color = '#8F9779' WHERE LOWER(name) LIKE '%artichoke%' AND color IS NULL;
UPDATE ingredients SET color = '#8DB600' WHERE LOWER(name) LIKE '%brussels%' AND color IS NULL;
UPDATE ingredients SET color = '#8DB600' WHERE LOWER(name) LIKE '%edamame%' AND color IS NULL;

-- Purple/Blue ingredients
UPDATE ingredients SET color = '#614051' WHERE LOWER(name) LIKE '%eggplant%' AND color IS NULL;
UPDATE ingredients SET color = '#8B008B' WHERE LOWER(name) LIKE '%purple cabbage%' AND color IS NULL;
UPDATE ingredients SET color = '#4F86F7' WHERE LOWER(name) LIKE '%blueberry%' AND color IS NULL;
UPDATE ingredients SET color = '#6F2DA8' WHERE LOWER(name) LIKE '%grape%' AND color IS NULL;
UPDATE ingredients SET color = '#8E4585' WHERE LOWER(name) LIKE '%plum%' AND color IS NULL;
UPDATE ingredients SET color = '#A2006D' WHERE LOWER(name) LIKE '%fig%' AND color IS NULL;
UPDATE ingredients SET color = '#3B0D0C' WHERE LOWER(name) LIKE '%blackberry%' AND color IS NULL;
UPDATE ingredients SET color = '#2E0854' WHERE LOWER(name) LIKE '%acai%' AND color IS NULL;

-- Brown/Tan ingredients
UPDATE ingredients SET color = '#8B7355' WHERE LOWER(name) LIKE '%mushroom%' AND color IS NULL;
UPDATE ingredients SET color = '#C4A35A' WHERE LOWER(name) LIKE '%potato%' AND color IS NULL;
UPDATE ingredients SET color = '#D4A574' WHERE LOWER(name) LIKE '%onion%' AND color IS NULL;
UPDATE ingredients SET color = '#A67B5B' WHERE LOWER(name) LIKE '%brown rice%' AND color IS NULL;
UPDATE ingredients SET color = '#E2C08D' WHERE LOWER(name) LIKE '%oat%' AND color IS NULL;
UPDATE ingredients SET color = '#5D432C' WHERE LOWER(name) LIKE '%walnut%' AND color IS NULL;
UPDATE ingredients SET color = '#EFDECD' WHERE LOWER(name) LIKE '%almond%' AND color IS NULL;
UPDATE ingredients SET color = '#C9AE5D' WHERE LOWER(name) LIKE '%peanut%' AND color IS NULL;
UPDATE ingredients SET color = '#D4A574' WHERE LOWER(name) LIKE '%bread%' AND color IS NULL;
UPDATE ingredients SET color = '#D4AF37' WHERE LOWER(name) LIKE '%wheat%' AND color IS NULL;
UPDATE ingredients SET color = '#C2B280' WHERE LOWER(name) LIKE '%quinoa%' AND color IS NULL;

-- White/Cream ingredients
UPDATE ingredients SET color = '#F5F5F5' WHERE LOWER(name) LIKE '%cauliflower%' AND color IS NULL;
UPDATE ingredients SET color = '#FFFFF0' WHERE LOWER(name) LIKE '%garlic%' AND color IS NULL;
UPDATE ingredients SET color = '#F0EAD6' WHERE LOWER(name) LIKE '%tofu%' AND color IS NULL;
UPDATE ingredients SET color = '#FFFDD0' WHERE LOWER(name) LIKE '%coconut%' AND color IS NULL;
UPDATE ingredients SET color = '#FAF0E6' WHERE LOWER(name) LIKE '%white bean%' AND color IS NULL;
UPDATE ingredients SET color = '#FAFAFA' WHERE LOWER(name) LIKE '%rice%' AND color IS NULL;

-- Proteins
UPDATE ingredients SET color = '#E6D5B8' WHERE LOWER(name) LIKE '%chicken%' AND color IS NULL;
UPDATE ingredients SET color = '#A0522D' WHERE LOWER(name) LIKE '%beef%' AND color IS NULL;
UPDATE ingredients SET color = '#FFB6C1' WHERE LOWER(name) LIKE '%pork%' AND color IS NULL;
UPDATE ingredients SET color = '#FA8072' WHERE LOWER(name) LIKE '%salmon%' AND color IS NULL;
UPDATE ingredients SET color = '#E0B0B0' WHERE LOWER(name) LIKE '%tuna%' AND color IS NULL;
UPDATE ingredients SET color = '#FF9966' WHERE LOWER(name) LIKE '%shrimp%' AND color IS NULL;
UPDATE ingredients SET color = '#B0C4DE' WHERE LOWER(name) LIKE '%fish%' AND color IS NULL;
UPDATE ingredients SET color = '#D2691E' WHERE LOWER(name) LIKE '%lamb%' AND color IS NULL;
UPDATE ingredients SET color = '#D4A574' WHERE LOWER(name) LIKE '%turkey%' AND color IS NULL;
UPDATE ingredients SET color = '#BC8F8F' WHERE LOWER(name) LIKE '%duck%' AND color IS NULL;
UPDATE ingredients SET color = '#E63946' WHERE LOWER(name) LIKE '%lobster%' AND color IS NULL;
UPDATE ingredients SET color = '#FF7F50' WHERE LOWER(name) LIKE '%crab%' AND color IS NULL;

-- Dairy
UPDATE ingredients SET color = '#FFD700' WHERE LOWER(name) LIKE '%cheese%' AND color IS NULL;
UPDATE ingredients SET color = '#FFFEF0' WHERE LOWER(name) LIKE '%milk%' AND color IS NULL;
UPDATE ingredients SET color = '#FFEB99' WHERE LOWER(name) LIKE '%butter%' AND color IS NULL;
UPDATE ingredients SET color = '#FFFEF0' WHERE LOWER(name) LIKE '%yogurt%' AND color IS NULL;
UPDATE ingredients SET color = '#FFFDD0' WHERE LOWER(name) LIKE '%cream%' AND color IS NULL;

-- Beans/Legumes
UPDATE ingredients SET color = '#1C1C1C' WHERE LOWER(name) LIKE '%black bean%' AND color IS NULL;
UPDATE ingredients SET color = '#704214' WHERE LOWER(name) LIKE '%lentil%' AND color IS NULL;
UPDATE ingredients SET color = '#E4C580' WHERE LOWER(name) LIKE '%chickpea%' AND color IS NULL;
UPDATE ingredients SET color = '#6B2D2D' WHERE LOWER(name) LIKE '%kidney bean%' AND color IS NULL;

-- Grains
UPDATE ingredients SET color = '#FFEFD5' WHERE LOWER(name) LIKE '%pasta%' AND color IS NULL;
UPDATE ingredients SET color = '#F5DEB3' WHERE LOWER(name) LIKE '%couscous%' AND color IS NULL;
UPDATE ingredients SET color = '#C4A35A' WHERE LOWER(name) LIKE '%barley%' AND color IS NULL;

-- Misc
UPDATE ingredients SET color = '#3D1F0E' WHERE LOWER(name) LIKE '%chocolate%' AND color IS NULL;
UPDATE ingredients SET color = '#EB9605' WHERE LOWER(name) LIKE '%honey%' AND color IS NULL;
UPDATE ingredients SET color = '#E4D5B7' WHERE LOWER(name) LIKE '%soy%' AND color IS NULL;
UPDATE ingredients SET color = '#BB6528' WHERE LOWER(name) LIKE '%maple%' AND color IS NULL;

-- For any remaining ingredients without a color, assign a default based on name hash
-- This uses a simple modulo approach to distribute colors evenly
-- The default colors are pleasant, muted food-related colors
UPDATE ingredients
SET color = CASE
    WHEN MOD(ASCII(SUBSTRING(LOWER(name), 1, 1)), 10) = 0 THEN '#E8B4B8'  -- Dusty rose
    WHEN MOD(ASCII(SUBSTRING(LOWER(name), 1, 1)), 10) = 1 THEN '#A8D5BA'  -- Sage green
    WHEN MOD(ASCII(SUBSTRING(LOWER(name), 1, 1)), 10) = 2 THEN '#B4C7E7'  -- Soft blue
    WHEN MOD(ASCII(SUBSTRING(LOWER(name), 1, 1)), 10) = 3 THEN '#F5E6CC'  -- Cream
    WHEN MOD(ASCII(SUBSTRING(LOWER(name), 1, 1)), 10) = 4 THEN '#D4B8E3'  -- Lavender
    WHEN MOD(ASCII(SUBSTRING(LOWER(name), 1, 1)), 10) = 5 THEN '#C9E4CA'  -- Mint
    WHEN MOD(ASCII(SUBSTRING(LOWER(name), 1, 1)), 10) = 6 THEN '#F0D9B5'  -- Wheat
    WHEN MOD(ASCII(SUBSTRING(LOWER(name), 1, 1)), 10) = 7 THEN '#B8D4E3'  -- Sky blue
    WHEN MOD(ASCII(SUBSTRING(LOWER(name), 1, 1)), 10) = 8 THEN '#E3D4B8'  -- Sand
    ELSE '#D4E3B8'  -- Lime cream
END
WHERE color IS NULL;

-- Verify results
SELECT name, color FROM ingredients ORDER BY name;
