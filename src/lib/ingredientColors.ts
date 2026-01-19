/**
 * Maps ingredient names to appropriate colors based on their typical appearance.
 * Returns a hex color code.
 */

// Color mapping for common ingredients based on their typical color
const INGREDIENT_COLOR_MAP: Record<string, string> = {
  // Yellows/Oranges
  mango: "#FFB347",
  banana: "#FFE135",
  lemon: "#FFF44F",
  corn: "#FBEC5D",
  pineapple: "#FFD700",
  squash: "#E8A317",
  pumpkin: "#FF7518",
  orange: "#FFA500",
  carrot: "#ED9121",
  "sweet potato": "#D2691E",
  peach: "#FFCBA4",
  apricot: "#FBCEB1",
  turmeric: "#FFD54F",
  ginger: "#D4A574",
  butternut: "#E8A317",
  cantaloupe: "#FFA62F",
  papaya: "#FFEFD5",
  persimmon: "#EC5800",

  // Reds/Pinks
  tomato: "#FF6347",
  strawberry: "#FC5A8D",
  raspberry: "#E30B5C",
  cherry: "#DE3163",
  watermelon: "#FC6C85",
  beet: "#8E4585",
  radish: "#FF6B6B",
  "red pepper": "#FF4444",
  "bell pepper": "#FF4444",
  pomegranate: "#C41E3A",
  cranberry: "#9F000F",
  rhubarb: "#E34234",
  "blood orange": "#CC5500",

  // Greens
  spinach: "#3CB371",
  kale: "#4A7023",
  broccoli: "#4F7942",
  cucumber: "#77DD77",
  avocado: "#568203",
  lime: "#32CD32",
  pea: "#89C35C",
  "green bean": "#6B8E23",
  zucchini: "#7BA05B",
  asparagus: "#87A96B",
  celery: "#ACE1AF",
  lettuce: "#7CFC00",
  basil: "#5F9341",
  mint: "#98FB98",
  cilantro: "#7BB661",
  parsley: "#5DA130",
  artichoke: "#8F9779",
  "brussels sprout": "#8DB600",
  edamame: "#8DB600",

  // Purples/Blues
  eggplant: "#614051",
  "purple cabbage": "#8B008B",
  blueberry: "#4F86F7",
  grape: "#6F2DA8",
  plum: "#8E4585",
  fig: "#A2006D",
  blackberry: "#3B0D0C",
  "acai": "#2E0854",

  // Browns/Tans
  mushroom: "#8B7355",
  potato: "#C4A35A",
  onion: "#D4A574",
  "brown rice": "#A67B5B",
  oat: "#E2C08D",
  walnut: "#5D432C",
  almond: "#EFDECD",
  peanut: "#C9AE5D",
  bread: "#D4A574",
  wheat: "#D4AF37",
  quinoa: "#C2B280",

  // Whites/Creams
  cauliflower: "#F5F5F5",
  garlic: "#FFFFF0",
  tofu: "#F0EAD6",
  coconut: "#FFFDD0",
  "white bean": "#FAF0E6",
  rice: "#FAFAFA",
  "egg white": "#FFFAFA",

  // Proteins (using warm neutrals)
  chicken: "#E6D5B8",
  beef: "#A0522D",
  pork: "#FFB6C1",
  salmon: "#FA8072",
  tuna: "#E0B0B0",
  shrimp: "#FF9966",
  fish: "#B0C4DE",
  lamb: "#D2691E",
  turkey: "#D4A574",
  duck: "#BC8F8F",
  lobster: "#E63946",
  crab: "#FF7F50",

  // Dairy
  cheese: "#FFD700",
  milk: "#FFFEF0",
  butter: "#FFEB99",
  yogurt: "#FFFEF0",
  cream: "#FFFDD0",

  // Beans/Legumes
  "black bean": "#1C1C1C",
  lentil: "#704214",
  chickpea: "#E4C580",
  "kidney bean": "#6B2D2D",

  // Grains
  pasta: "#FFEFD5",
  couscous: "#F5DEB3",
  barley: "#C4A35A",

  // Misc
  chocolate: "#3D1F0E",
  honey: "#EB9605",
  soy: "#E4D5B7",
  "maple syrup": "#BB6528",
};

