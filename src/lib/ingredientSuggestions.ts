// Curated list of ~200 kosher-friendly ingredients organized by category
// Used for suggesting ingredient ideas

export const INGREDIENT_SUGGESTIONS = {
  vegetables: [
    "Artichoke",
    "Butternut Squash",
    "Eggplant",
    "Fennel",
    "Leeks",
    "Brussels Sprouts",
    "Beets",
    "Zucchini",
    "Cauliflower",
    "Sweet Potato",
    "Portobello Mushrooms",
    "Bell Peppers",
    "Asparagus",
    "Cabbage",
    "Carrots",
    "Celery Root",
    "Delicata Squash",
    "Kale",
    "Spinach",
    "Broccoli",
    "Acorn Squash",
    "Bok Choy",
    "Swiss Chard",
    "Radishes",
    "Turnips",
    "Parsnips",
    "Shallots",
    "Snap Peas",
    "Green Beans",
    "Corn",
    "Cucumber",
    "Tomatoes",
    "Shiitake Mushrooms",
    "Oyster Mushrooms",
    "Radicchio",
    "Endive",
    "Arugula",
    "Watercress",
    "Romanesco",
    "Spaghetti Squash",
  ],
  fruits: [
    "Pomegranate",
    "Figs",
    "Dates",
    "Meyer Lemon",
    "Blood Orange",
    "Mango",
    "Pineapple",
    "Apple",
    "Pear",
    "Peach",
    "Plum",
    "Cherries",
    "Apricot",
    "Persimmon",
    "Grapefruit",
    "Cranberries",
    "Blackberries",
    "Raspberries",
    "Blueberries",
    "Strawberries",
    "Coconut",
    "Passion Fruit",
    "Papaya",
    "Grapes",
    "Watermelon",
  ],
  proteins: [
    "Salmon",
    "Chicken Thighs",
    "Ground Beef",
    "Lamb",
    "Turkey",
    "Duck",
    "Eggs",
    "Tilapia",
    "Cod",
    "Trout",
    "Halibut",
    "Tuna",
    "Sardines",
    "Chicken Breast",
    "Brisket",
    "Lamb Shoulder",
    "Ground Turkey",
    "Chicken Wings",
    "Sea Bass",
    "Mackerel",
    "Snapper",
    "Sole",
    "Flank Steak",
    "Short Ribs",
    "Veal",
    "Cornish Hen",
    "Goose",
    "Lamb Chops",
    "Skirt Steak",
  ],
  dairy: [
    "Feta Cheese",
    "Goat Cheese",
    "Ricotta",
    "Cream Cheese",
    "Greek Yogurt",
    "Parmesan",
    "Mozzarella",
    "Labneh",
    "Brie",
    "Gruyère",
    "Halloumi",
    "Mascarpone",
    "Cottage Cheese",
    "Sour Cream",
    "Burrata",
  ],
  grains: [
    "Quinoa",
    "Farro",
    "Couscous",
    "Polenta",
    "Rice Noodles",
    "Buckwheat",
    "Barley",
    "Bulgur",
    "Orzo",
    "Wild Rice",
    "Arborio Rice",
    "Soba Noodles",
    "Udon Noodles",
    "Jasmine Rice",
    "Basmati Rice",
    "Freekeh",
    "Millet",
    "Oats",
    "Cornmeal",
    "Pita Bread",
    "Challah",
    "Gnocchi",
    "Egg Noodles",
    "Pearl Couscous",
  ],
  legumes: [
    "Chickpeas",
    "Lentils",
    "Black Beans",
    "Cannellini Beans",
    "Edamame",
    "Split Peas",
    "Hummus",
    "Fava Beans",
    "Red Lentils",
    "Black-Eyed Peas",
    "Kidney Beans",
    "Navy Beans",
    "Pinto Beans",
    "Mung Beans",
    "Lima Beans",
  ],
  nutsAndSeeds: [
    "Tahini",
    "Pine Nuts",
    "Pistachios",
    "Walnuts",
    "Almonds",
    "Sesame Seeds",
    "Pumpkin Seeds",
    "Cashews",
    "Hazelnuts",
    "Pecans",
    "Macadamia Nuts",
    "Sunflower Seeds",
    "Chia Seeds",
    "Flax Seeds",
    "Poppy Seeds",
  ],
  herbs: [
    "Dill",
    "Mint",
    "Basil",
    "Cilantro",
    "Ginger",
    "Lemongrass",
    "Turmeric",
    "Saffron",
    "Rosemary",
    "Thyme",
    "Oregano",
    "Parsley",
    "Chives",
    "Tarragon",
    "Sage",
    "Bay Leaves",
    "Cardamom",
    "Cinnamon",
    "Cumin",
    "Coriander",
  ],
  pantry: [
    "Honey",
    "Miso Paste",
    "Preserved Lemons",
    "Capers",
    "Sun-dried Tomatoes",
    "Olives",
    "Artichoke Hearts",
    "Roasted Red Peppers",
    "Maple Syrup",
    "Pomegranate Molasses",
    "Tamarind",
    "Sumac",
    "Za'atar",
    "Chutney",
    "Dijon Mustard",
  ],
};

export type IngredientCategory = keyof typeof INGREDIENT_SUGGESTIONS;

const CATEGORIES: IngredientCategory[] = [
  "vegetables",
  "fruits",
  "proteins",
  "dairy",
  "grains",
  "legumes",
  "nutsAndSeeds",
  "herbs",
  "pantry",
];

/**
 * Get 4 random ingredient suggestions from different categories,
 * excluding any ingredients that already exist in the bank
 */
export function getSuggestedIngredients(existingIngredients: string[]): string[] {
  const existingLower = new Set(existingIngredients.map((i) => i.toLowerCase()));
  const suggestions: string[] = [];

  // Shuffle categories to get variety
  const shuffledCategories = [...CATEGORIES].sort(() => Math.random() - 0.5);

  // Try to get one ingredient from each category until we have 4
  for (const category of shuffledCategories) {
    if (suggestions.length >= 4) break;

    const categoryIngredients = INGREDIENT_SUGGESTIONS[category].filter(
      (ingredient) => !existingLower.has(ingredient.toLowerCase())
    );

    if (categoryIngredients.length > 0) {
      const randomIndex = Math.floor(Math.random() * categoryIngredients.length);
      suggestions.push(categoryIngredients[randomIndex]);
    }
  }

  // If we still need more (all categories exhausted), get from any category
  if (suggestions.length < 4) {
    const allIngredients = Object.values(INGREDIENT_SUGGESTIONS)
      .flat()
      .filter(
        (ingredient) =>
          !existingLower.has(ingredient.toLowerCase()) &&
          !suggestions.includes(ingredient)
      );

    while (suggestions.length < 4 && allIngredients.length > 0) {
      const randomIndex = Math.floor(Math.random() * allIngredients.length);
      suggestions.push(allIngredients[randomIndex]);
      allIngredients.splice(randomIndex, 1);
    }
  }

  return suggestions;
}
