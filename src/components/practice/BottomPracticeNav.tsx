import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BottomPracticeNavProps {
  currentIndex: number;
  totalQuestions: number;
  answeredMap: Record<string, boolean>;
  questionOrder: { id: string; stage?: string }[];
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
}

export const BottomPracticeNav = ({
  currentIndex,
  totalQuestions,
  answeredMap,
  questionOrder,
  onPrev,
  onNext,
  onJump,
}: BottomPracticeNavProps) => (
  <div
    className="bottom-practice-nav sticky bottom-0 z-40 mt-6 flex w-full max-w-2xl items-center justify-between rounded-3xl border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4 md:rounded-full md:p-2"
    style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
  >
    <Button
      variant="outline"
      onClick={onPrev}
      disabled={currentIndex === 0}
      className="h-11 w-11 rounded-full p-0"
      aria-label="Previous question"
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>

    <div className="flex max-w-[280px] flex-1 items-center justify-center overflow-x-auto px-2">
      <div className="flex items-center gap-2">
        {questionOrder.map((question, index) => {
          const answered = answeredMap[question.id];
          return (
            <button
              key={question.id}
              onClick={() => onJump(index)}
              type="button"
              aria-current={index === currentIndex ? "true" : undefined}
              aria-label={`Go to question ${index + 1}${answered ? " (answered)" : ""}`}
              title={`${question.stage || "Question"} ${index + 1}`}
              className={cn(
                "h-[12px] w-[12px] rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                index === currentIndex
                  ? "bg-primary shadow-inner shadow-primary/40 scale-125"
                  : answered
                  ? "bg-green-500/90 hover:scale-110"
                  : "bg-muted hover:bg-muted-foreground/60 hover:scale-110"
              )}
            />
          );
        })}
      </div>
    </div>

    <Button
      onClick={onNext}
      disabled={currentIndex >= totalQuestions - 1}
      className="h-11 w-11 rounded-full p-0"
      aria-label="Next question"
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  </div>
);

