import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ExternalLink, Share2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SharedRecipe {
  id: string;
  recipeId: string;
  recipeName: string;
  recipeUrl?: string;
  sharedByName?: string;
  message?: string;
  viewedAt?: string;
  sharedAt: string;
}

interface SharedWithMeSectionProps {
  userEmail: string;
}

const SharedWithMeSection = ({ userEmail }: SharedWithMeSectionProps) => {
  const [shares, setShares] = useState<SharedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadShares = async () => {
    try {
      const { data, error } = await supabase
        .from("recipe_shares")
        .select(`
          id,
          recipe_id,
          message,
          viewed_at,
          shared_at,
          recipes (name, url),
          profiles:shared_by (name)
        `)
        .eq("shared_with_email", userEmail.toLowerCase())
        .order("shared_at", { ascending: false });

      if (error) throw error;

      const mapped: SharedRecipe[] = (data || []).map((s) => {
        const recipe = s.recipes as unknown as { name: string; url: string | null } | null;
        const profile = s.profiles as unknown as { name: string | null } | null;
        return {
          id: s.id,
          recipeId: s.recipe_id,
          recipeName: recipe?.name || "Unknown Recipe",
          recipeUrl: recipe?.url || undefined,
          sharedByName: profile?.name || undefined,
          message: s.message || undefined,
          viewedAt: s.viewed_at || undefined,
          sharedAt: s.shared_at,
        };
      });

      setShares(mapped);
    } catch (error) {
      console.error("Error loading shared recipes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsViewed = async (shareId: string) => {
    await supabase
      .from("recipe_shares")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", shareId);

    setShares((prev) =>
      prev.map((s) =>
        s.id === shareId ? { ...s, viewedAt: new Date().toISOString() } : s
      )
    );
  };

  useEffect(() => {
    loadShares();
  }, [userEmail]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Share2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No recipes have been shared with you yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {shares.map((share) => (
        <Card key={share.id} className="bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 mb-3">
              {share.sharedByName && (
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-purple/10 text-purple">
                    {share.sharedByName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-semibold truncate">
                  {share.recipeName}
                </h3>
                {share.sharedByName && (
                  <span className="text-xs text-muted-foreground">
                    Shared by {share.sharedByName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-blue-400 text-blue-600 bg-blue-50">
                Shared
              </Badge>
              {!share.viewedAt && (
                <Badge className="bg-purple text-white">New</Badge>
              )}
            </div>

            {share.message && (
              <p className="text-sm text-muted-foreground italic mb-3">
                &quot;{share.message}&quot;
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <span>
                {new Date(share.sharedAt).toLocaleDateString()}
              </span>
            </div>

            <div className="flex gap-2">
              {share.recipeUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  onClick={() => {
                    if (!share.viewedAt) markAsViewed(share.id);
                  }}
                >
                  <a
                    href={share.recipeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Recipe
                  </a>
                </Button>
              )}
              {!share.recipeUrl && !share.viewedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAsViewed(share.id)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Mark as Viewed
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SharedWithMeSection;
