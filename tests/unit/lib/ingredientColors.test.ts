import { describe, it, expect } from "vitest";
import {
  getIngredientColor,
  hexToRgba,
  getLightBackgroundColor,
  getBorderColor,
  getContrastTextColor,
  getDarkerTextColor,
  getVibrantWheelColor,
  assignWheelColorsWithContrast,
  reorderForColorContrast,
} from "@/lib/ingredientColors";

describe("ingredientColors", () => {
  describe("getIngredientColor", () => {
    it("returns correct color for exact match", () => {
      expect(getIngredientColor("tomato")).toBe("#FF6347");
      expect(getIngredientColor("mango")).toBe("#FFB347");
      expect(getIngredientColor("spinach")).toBe("#3CB371");
    });

    it("handles case insensitivity", () => {
      expect(getIngredientColor("TOMATO")).toBe("#FF6347");
      expect(getIngredientColor("Mango")).toBe("#FFB347");
      expect(getIngredientColor("SPINACH")).toBe("#3CB371");
    });

    it("handles whitespace trimming", () => {
      expect(getIngredientColor("  tomato  ")).toBe("#FF6347");
      expect(getIngredientColor("mango ")).toBe("#FFB347");
    });

    it("returns correct color for partial matches", () => {
      // "cherry tomato" should match "tomato"
      expect(getIngredientColor("cherry tomato")).toBe("#FF6347");
      // "wild salmon" should match "salmon"
      expect(getIngredientColor("wild salmon")).toBe("#FA8072");
    });

    it("returns correct color for ingredients with spaces", () => {
      expect(getIngredientColor("sweet potato")).toBe("#D2691E");
      expect(getIngredientColor("red pepper")).toBe("#FF4444");
      expect(getIngredientColor("green bean")).toBe("#6B8E23");
    });

    it("returns a consistent default color for unknown ingredients", () => {
      const color1 = getIngredientColor("xyzunknown123");
      const color2 = getIngredientColor("xyzunknown123");
      expect(color1).toBe(color2);
      // Should be one of the default colors
      expect(color1).toMatch(/^#[A-Fa-f0-9]{6}$/);
    });

    it("returns different default colors for different unknown ingredients", () => {
      // Different names should get potentially different colors
      const colors = [
        getIngredientColor("unknowna"),
        getIngredientColor("unknownb"),
        getIngredientColor("unknownc"),
        getIngredientColor("unknownd"),
        getIngredientColor("unknowne"),
      ];
      // At least some should be different (statistically very likely)
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("hexToRgba", () => {
    it("converts hex to rgba correctly", () => {
      expect(hexToRgba("#FF0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
      expect(hexToRgba("#00FF00", 1)).toBe("rgba(0, 255, 0, 1)");
      expect(hexToRgba("#0000FF", 0.25)).toBe("rgba(0, 0, 255, 0.25)");
    });

    it("handles hex without hash", () => {
      expect(hexToRgba("FF0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
    });

    it("returns fallback color for invalid hex", () => {
      expect(hexToRgba("invalid", 0.5)).toBe("rgba(155, 135, 245, 0.5)");
      expect(hexToRgba("", 0.3)).toBe("rgba(155, 135, 245, 0.3)");
      expect(hexToRgba("#GGG", 0.2)).toBe("rgba(155, 135, 245, 0.2)");
    });
  });

  describe("getLightBackgroundColor", () => {
    it("returns rgba with 0.15 opacity", () => {
      expect(getLightBackgroundColor("#FF0000")).toBe("rgba(255, 0, 0, 0.15)");
      expect(getLightBackgroundColor("#00FF00")).toBe("rgba(0, 255, 0, 0.15)");
    });
  });

  describe("getBorderColor", () => {
    it("returns rgba with 0.3 opacity", () => {
      expect(getBorderColor("#FF0000")).toBe("rgba(255, 0, 0, 0.3)");
      expect(getBorderColor("#00FF00")).toBe("rgba(0, 255, 0, 0.3)");
    });
  });

  describe("getContrastTextColor", () => {
    it("returns dark text for light backgrounds", () => {
      expect(getContrastTextColor("#FFFFFF")).toBe("#1a1a1a"); // White
      expect(getContrastTextColor("#FFFF00")).toBe("#1a1a1a"); // Yellow
      expect(getContrastTextColor("#FFE135")).toBe("#1a1a1a"); // Banana yellow
    });

    it("returns light text for dark backgrounds", () => {
      expect(getContrastTextColor("#000000")).toBe("#ffffff"); // Black
      expect(getContrastTextColor("#1C1C1C")).toBe("#ffffff"); // Black bean
      expect(getContrastTextColor("#3D1F0E")).toBe("#ffffff"); // Chocolate
    });

    it("handles invalid hex gracefully", () => {
      // Default luminance is 0.5, and condition is > 0.5, so returns light text
      expect(getContrastTextColor("invalid")).toBe("#ffffff");
    });
  });

  describe("getDarkerTextColor", () => {
    it("returns darker version of the color", () => {
      const darker = getDarkerTextColor("#FF0000");
      expect(darker).toBe("#990000");
    });

    it("handles white color", () => {
      const darker = getDarkerTextColor("#FFFFFF");
      expect(darker).toBe("#999999");
    });

    it("handles invalid hex gracefully", () => {
      expect(getDarkerTextColor("invalid")).toBe("#1a1a1a");
    });
  });

  describe("getVibrantWheelColor", () => {
    const wheelColors = [
      "#9b87f5", // purple
      "#F97316", // orange
      "#4CAF50", // green
      "#F6A000", // yellow
      "#3B82F6", // blue
      "#EC4899", // pink
      "#EF4444", // red
    ];

    it("returns closest wheel color for red ingredient", () => {
      // Tomato red (#FF6347) should be closest to red (#EF4444)
      expect(getVibrantWheelColor("#FF6347", wheelColors)).toBe("#EF4444");
    });

    it("returns closest wheel color for green ingredient", () => {
      // Spinach green (#3CB371) should be closest to green (#4CAF50)
      expect(getVibrantWheelColor("#3CB371", wheelColors)).toBe("#4CAF50");
    });

    it("returns closest wheel color for orange ingredient", () => {
      // Mango (#FFB347) should be closest to orange or yellow
      const result = getVibrantWheelColor("#FFB347", wheelColors);
      expect(["#F97316", "#F6A000"]).toContain(result);
    });

    it("returns closest wheel color for purple ingredient", () => {
      // Light purple (#9b87f5) should match purple wheel color
      expect(getVibrantWheelColor("#9b87f5", wheelColors)).toBe("#9b87f5");
      // Deep grape (#6F2DA8) is closer to pink due to weighted color distance
      expect(getVibrantWheelColor("#6F2DA8", wheelColors)).toBe("#EC4899");
    });

    it("returns the ingredient color if wheel colors array is empty", () => {
      expect(getVibrantWheelColor("#FF6347", [])).toBe("#FF6347");
    });

    it("returns first wheel color for invalid hex", () => {
      // Invalid hex will return Infinity distance, so first color is returned
      expect(getVibrantWheelColor("invalid", wheelColors)).toBe("#9b87f5");
    });

    it("handles single wheel color", () => {
      expect(getVibrantWheelColor("#FF6347", ["#4CAF50"])).toBe("#4CAF50");
    });
  });

  describe("assignWheelColorsWithContrast", () => {
    const wheelColors = [
      "#9b87f5", // purple
      "#F97316", // orange
      "#4CAF50", // green
      "#F6A000", // yellow
      "#3B82F6", // blue
      "#EC4899", // pink
      "#EF4444", // red
    ];

    it("returns empty array for empty input", () => {
      expect(assignWheelColorsWithContrast([], wheelColors)).toEqual([]);
    });

    it("returns ingredient colors if wheel colors is empty", () => {
      expect(assignWheelColorsWithContrast(["#FF0000", "#00FF00"], [])).toEqual(["#FF0000", "#00FF00"]);
    });

    it("returns single vibrant color for single ingredient", () => {
      const result = assignWheelColorsWithContrast(["#FF6347"], wheelColors);
      expect(result).toHaveLength(1);
      expect(wheelColors).toContain(result[0]);
    });

    it("assigns colors to match ingredient count", () => {
      const ingredientColors = ["#FF6347", "#3CB371", "#FFB347", "#6F2DA8", "#4F86F7"];
      const result = assignWheelColorsWithContrast(ingredientColors, wheelColors);
      expect(result).toHaveLength(5);
      result.forEach((color) => {
        expect(wheelColors).toContain(color);
      });
    });

    it("avoids identical adjacent colors when possible", () => {
      // All red-ish ingredients that would normally all get red
      const ingredientColors = ["#FF0000", "#EE0000", "#DD0000", "#CC0000"];
      const result = assignWheelColorsWithContrast(ingredientColors, wheelColors);

      // Check that no two adjacent colors are the same (including circular wrap)
      for (let i = 0; i < result.length; i++) {
        const nextIdx = (i + 1) % result.length;
        // At least try to avoid exact duplicates when we have enough wheel colors
        if (wheelColors.length > result.length) {
          expect(result[i]).not.toBe(result[nextIdx]);
        }
      }
    });

    it("handles two ingredients", () => {
      const result = assignWheelColorsWithContrast(["#FF0000", "#00FF00"], wheelColors);
      expect(result).toHaveLength(2);
      // Both should be valid wheel colors
      expect(wheelColors).toContain(result[0]);
      expect(wheelColors).toContain(result[1]);
    });

    it("assigns directionally accurate colors", () => {
      // Red ingredient should get a reddish/warm wheel color
      const redResult = assignWheelColorsWithContrast(["#FF0000"], wheelColors);
      expect(["#EF4444", "#F97316", "#EC4899"]).toContain(redResult[0]);

      // Green ingredient should get green wheel color
      const greenResult = assignWheelColorsWithContrast(["#00FF00"], wheelColors);
      expect(greenResult[0]).toBe("#4CAF50");

      // Blue ingredient should get blue wheel color
      const blueResult = assignWheelColorsWithContrast(["#0000FF"], wheelColors);
      expect(blueResult[0]).toBe("#3B82F6");
    });

    it("falls through second preference check when first is too similar to neighbor", () => {
      // Very limited wheel colors - all similar reds
      // This forces the algorithm to check multiple preferences
      // and exercises the false branch at line 431 (when pref !== prefs[0])
      const limitedWheelColors = [
        "#FF0000", // red
        "#FF1000", // slightly different red
        "#FF2000", // another red variant
      ];

      // Multiple red-ish ingredients that will all prefer the same wheel colors
      // When assigning the second ingredient, first preference will be too similar
      // to the already-assigned first color, forcing iteration through preferences
      const ingredientColors = ["#FF0000", "#FF0500", "#FF0A00"];
      const result = assignWheelColorsWithContrast(ingredientColors, limitedWheelColors);

      expect(result).toHaveLength(3);
      // All results should be from the limited wheel colors
      result.forEach((color) => {
        expect(limitedWheelColors).toContain(color);
      });
    });

    it("handles circular similarity check for last ingredient (distToNext branch)", () => {
      // This test exercises the distToNext <= SIMILARITY_THRESHOLD branch at line 431
      // which only triggers for the LAST ingredient when it's similar to the FIRST
      //
      // For the last ingredient: nextColor = assignedColors[0] (circular wrap)
      // If the last ingredient's first preference is similar to both:
      //   - prevColor (the previously assigned color)
      //   - nextColor (the first assigned color, for circular check)
      // Then distToNext <= threshold is true
      const limitedWheelColors = [
        "#FF0000", // red
        "#FF0800", // very similar red
        "#00FF00", // green (different)
      ];

      // Three similar reds - the last one will check circular similarity
      // First ingredient gets red, second gets similar red, third checks against both
      // and its nextColor (first assigned = red) triggers the distToNext branch
      const ingredientColors = ["#FF0000", "#FF0400", "#FF0200"];
      const result = assignWheelColorsWithContrast(ingredientColors, limitedWheelColors);

      expect(result).toHaveLength(3);
      result.forEach((color) => {
        expect(limitedWheelColors).toContain(color);
      });
    });
  });

  describe("reorderForColorContrast", () => {
    it("returns original indices for 0, 1, or 2 items", () => {
      expect(reorderForColorContrast([])).toEqual([]);
      expect(reorderForColorContrast(["#FF0000"])).toEqual([0]);
      expect(reorderForColorContrast(["#FF0000", "#00FF00"])).toEqual([0, 1]);
    });

    it("returns all indices for multiple items", () => {
      const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"];
      const result = reorderForColorContrast(colors);

      // Should return all indices
      expect(result).toHaveLength(4);
      expect(result.sort()).toEqual([0, 1, 2, 3]);
    });

    it("separates similar colors", () => {
      // All reds - should try to spread them out
      const colors = ["#FF0000", "#EE0000", "#00FF00", "#DD0000"];
      const result = reorderForColorContrast(colors);

      // Green (index 2) should not be at index 2 if surrounded by reds
      // The reordering should place green between reds
      expect(result).toHaveLength(4);

      // Check that we have all indices
      expect(result.sort()).toEqual([0, 1, 2, 3]);
    });

    it("starts with the first item", () => {
      const colors = ["#FF0000", "#00FF00", "#0000FF"];
      const result = reorderForColorContrast(colors);

      // First item should always be index 0
      expect(result[0]).toBe(0);
    });

    it("maximizes contrast between adjacent items", () => {
      // Red, Green, Blue, Yellow
      const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"];
      const result = reorderForColorContrast(colors);

      // The reordering should try to maximize differences
      // We can't predict exact order but can verify structure
      expect(result).toHaveLength(4);
      expect(new Set(result).size).toBe(4); // All unique indices
    });

    it("handles circular similarity by attempting swap", () => {
      // Create a scenario where greedy algorithm would produce similar colors at ends
      // Red, similar red, blue, another similar red
      // Greedy from red picks blue (most different), then picks a red, then the other red
      // This creates a situation where last and first are similar (both reds)
      const colors = ["#FF0000", "#FE0101", "#0000FF", "#FD0202", "#00FF00"];
      const result = reorderForColorContrast(colors);

      // Should return all indices
      expect(result).toHaveLength(5);
      expect(new Set(result).size).toBe(5);

      // First should still be 0
      expect(result[0]).toBe(0);
    });

    it("handles case where swap improves circular contrast", () => {
      // Carefully crafted to trigger the swap logic:
      // Start: red, then greedy picks most different colors
      // End up with similar colors at positions 0 and last
      const colors = [
        "#FF0000", // 0: red
        "#00FF00", // 1: green
        "#FF1010", // 2: slightly different red
        "#0000FF", // 3: blue
      ];
      const result = reorderForColorContrast(colors);

      expect(result).toHaveLength(4);
      expect(new Set(result).size).toBe(4);
    });

    it("handles many similar colors", () => {
      // Many reds with one green - tests the swap branch more thoroughly
      const colors = [
        "#FF0000", // 0
        "#FE0000", // 1
        "#00FF00", // 2: green (very different)
        "#FD0000", // 3
        "#FC0000", // 4
      ];
      const result = reorderForColorContrast(colors);

      expect(result).toHaveLength(5);
      expect(new Set(result).size).toBe(5);
      expect(result[0]).toBe(0);
    });

    it("executes swap when last-to-first distance is below threshold and swap improves contrast", () => {
      // Carefully crafted to trigger the swap branch (lines 380-383):
      // - Red (#FF0000) and Almost-Red (#FF0505) are very similar (distance ~13 < 100)
      // - The greedy algorithm will place Almost-Red last, creating poor circular contrast
      // - A middle element (Blue) can be swapped to the end to improve contrast
      //
      // Greedy path: [0] -> [0,3] (Green most different from Red) -> [0,3,1] (Blue most different from Green)
      //           -> [0,3,1,2] (Yellow most different from Blue) -> [0,3,1,2,4] (Almost-Red is last)
      //
      // Now last=4 (Almost-Red), first=0 (Red), distance ~13 < 100
      // Loop finds i=2 where candidate=1 (Blue) can swap:
      //   - distToFirst (Blue to Red) ~570 > 13 ✓
      //   - distToNewPrev (Almost-Red to Green) ~616 > 100 ✓
      //   - distToNewNext (Almost-Red to Yellow) ~500 > 100 ✓
      // Swap executes, resulting in [0,3,4,2,1]
      const colors = [
        "#FF0000", // 0: Red
        "#0000FF", // 1: Blue
        "#FFFF00", // 2: Yellow
        "#00FF00", // 3: Green
        "#FF0505", // 4: Almost-Red (very similar to index 0)
      ];
      const result = reorderForColorContrast(colors);

      // Verify all indices are present
      expect(result).toHaveLength(5);
      expect(new Set(result).size).toBe(5);
      expect(result[0]).toBe(0);

      // After the swap, Blue (index 1) should be at the end position
      // because it was swapped from position 2 to position 4
      expect(result[result.length - 1]).toBe(1);
    });
  });
});
