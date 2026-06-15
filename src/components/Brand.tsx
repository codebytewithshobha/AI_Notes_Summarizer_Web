import { BookOpenCheck } from "lucide-react";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
        <BookOpenCheck className="h-4 w-4" />
      </div>
      <span className="text-base font-semibold tracking-tight">NoteForge AI</span>
    </div>
  );
}
