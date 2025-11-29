import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PracticeHelperDrawerProps {
  defaultOpen?: boolean;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export const PracticeHelperDrawer = ({
  defaultOpen = false,
  title = "Practice helpers",
  subtitle = "Voice preview & notes autosave locally every few seconds.",
  children,
  className,
}: PracticeHelperDrawerProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "practice-helper-drawer rounded-2xl border bg-muted/20 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-xs"
            aria-expanded={isOpen}
          >
            {isOpen ? "Hide helpers" : "Show helpers"}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border-t p-4">{children}</CollapsibleContent>
    </Collapsible>
  );
};

