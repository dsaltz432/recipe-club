import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, ShoppingCart, UtensilsCrossed, ChefHat } from "lucide-react";

interface RecipeDetailTabsProps {
  recipesContent: React.ReactNode;
  groceryContent: React.ReactNode;
  pantryContent: React.ReactNode;
  onCookClick?: () => void;
  showCookTab?: boolean;
}

export function RecipeDetailTabs({ recipesContent, groceryContent, pantryContent, onCookClick, showCookTab }: RecipeDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("recipes");

  const handleTabChange = (value: string) => {
    if (value === "cook") {
      onCookClick?.();
      return;
    }
    setActiveTab(value);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className={`grid w-full max-w-lg mb-4 h-auto rounded-lg ${showCookTab ? "grid-cols-4" : "grid-cols-3"}`}>
        <TabsTrigger value="recipes" className="flex items-center gap-1.5 rounded-md py-2.5 sm:py-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="text-xs sm:text-sm">Recipes</span>
        </TabsTrigger>
        <TabsTrigger value="grocery" className="flex items-center gap-1.5 rounded-md py-2.5 sm:py-1.5">
          <ShoppingCart className="h-3.5 w-3.5" />
          <span className="text-xs sm:text-sm">Groceries</span>
        </TabsTrigger>
        <TabsTrigger value="pantry" className="flex items-center gap-1.5 rounded-md py-2.5 sm:py-1.5">
          <UtensilsCrossed className="h-3.5 w-3.5" />
          <span className="text-xs sm:text-sm">Pantry</span>
        </TabsTrigger>
        {showCookTab && (
          <TabsTrigger value="cook" className="flex items-center gap-1.5 rounded-md py-2.5 sm:py-1.5">
            <ChefHat className="h-3.5 w-3.5" />
            <span className="text-xs sm:text-sm">Cook</span>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="recipes">
        {recipesContent}
      </TabsContent>

      <TabsContent value="grocery">
        {groceryContent}
      </TabsContent>

      <TabsContent value="pantry">
        {pantryContent}
      </TabsContent>
    </Tabs>
  );
}