// Default colors for ingredients without specific mappings
// These are pleasant, muted food-related colors
const DEFAULT_COLORS = [
  "#E8B4B8", // Dusty rose
  "#A8D5BA", // Sage green
  "#B4C7E7", // Soft blue
  "#F5E6CC", // Cream
  "#D4B8E3", // Lavender
  "#C9E4CA", // Mint
  "#F0D9B5", // Wheat
  "#B8D4E3", // Sky blue
  "#E3D4B8", // Sand
  "#D4E3B8", // Lime cream
];

/**
 * Gets a color for an ingredient based on its name.
 * First tries to match against known ingredient colors,
 * then falls back to a consistent hash-based color.
 */
export function getIngredientColor(ingredientName: string): string {
  const lowerName = ingredientName.toLowerCase().trim();

  // Check for exact match
  if (INGREDIENT_COLOR_MAP[lowerName]) {
    return INGREDIENT_COLOR_MAP[lowerName];
  }

  // Check for partial matches (e.g., "cherry tomato" should match "tomato")
  for (const [key, color] of Object.entries(INGREDIENT_COLOR_MAP)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return color;
    }
  }

  // Fall back to a consistent color based on the name hash
  const hash = hashString(lowerName);
  return DEFAULT_COLORS[hash % DEFAULT_COLORS.length];
}

/**
 * Simple string hash function for consistent color assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Converts a hex color to RGBA with specified opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(155, 135, 245, ${opacity})`; // Fallback to purple

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Gets a lighter version of the color suitable for backgrounds
 */
export function getLightBackgroundColor(hex: string): string {
  return hexToRgba(hex, 0.15);
}

/**
 * Gets a medium opacity version for borders
 */
export function getBorderColor(hex: string): string {
  return hexToRgba(hex, 0.3);
}

/**
 * Calculates the relative luminance of a color
 * Based on WCAG 2.0 formula
 */
function getLuminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0.5; // Default to mid-range

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  // Apply gamma correction
  const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Returns a text color (dark or light) that contrasts well with the given background color
 */
export function getContrastTextColor(hex: string): string {
  const luminance = getLuminance(hex);
  // Use dark text for light backgrounds, light text for dark backgrounds
  // Threshold of 0.5 provides good contrast in most cases
  return luminance > 0.5 ? "#1a1a1a" : "#ffffff";
}

/**
 * Returns a darker version of the color for text that needs to be visible on white/light backgrounds
 * This ensures the text is readable while maintaining the color theme
 */
export function getDarkerTextColor(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "#1a1a1a";

  const r = Math.max(0, Math.floor(parseInt(result[1], 16) * 0.6));
  const g = Math.max(0, Math.floor(parseInt(result[2], 16) * 0.6));
  const b = Math.max(0, Math.floor(parseInt(result[3], 16) * 0.6));

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Parses a hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Calculates the Euclidean distance between two RGB colors
 */
function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return Infinity;

  // Weighted Euclidean distance (human eye is more sensitive to green)
  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;
  return Math.sqrt(2 * rDiff * rDiff + 4 * gDiff * gDiff + 3 * bDiff * bDiff);
}

/**
 * Finds the closest vibrant wheel color to a given ingredient color.
 * This ensures the wheel always looks bright and colorful while still
 * being directionally accurate to the ingredient's natural color.
 */
export function getVibrantWheelColor(ingredientColor: string, wheelColors: string[]): string {
  if (wheelColors.length === 0) return ingredientColor;

  let closestColor = wheelColors[0];
  let minDistance = colorDistance(ingredientColor, wheelColors[0]);

  for (let i = 1; i < wheelColors.length; i++) {
    const distance = colorDistance(ingredientColor, wheelColors[i]);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = wheelColors[i];
    }
  }

  return closestColor;
}

/**
 * Gets the top N closest wheel colors to an ingredient color, sorted by distance
 */
function getClosestWheelColors(ingredientColor: string, wheelColors: string[], count: number): string[] {
  const distances = wheelColors.map((color) => ({
    color,
    distance: colorDistance(ingredientColor, color),
  }));
  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, count).map((d) => d.color);
}

/**
 * Assigns wheel colors to a list of ingredients, avoiding similar colors on adjacent slices.
 * The wheel is circular, so the last slice is adjacent to the first.
 * Returns an array of wheel colors in the same order as the input ingredients.
 */
/**
 * Reorders items to maximize color contrast between adjacent items.
 * The wheel is circular, so the last item is adjacent to the first.
 * Returns the reordered indices.
 */
