import { createFileRoute, useNavigate, useServerFn } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteNote, listNotes } from "@/lib/notes.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — NoteForge AI" }] }),
  component: History,
});

function History() {
  const nav = useNavigate();
  const listFn = useServerFn(listNotes);
  const delFn = useServerFn(deleteNote);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["history", q, page],
    queryFn: () => listFn({ data: { q, page, pageSize } }),
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  async function onDelete(id: string) {
    if (!confirm("Delete this note and its AI artifacts?")) return;
    try {
      await delFn({ data: { id } });
      toast.success("Deleted");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Notes history</h1>
      <p className="text-sm text-muted-foreground">Search, browse and revisit your study sessions.</p>

      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Size</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((n) => (
              <tr key={n.id} className="border-t border-border/60 hover:bg-accent/30">
                <td className="px-4 py-3">
                  <button className="font-medium hover:underline" onClick={() => nav({ to: "/notes/$id", params: { id: n.id } })}>
                    {n.title}
                  </button>
                </td>
                <td className="px-4 py-3 uppercase text-muted-foreground">{n.source_type}</td>
                <td className="px-4 py-3 text-muted-foreground">{n.char_count.toLocaleString()} ch</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(n.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => onDelete(n.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {!isFetching && (data?.items ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No notes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {pages} · {total} total
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
