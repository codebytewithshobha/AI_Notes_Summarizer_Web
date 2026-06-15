import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileUp, Loader2, Sparkles, FileText, MessageSquare, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { createNote, generateArtifacts, getStats, listNotes } from "@/lib/notes.functions";
import { extractPdfText } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NoteForge AI" }] }),
  component: Dashboard,
});

function StatCard({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Dashboard() {
  const nav = useNavigate();
  const createFn = useServerFn(createNote);
  const generateFn = useServerFn(generateArtifacts);
  const statsFn = useServerFn(getStats);
  const listFn = useServerFn(listNotes);

  const stats = useQuery({ queryKey: ["stats"], queryFn: () => statsFn({}) });
  const recent = useQuery({ queryKey: ["recent"], queryFn: () => listFn({ data: { page: 1, pageSize: 5 } }) });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [parsing, setParsing] = useState(false);
  const [sourceType, setSourceType] = useState<"text" | "pdf" | "txt">("text");

  const submit = useMutation({
    mutationFn: async () => {
      if (!title.trim() || content.trim().length < 20) throw new Error("Title and at least 20 characters of notes required.");
      const note = await createFn({ data: { title: title.trim(), content, source_type: sourceType } });
      toast.message("Generating summary, quiz and flashcards…");
      await generateFn({ data: { noteId: note.id } });
      return note;
    },
    onSuccess: (n) => {
      toast.success("Notes processed");
      nav({ to: "/notes/$id", params: { id: n.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10 MB)");
      return;
    }
    setParsing(true);
    try {
      let text = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        text = await extractPdfText(file);
        setSourceType("pdf");
      } else if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
        text = await file.text();
        setSourceType("txt");
      } else {
        toast.error("Unsupported file. Use PDF or TXT.");
        return;
      }
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      setContent(text);
      toast.success(`Loaded ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Upload notes and let AI build your study kit.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={FileText} label="Notes" value={stats.data?.totalNotes ?? "—"} />
        <StatCard icon={BookOpen} label="Total characters" value={(stats.data?.totalChars ?? 0).toLocaleString()} />
        <StatCard icon={MessageSquare} label="Chat messages" value={stats.data?.totalMessages ?? "—"} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="text-lg font-semibold">New notes</h2>
          <p className="text-sm text-muted-foreground">PDF, TXT, or paste raw text. Max 60k characters.</p>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Photosynthesis — Chapter 4" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="file" className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-4 py-2 text-sm hover:bg-accent">
                <FileUp className="h-4 w-4" /> {parsing ? "Parsing…" : "Upload PDF or TXT"}
              </Label>
              <input id="file" type="file" accept="application/pdf,text/plain,.pdf,.txt" className="hidden" onChange={onFile} />
              <span className="text-xs text-muted-foreground">or paste below</span>
            </div>

            <div className="space-y-1.5">
              <Label>Notes content</Label>
              <Textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setSourceType("text");
                }}
                placeholder="Paste your lecture notes, textbook chapter, or transcript…"
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">{content.length.toLocaleString()} / 60,000 characters</p>
            </div>

            <Button onClick={() => submit.mutate()} disabled={submit.isPending || parsing} size="lg" className="w-full">
              {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {submit.isPending ? "Generating…" : "Summarize with AI"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="text-lg font-semibold">Recent</h2>
          <div className="mt-3 space-y-2">
            {(recent.data?.items ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            )}
            {recent.data?.items.map((n) => (
              <button
                key={n.id}
                onClick={() => nav({ to: "/notes/$id", params: { id: n.id } })}
                className="block w-full rounded-lg border border-border/60 bg-background p-3 text-left hover:border-primary/40"
              >
                <p className="line-clamp-1 text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {n.char_count.toLocaleString()} chars · {new Date(n.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
