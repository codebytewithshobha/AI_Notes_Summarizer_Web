import { Brand } from "./Brand";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row">
        <Brand />
        <p>© {new Date().getFullYear()} NoteForge AI — AI Course Notes Summarizer.</p>
      </div>
    </footer>
  );
}
