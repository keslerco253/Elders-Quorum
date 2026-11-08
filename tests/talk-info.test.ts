import { describe, expect, it } from "vitest";
import { parseTalkHtml } from "@/lib/talk-info";

describe("talk info", () => {
  it("reads the title and speaker from a talk page", () => {
    const html = `<html><head><title>Faith | The Church of Jesus Christ</title><meta property="og:title" content="Abide in My Love"></head>
      <body><p class="author-name" data-aid="1">By Elder D. Todd Christofferson</p></body></html>`;
    expect(parseTalkHtml(html)).toEqual({ title: "Abide in My Love", speaker: "Elder D. Todd Christofferson" });
  });
});

describe("looking up several talks", () => {
  it("tries again when the Church's site turns one away", async () => {
    const { vi } = await import("vitest");
    const { fetchTalkInfos } = await import("@/lib/talk-info");
    let twoTries = 0;
    const real = globalThis.fetch;
    globalThis.fetch = vi.fn(async (u: string | URL | Request) => {
      // The second talk fails the first time.
      if (String(u).includes("two") && ++twoTries === 1) return new Response("busy", { status: 429 });
      return new Response(`<meta property="og:title" content="Talk ${String(u).includes("two") ? "Two" : "One"}"><p class="author-name">By Elder Test</p>`, { status: 200 });
    }) as typeof fetch;
    try {
      const infos = await fetchTalkInfos(["https://www.churchofjesuschrist.org/study/one", "https://www.churchofjesuschrist.org/study/two"]);
      expect(infos.map((i) => i.title)).toEqual(["Talk One", "Talk Two"]);
    } finally {
      globalThis.fetch = real;
    }
  }, 15000);
});
