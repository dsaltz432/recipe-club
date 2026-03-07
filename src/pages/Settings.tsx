import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, getAllowedUser, isAdmin } from "@/lib/auth";
import { loadUserPreferences, saveUserPreferences } from "@/lib/userPreferences";
import type { User, UserPreferences } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

const MEAL_TYPE_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
] as const;

const AI_MODEL_OPTIONS = [
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — fastest" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6 — balanced, recommended" },
  { value: "claude-opus-4-6", label: "Opus 4.6 — most intelligent" },
] as const;

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    mealTypes: ["breakfast", "lunch", "dinner"],
    weekStartDay: 0,
    householdSize: 2,
    aiModelParse: "claude-sonnet-4-6",
    aiModelCombine: "claude-sonnet-4-6",
  });

  useEffect(() => {
    const loadData = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser?.id) {
        const prefs = await loadUserPreferences(currentUser.id);
        setPreferences(prefs);
      }

      if (currentUser?.email) {
        const allowed = await getAllowedUser(currentUser.email);
        setUserIsAdmin(isAdmin(allowed));
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  const handleMealTypeToggle = (mealType: string, enabled: boolean) => {
    if (!enabled && preferences.mealTypes.length <= 1) {
      toast("You must keep at least one meal type selected");
      return;
    }

    const newMealTypes = enabled
      ? [...preferences.mealTypes, mealType]
      : preferences.mealTypes.filter((t) => t !== mealType);

    setPreferences((prev) => ({ ...prev, mealTypes: newMealTypes }));
  };

  const handleWeekStartDayChange = (value: string) => {
    setPreferences((prev) => ({ ...prev, weekStartDay: Number(value) }));
  };

  const handleHouseholdSizeChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = Math.max(1, parseInt(e.target.value) || 1);
    setPreferences((prev) => ({ ...prev, householdSize: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      await saveUserPreferences(user.id, preferences);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-light/30 via-white to-orange-light/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
          <h1 className="font-display text-lg sm:text-2xl font-bold text-gray-900 truncate">
            Settings
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Meal Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Meal Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose which meal types appear in your meal plan grid.
              </p>
              {MEAL_TYPE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center justify-between"
                >
                  <Label htmlFor={`meal-${option.value}`}>
                    {option.label}
                  </Label>
                  <Switch
                    id={`meal-${option.value}`}
                    checked={preferences.mealTypes.includes(option.value)}
                    onCheckedChange={(checked) =>
                      handleMealTypeToggle(option.value, checked)
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Separator />

          {/* Week Start Day */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Week Start Day</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose which day your meal plan week starts on.
              </p>
              <Select
                value={String(preferences.weekStartDay)}
                onValueChange={handleWeekStartDayChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Separator />

          {/* Household Size */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Household Size</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Number of people in your household for meal planning.
              </p>
              <Input
                type="number"
                min={1}
                value={preferences.householdSize}
                onChange={handleHouseholdSizeChange}
                className="w-32"
              />
            </CardContent>
          </Card>

          {/* AI Models — admin only */}
          {userIsAdmin && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Models</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose which AI model powers each feature. Faster models are cheaper but may be less accurate.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="ai-model-parse" className="text-sm">Recipe Parsing</Label>
                      <Select
                        value={preferences.aiModelParse}
                        onValueChange={(value) =>
                          setPreferences((prev) => ({ ...prev, aiModelParse: value }))
                        }
                      >
                        <SelectTrigger id="ai-model-parse" className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_MODEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="ai-model-combine" className="text-sm">Grocery Processing</Label>
                      <Select
                        value={preferences.aiModelCombine}
                        onValueChange={(value) =>
                          setPreferences((prev) => ({ ...prev, aiModelCombine: value }))
                        }
                      >
                        <SelectTrigger id="ai-model-combine" className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_MODEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-purple hover:bg-purple/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
