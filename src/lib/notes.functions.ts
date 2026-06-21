import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createAiModel } from "./ai-gateway.server";

const MAX_CHARS = 60_000;

// ---------- Create note ----------
export const createNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; content: string; source_type?: string }) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(20).max(MAX_CHARS),
        source_type: z.enum(["text", "pdf", "txt"]).default("text"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: note, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        title: data.title,
        content: data.content,
        source_type: data.source_type,
        char_count: data.content.length,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("note_artifacts").insert({ note_id: note.id, user_id: userId, status: "pending" });
    return note;
  });

// ---------- List notes (history) ----------
export const listNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; page?: number; pageSize?: number }) =>
    z
      .object({
        q: z.string().trim().max(200).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabase
      .from("notes")
      .select("id,title,source_type,char_count,created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.q) q = q.ilike("title", `%${data.q}%`);
    const { data: items, count, error } = await q;
    if (error) throw new Error(error.message);
    return { items: items ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

// ---------- Get note + artifacts ----------
export const getNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: note, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!note) throw new Error("Note not found");
    const { data: artifacts } = await supabase
      .from("note_artifacts")
      .select("*")
      .eq("note_id", note.id)
      .maybeSingle();
    return { note, artifacts: artifacts ?? null };
  });

// ---------- Delete note ----------
export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notes").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Generate AI artifacts ----------
const ArtifactSchema = z.object({
  summary: z.string(),
  key_concepts: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .min(3)
    .max(15),
  mcqs: z
    .array(
      z.object({
        question: z.string(),
        choices: z.array(z.string()).min(3).max(5),
        answer_index: z.number().int().min(0).max(4),
        explanation: z.string(),
      }),
    )
    .min(3)
    .max(10),
  flashcards: z
    .array(z.object({ front: z.string(), back: z.string() }))
    .min(5)
    .max(15),
});

function chunk(text: string, size = 12000): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function extractJson(raw: string): unknown {
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.search(/[\{\[]/);
  const open = s[start];
  const close = open === "[" ? "]" : "}";
  const end = s.lastIndexOf(close);
  if (start === -1 || end === -1) throw new Error("AI response was not JSON");
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    const cleaned = s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(cleaned);
  }
}

export const generateArtifacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { noteId: string }) => z.object({ noteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: note, error: noteErr } = await supabase
      .from("notes")
      .select("id,content,title")
      .eq("id", data.noteId)
      .eq("user_id", userId)
      .single();
    if (noteErr || !note) throw new Error("Note not found");

    await supabase
      .from("note_artifacts")
      .upsert({ note_id: note.id, user_id: userId, status: "processing", error: null });

    try {
      const model = createAiModel();
      const chunks = chunk(note.content);
      let working = note.content;
      // Pre-summarize if very long
      if (chunks.length > 1) {
        const partials: string[] = [];
        for (const c of chunks) {
          const { text } = await generateText({
            model,
            prompt: `Summarize the following section of study notes into a dense bullet outline preserving all key facts, terms, formulas, and examples:\n\n${c}`,
          });
          partials.push(text);
        }
        working = partials.join("\n\n");
      }

      const { text: rawText } = await generateText({
        model,
        prompt: `You are an expert study assistant. Based on the course notes below, produce a JSON object with this exact shape:
{
  "summary": string (markdown with headings and bullets),
  "key_concepts": Array<{ "term": string, "definition": string }> (3-15 items),
  "mcqs": Array<{ "question": string, "choices": string[] (3-5), "answer_index": number (0-based), "explanation": string }> (3-10 items),
  "flashcards": Array<{ "front": string, "back": string }> (5-15 items)
}

Return ONLY valid JSON, no markdown fences, no commentary.

Notes title: ${note.title}

Notes:
${working}`,
      });

      const parsed = extractJson(rawText);
      const artifacts = ArtifactSchema.parse(parsed);

      await supabase
        .from("note_artifacts")
        .upsert({
          note_id: note.id,
          user_id: userId,
          summary: artifacts.summary,
          key_concepts: artifacts.key_concepts,
          mcqs: artifacts.mcqs,
          flashcards: artifacts.flashcards,
          status: "ready",
          error: null,
        });

      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      await supabase
        .from("note_artifacts")
        .upsert({ note_id: note.id, user_id: userId, status: "error", error: msg });
      throw new Error(msg);
    }
  });

// ---------- Chat ----------
export const chatWithNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { noteId: string; message: string }) =>
    z.object({ noteId: z.string().uuid(), message: z.string().trim().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: note, error } = await supabase
      .from("notes")
      .select("id,title,content")
      .eq("id", data.noteId)
      .eq("user_id", userId)
      .single();
    if (error || !note) throw new Error("Note not found");

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role,content")
      .eq("note_id", note.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(20);

    const context_text = note.content.slice(0, 40000);
    const model = getModel();

    const messages = [
      {
        role: "system" as const,
        content: `You are a helpful AI tutor. Answer only based on the user's uploaded course notes below. If something is not in the notes, say so clearly. Be concise and pedagogical.\n\nNOTES TITLE: ${note.title}\n\nNOTES:\n${context_text}`,
      },
      ...(history ?? []).map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user" as const, content: data.message },
    ];

    const { text } = await generateText({ model, messages });

    await supabase.from("chat_messages").insert([
      { note_id: note.id, user_id: userId, role: "user", content: data.message },
      { note_id: note.id, user_id: userId, role: "assistant", content: text },
    ]);

    return { reply: text };
  });

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { noteId: string }) => z.object({ noteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: msgs, error } = await context.supabase
      .from("chat_messages")
      .select("id,role,content,created_at")
      .eq("note_id", data.noteId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return msgs ?? [];
  });

// ---------- Analytics ----------
export const getStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [notes, msgs] = await Promise.all([
      supabase.from("notes").select("id,char_count,created_at").eq("user_id", userId),
      supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    const items = notes.data ?? [];
    const totalChars = items.reduce((s, n) => s + (n.char_count ?? 0), 0);
    const byDay: Record<string, number> = {};
    for (const n of items) {
      const day = (n.created_at as string).slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }
    return {
      totalNotes: items.length,
      totalChars,
      totalMessages: msgs.count ?? 0,
      byDay: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([date, count]) => ({ date, count })),
    };
  });
