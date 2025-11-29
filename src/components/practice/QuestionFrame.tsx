import { forwardRef } from "react";
import { Card, type CardProps } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const QuestionFrame = forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(
        "question-frame relative overflow-hidden pb-24 md:pb-32 transition-transform duration-200",
        className
      )}
      {...props}
    >
      {children}
    </Card>
  )
);

QuestionFrame.displayName = "QuestionFrame";

