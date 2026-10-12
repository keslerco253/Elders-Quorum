import { describe, expect, it } from "vitest";
import { parseTalkHtml } from "@/lib/talk-info";

describe("talk info", () => {
  it("reads the title and speaker from a talk page", () => {
    const html = `<html><head><title>Faith | The Church of Jesus Christ</title><meta property="og:title" content="Abide in My Love"></head>
      <body><p class="author-name" data-aid="1">By Elder D. Todd Christofferson</p></body></html>`;
    expect(parseTalkHtml(html)).toEqual({ title: "Abide in My Love", speaker: "Elder D. Todd Christofferson" });
  });
});
