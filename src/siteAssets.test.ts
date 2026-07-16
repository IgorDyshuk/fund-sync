import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifestPath = new URL("../public/site.webmanifest", import.meta.url);

type SiteManifest = {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
};

describe("site icon assets", () => {
  it("references every icon through the Vite base path", () => {
    expect(indexHtml).toContain(
      'href="%BASE_URL%favicon-32.png"',
    );
    expect(indexHtml).toContain(
      'href="%BASE_URL%apple-touch-icon.png"',
    );
    expect(indexHtml).toContain(
      'href="%BASE_URL%site.webmanifest"',
    );
    expect(indexHtml).toContain('<meta name="theme-color" content="#08090d"');
  });

  it("defines a standalone Fund Sync manifest with relative icon paths", () => {
    const manifest = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    ) as SiteManifest;

    expect(manifest).toMatchObject({
      name: "Fund Sync",
      short_name: "Fund Sync",
      start_url: ".",
      scope: ".",
      display: "standalone",
      background_color: "#08090d",
      theme_color: "#08090d",
    });
    expect(manifest.icons).toEqual([
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    ]);
  });

  it.each([
    ["favicon-32.png", 32],
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ])("keeps %s as a square %ipx PNG", (fileName, expectedSize) => {
    const image = readFileSync(
      new URL(`../public/${fileName}`, import.meta.url),
    );

    expect([...image.subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(image.readUInt32BE(16)).toBe(expectedSize);
    expect(image.readUInt32BE(20)).toBe(expectedSize);
  });
});