export function reorderForColorContrast(colors: string[]): number[] {
  if (colors.length <= 2) {
    return colors.map((_, i) => i);
  }

  const n = colors.length;
  const used = new Set<number>();
  const order: number[] = [];

  // Start with the first item
  order.push(0);
  used.add(0);

  // Greedy: for each position, pick the unused item most different from the previous
  while (order.length < n) {
    const lastColor = colors[order[order.length - 1]];
    let bestIdx = 0;
    let bestDistance = -1;

    for (let i = 0; i < n; i++) {
      if (used.has(i)) continue;
      const dist = colorDistance(lastColor, colors[i]);
      if (dist > bestDistance) {
        bestDistance = dist;
        bestIdx = i;
      }
    }

    order.push(bestIdx);
    used.add(bestIdx);
  }

  // Check if last and first are too similar, try to improve by swapping
  const SIMILARITY_THRESHOLD = 100;
  const lastToFirstDist = colorDistance(colors[order[order.length - 1]], colors[order[0]]);

  if (lastToFirstDist < SIMILARITY_THRESHOLD && n > 3) {
    // Try swapping the last item with middle items to find a better arrangement
    for (let i = 1; i < order.length - 1; i++) {
      const candidate = order[i];
      const distToFirst = colorDistance(colors[candidate], colors[order[0]]);
      const distToNewPrev = colorDistance(colors[order[order.length - 1]], colors[order[i - 1]]);
      const distToNewNext = colorDistance(colors[order[order.length - 1]], colors[order[i + 1]]);

      if (distToFirst > lastToFirstDist && distToNewPrev > SIMILARITY_THRESHOLD && distToNewNext > SIMILARITY_THRESHOLD) {
        // Swap
        const temp = order[order.length - 1];
        order[order.length - 1] = order[i];
        order[i] = temp;
        break;
      }
    }
  }

  return order;
}

export function assignWheelColorsWithContrast(
  ingredientColors: string[],
  wheelColors: string[]
): string[] {
  if (ingredientColors.length === 0) return [];
  if (wheelColors.length === 0) return ingredientColors;
  if (ingredientColors.length === 1) {
    return [getVibrantWheelColor(ingredientColors[0], wheelColors)];
  }

  // Threshold for considering colors "too similar" (lower = stricter)
  const SIMILARITY_THRESHOLD = 150;

  // Get top 3 preferred colors for each ingredient
  const preferences = ingredientColors.map((color) =>
    getClosestWheelColors(color, wheelColors, Math.min(3, wheelColors.length))
  );

  const assignedColors: string[] = [];

  for (let i = 0; i < ingredientColors.length; i++) {
    const prefs = preferences[i];
    const prevColor = i > 0 ? assignedColors[i - 1] : null;

    // For the last ingredient, also consider the first (wheel is circular)
    const nextColor = i === ingredientColors.length - 1 && assignedColors.length > 0
      ? assignedColors[0]
      : null;

    // Find the best color from preferences that's different enough from neighbors
    let bestColor = prefs[0];
    for (const pref of prefs) {
      const distToPrev = prevColor ? colorDistance(pref, prevColor) : Infinity;
      const distToNext = nextColor ? colorDistance(pref, nextColor) : Infinity;

      if (distToPrev > SIMILARITY_THRESHOLD && distToNext > SIMILARITY_THRESHOLD) {
        bestColor = pref;
        break;
      }
      // If first preference is too similar, try next preferences
      if (pref === prefs[0] && (distToPrev <= SIMILARITY_THRESHOLD || distToNext <= SIMILARITY_THRESHOLD)) {
        continue;
      }
    }

    assignedColors.push(bestColor);
  }

  // Second pass: fix any remaining adjacent duplicates by swapping with non-adjacent slots
  for (let iterations = 0; iterations < 3; iterations++) {
    let changed = false;
    for (let i = 0; i < assignedColors.length; i++) {
      const prevIdx = (i - 1 + assignedColors.length) % assignedColors.length;
      const nextIdx = (i + 1) % assignedColors.length;

      // Check if current color is same as either neighbor
      if (assignedColors[i] === assignedColors[prevIdx] || assignedColors[i] === assignedColors[nextIdx]) {
        // Try to find a different color from preferences
        const prefs = preferences[i];
        for (const pref of prefs) {
          if (pref !== assignedColors[prevIdx] && pref !== assignedColors[nextIdx]) {
            assignedColors[i] = pref;
            changed = true;
            break;
          }
        }
      }
    }
    if (!changed) break;
  }

  return assignedColors;
}
