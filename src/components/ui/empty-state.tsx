import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => {
  return (
    <Card className={cn("bg-white/80 backdrop-blur-sm border-purple/10", className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-purple/10 flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-purple-500" />
        </div>
        <p className="font-semibold text-gray-800 mb-1">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">{description}</p>
        )}
        {action && (
          <Button
            size="sm"
            className="bg-purple hover:bg-purple-dark text-white"
            onClick={action.onClick}
          >
            {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default EmptyState;
