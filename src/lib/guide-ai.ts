import "server-only";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { leaderGuide } from "./guide";

// "Ask the guide": a leader asks in their own words ("how do I turn off texting?")
// and Claude answers from the leader guide, pointing to the sections to read.
// Needs ANTHROPIC_API_KEY on the server; without it the guide's word search is used.

const FILE = path.join(process.cwd(), "docs", "PRESIDENCY-GUIDE.md");

export const askConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export interface GuideAnswer {
  answer: string;
  /** Sections of the guide to read (title and link id). */
  sections: { id: string; title: string }[];
}

const SYSTEM_INTRO = `You answer questions from church leaders (bishoprics and organization presidencies) about how to use My Ward Link, their ward's app. Answer only from the leader guide below.

- Give the steps plainly: where to tap (like "Admin → Settings → Messages from members") and what happens. Keep it short: a sentence or a few numbered steps.
- If the guide doesn't cover it, say so plainly and suggest the closest thing it does cover. Don't invent features or settings.
- If it depends on who they are (site owner, ward administrator, presidency, member), say who can do it.
- List in "sections" the guide sections (exact titles) that cover the answer, most useful first, at most three.

The leader guide:

`;

/** Answers a leader's question from the guide, or null when it can't (not set up, or the request failed). */
export async function askGuide(question: string): Promise<GuideAnswer | null> {
  if (!askConfigured()) return null;
  const guide = leaderGuide();
  let md: string;
  try {
    md = fs.readFileSync(FILE, "utf8");
  } catch {
    return null;
  }
  if (!guide) return null;
  const titles = guide.sections.map((s) => s.title);
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      // If the model declines, the request is re-run on a fallback model chosen by the API.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              answer: { type: "string" },
              sections: { type: "array", items: { type: "string", enum: titles } },
            },
            required: ["answer", "sections"],
            additionalProperties: false,
          },
        },
      },
      // The guide is the same for every question, so it's cached.
      system: [{ type: "text", text: SYSTEM_INTRO + md, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: question.slice(0, 500) }],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { answer: string; sections: string[] };
    return {
      answer: parsed.answer.trim(),
      sections: parsed.sections.map((t) => guide.sections.find((s) => s.title === t)).filter((s): s is { id: string; title: string } => !!s),
    };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.error("[guide-ai] rate limited");
    else if (err instanceof Anthropic.APIError) console.error(`[guide-ai] API error ${err.status}:`, err.message);
    else console.error("[guide-ai] failed", err);
    return null;
  }
}
