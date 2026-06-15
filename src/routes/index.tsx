import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, FileText, MessagesSquare, Sparkles, Layers, Zap } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NoteForge AI — Turn notes into summaries, quizzes & flashcards" },
      {
        name: "description",
        content:
          "Upload PDF or text notes and instantly get AI summaries, key concepts, MCQs, flashcards and a private tutor chat.",
      },
    ],
  }),
  component: Landing,
});

function Feature({ icon: Icon, title, body }: { icon: typeof Brain; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 transition hover:border-primary/40 hover:shadow-sm">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_50%_at_50%_0%,oklch(0.7_0.18_265_/_0.18),transparent_70%)]" />
          <div className="mx-auto max-w-5xl px-4 py-20 text-center md:py-28">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" /> AI-powered study assistant
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">
              Turn dense notes into <span className="bg-gradient-to-r from-indigo-500 to-sky-500 bg-clip-text text-transparent">clear understanding</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              Upload a PDF or paste your notes — get an instant summary, key concepts, multiple-choice questions,
              flashcards, and a private AI tutor that answers from your material.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/dashboard">Get started free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid gap-4 md:grid-cols-3">
            <Feature icon={FileText} title="Upload anything" body="Drop a PDF, .txt or paste raw text. Smart chunking handles long documents." />
            <Feature icon={Brain} title="Summaries & concepts" body="Structured markdown summary plus a glossary of key terms and definitions." />
            <Feature icon={Layers} title="MCQs & flashcards" body="Auto-generated quizzes and spaced-repetition flashcards built from your notes." />
            <Feature icon={MessagesSquare} title="Tutor chat" body="Ask follow-up questions — the AI only answers from your uploaded material." />
            <Feature icon={Zap} title="Fast & private" body="Backed by Google Gemini through Lovable AI. Your notes stay tied to your account." />
            <Feature icon={Sparkles} title="Beautiful dashboard" body="Dark/light mode, search, pagination, and a polished modern UI." />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
