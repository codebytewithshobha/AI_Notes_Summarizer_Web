import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Loader2, RefreshCw, Send, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  chatWithNote,
  generateArtifacts,
  getChatHistory,
  getNote,
} from "@/lib/notes.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/notes/$id")({
  head: () => ({ meta: [{ title: "Note — NoteForge AI" }] }),
  component: NotePage,
});

type Concept = { term: string; definition: string };
type MCQ = { question: string; choices: string[]; answer_index: number; explanation: string };
type Flashcard = { front: string; back: string };

function NotePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getNoteFn = useServerFn(getNote);
  const regenFn = useServerFn(generateArtifacts);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["note", id],
    queryFn: () => getNoteFn({ data: { id } }),
    refetchInterval: (q) => {
      const s = q.state.data?.artifacts?.status;
      return s === "processing" || s === "pending" ? 3000 : false;
    },
  });

  const regen = useMutation({
    mutationFn: () => regenFn({ data: { noteId: id } }),
    onSuccess: () => {
      toast.success("Regenerated");
      qc.invalidateQueries({ queryKey: ["note", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" /> Loading…
      </div>
    );
  }

  const { note, artifacts } = data;
  const status = artifacts?.status ?? "pending";
  const concepts = (artifacts?.key_concepts as Concept[] | null) ?? [];
  const mcqs = (artifacts?.mcqs as MCQ[] | null) ?? [];
  const flashcards = (artifacts?.flashcards as Flashcard[] | null) ?? [];

  function exportTxt() {
    const lines = [
      `# ${note.title}`,
      ``,
      `## Summary`,
      artifacts?.summary ?? "",
      ``,
      `## Key concepts`,
      ...concepts.map((c) => `- ${c.term}: ${c.definition}`),
      ``,
      `## MCQs`,
      ...mcqs.map((m, i) => `${i + 1}. ${m.question}\n${m.choices.map((c, j) => `  ${String.fromCharCode(65 + j)}. ${c}${j === m.answer_index ? "  ✓" : ""}`).join("\n")}\n   → ${m.explanation}`),
      ``,
      `## Flashcards`,
      ...flashcards.map((f) => `Q: ${f.front}\nA: ${f.back}\n`),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{note.title}</h1>
          <p className="text-sm text-muted-foreground">
            {note.source_type.toUpperCase()} · {note.char_count.toLocaleString()} characters · {new Date(note.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportTxt} disabled={status !== "ready"}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => regen.mutate()} disabled={regen.isPending}>
            <RefreshCw className={`mr-1 h-4 w-4 ${regen.isPending ? "animate-spin" : ""}`} /> Regenerate
          </Button>
        </div>
      </div>

      {status !== "ready" && (
        <div className="mb-6 rounded-xl border border-border/60 bg-card p-6 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            {status === "error" ? `Generation failed: ${artifacts?.error}` : "AI is processing your notes — this usually takes 10–30 seconds…"}
          </p>
          {status === "error" && (
            <Button className="mt-3" size="sm" onClick={() => regen.mutate()}>
              Retry
            </Button>
          )}
        </div>
      )}

      {status === "ready" && (
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="concepts">Concepts</TabsTrigger>
            <TabsTrigger value="quiz">Quiz</TabsTrigger>
            <TabsTrigger value="cards">Flashcards</TabsTrigger>
            <TabsTrigger value="chat">Tutor</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <div className="rounded-xl border border-border/60 bg-card p-6">
              <article className="prose prose-sm max-w-none whitespace-pre-wrap text-sm dark:prose-invert">
                {artifacts?.summary}
              </article>
            </div>
          </TabsContent>

          <TabsContent value="concepts" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {concepts.map((c, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                  <p className="font-semibold">{c.term}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.definition}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="quiz" className="mt-4">
            <Quiz mcqs={mcqs} />
          </TabsContent>

          <TabsContent value="cards" className="mt-4">
            <Flashcards cards={flashcards} />
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <Chat noteId={id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Quiz({ mcqs }: { mcqs: MCQ[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = Object.entries(answers).filter(([i, a]) => mcqs[+i]?.answer_index === a).length;

  if (!mcqs.length) return <p className="text-muted-foreground">No questions.</p>;

  return (
    <div className="space-y-4">
      {mcqs.map((m, i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-card p-5">
          <p className="font-medium">
            {i + 1}. {m.question}
          </p>
          <div className="mt-3 space-y-2">
            {m.choices.map((c, j) => {
              const chosen = answers[i] === j;
              const correct = submitted && j === m.answer_index;
              const wrong = submitted && chosen && j !== m.answer_index;
              return (
                <label
                  key={j}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
                    correct
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : wrong
                        ? "border-destructive/60 bg-destructive/10"
                        : chosen
                          ? "border-primary/60 bg-primary/10"
                          : "border-border"
                  }`}
                >
                  <input type="radio" name={`q${i}`} className="accent-primary" checked={chosen} onChange={() => setAnswers((a) => ({ ...a, [i]: j }))} disabled={submitted} />
                  <span>{c}</span>
                </label>
              );
            })}
          </div>
          {submitted && <p className="mt-3 text-xs text-muted-foreground">{m.explanation}</p>}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{submitted ? `Score: ${score} / ${mcqs.length}` : `${Object.keys(answers).length} / ${mcqs.length} answered`}</p>
        {!submitted ? (
          <Button onClick={() => setSubmitted(true)}>Submit quiz</Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

function Flashcards({ cards }: { cards: Flashcard[] }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  if (!cards.length) return <p className="text-muted-foreground">No flashcards.</p>;
  const c = cards[i];
  return (
    <div className="flex flex-col items-center gap-4">
      <button onClick={() => setFlip((f) => !f)} className="grid min-h-[220px] w-full max-w-xl place-items-center rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm transition hover:border-primary/40">
        <p className="text-lg font-medium">{flip ? c.back : c.front}</p>
        <p className="mt-3 text-xs text-muted-foreground">{flip ? "Answer" : "Tap to flip"}</p>
      </button>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => { setI((x) => (x - 1 + cards.length) % cards.length); setFlip(false); }}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {i + 1} / {cards.length}
        </span>
        <Button variant="outline" size="icon" onClick={() => { setI((x) => (x + 1) % cards.length); setFlip(false); }}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Chat({ noteId }: { noteId: string }) {
  const chatFn = useServerFn(chatWithNote);
  const histFn = useServerFn(getChatHistory);
  const qc = useQueryClient();
  const { data: history } = useQuery({ queryKey: ["chat", noteId], queryFn: () => histFn({ data: { noteId } }) });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  const send = useMutation({
    mutationFn: () => chatFn({ data: { noteId, message: input.trim() } }),
    onMutate: () => setInput(""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", noteId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Chat failed"),
  });

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      <div ref={scrollRef} className="max-h-[420px] min-h-[280px] space-y-3 overflow-y-auto p-4">
        {(history ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Ask anything about these notes — the tutor only answers from your material.</p>
        )}
        {(history ?? []).map((m: { id: string; role: string; content: string }) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted px-4 py-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() && !send.isPending) send.mutate();
        }}
        className="flex gap-2 border-t border-border/60 p-3"
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about these notes…" disabled={send.isPending} />
        <Button type="submit" disabled={!input.trim() || send.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
