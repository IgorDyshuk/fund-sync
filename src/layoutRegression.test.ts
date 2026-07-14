import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexCss = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("viewport overflow regression", () => {
  it("prevents the document itself from scrolling", () => {
    expect(indexCss).toMatch(/html\s*\{[^}]*overflow:\s*hidden;/s);
    expect(indexCss).toMatch(/body\s*\{[^}]*overflow:\s*hidden;/s);
    expect(indexCss).toMatch(/#root\s*\{[^}]*overflow:\s*hidden;/s);
  });
});
