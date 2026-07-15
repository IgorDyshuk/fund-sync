import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rulesPath = new URL("../../firestore.rules", import.meta.url);
const firebaseConfigPath = new URL("../../firebase.json", import.meta.url);

describe("Firestore deployment safety", () => {
  it("points Firebase deployment at the reviewed rules file", () => {
    const config = JSON.parse(readFileSync(firebaseConfigPath, "utf8")) as {
      firestore?: { rules?: string };
    };

    expect(config.firestore?.rules).toBe("firestore.rules");
  });

  it("allows only authenticated owners to access user trade documents", () => {
    const rules = readFileSync(rulesPath, "utf8");

    expect(rules).toContain("match /user_trades/{tradeId}");
    expect(rules).toContain("request.auth != null");
    expect(rules).toContain("request.auth.uid == ownerId");
    expect(rules).toContain("isOwner(resource.data.ownerId)");
    expect(rules).toContain("isOwner(request.resource.data.ownerId)");
  });

  it("does not contain a public allow-all rule", () => {
    const rules = readFileSync(rulesPath, "utf8");

    expect(rules).not.toMatch(/allow\s+(read|write|read,\s*write)[^;]*if\s+true/);
  });
});
