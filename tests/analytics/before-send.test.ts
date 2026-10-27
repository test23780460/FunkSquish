import { describe, expect, it } from "vitest";
import { ANALYTICS_EXCLUDED_PATHS, ANALYTICS_KEPT_PARAMS, UMAMI_BEFORE_SEND_NAME, UMAMI_BEFORE_SEND_SCRIPT } from "@/components/analytics/before-send";

/** Evaluates the exact inline script that ships, against a fake window. */
function load() {
  const win: Record<string, unknown> = {};
  new Function("window", UMAMI_BEFORE_SEND_SCRIPT)(win);
  return win[UMAMI_BEFORE_SEND_NAME] as (type: string, payload: unknown) => Record<string, unknown> | false;
}

const send = load();
const page = (url: string, referrer = "") => ({ website: "w", hostname: "funksquish.com", url, referrer, title: "T", screen: "390x844", language: "en-US" });

describe("analytics before-send hook", () => {
  it("is defined on window under the name the tracker is told to call", () => {
    expect(typeof send).toBe("function");
    expect(UMAMI_BEFORE_SEND_NAME).toMatch(/^[A-Za-z_$][\w$]*$/);
  });

  it("removes a typed Squish Box name (and every other non-campaign parameter) from page URLs", () => {
    const out = send("event", page("https://funksquish.com/squish-box?size=classic&ribbon=berry&name=Emma%27s%20birthday&items=a,b"));
    expect(out).not.toBe(false);
    expect((out as { url: string }).url).toBe("https://funksquish.com/squish-box");
    expect(JSON.stringify(out)).not.toMatch(/Emma/);
  });

  it("works with path-only URLs too", () => {
    expect((send("event", page("/wishlist?list=a.b.c")) as { url: string }).url).toBe("/wishlist");
  });

  it("keeps campaign tags only", () => {
    const out = send("event", page("https://funksquish.com/?utm_source=tiktok&utm_campaign=launch&fbclid=abc&email=x@y.z")) as { url: string };
    expect(out.url).toBe("https://funksquish.com/?utm_source=tiktok&utm_campaign=launch");
    expect(ANALYTICS_KEPT_PARAMS.every((p) => p.startsWith("utm_"))).toBe(true);
  });

  it("drops hash fragments", () => {
    expect((send("event", page("https://funksquish.com/faq#orders")) as { url: string }).url).toBe("https://funksquish.com/faq");
  });

  it("never records private owner pages or checkout pages", () => {
    for (const url of [
      "https://funksquish.com/partners/review",
      "https://funksquish.com/partners/review/FS-P-20261026-ABCDEFGH?saved=1",
      "/partners/review/requests?saved=FS-D-20261026-ABCDEF",
      "https://funksquish.com/checkout/complete?session_id=cs_live_abc123",
      "/checkout/test-result?canceled=1&checkout=uuid",
    ])
      expect(send("pageview", page(url)), url).toBe(false);
    expect(ANALYTICS_EXCLUDED_PATHS).toContain("/partners/review");
  });

  it("doesn't over-match similarly named public pages", () => {
    expect(send("event", page("https://funksquish.com/partners"))).not.toBe(false);
    expect(send("event", page("https://funksquish.com/partners/reviews-we-love"))).not.toBe(false);
  });

  it("keeps only the site and path of referrers", () => {
    const out = send("event", page("https://funksquish.com/shop", "https://funksquish.com/squish-box?name=Secret")) as { referrer: string };
    expect(out.referrer).toBe("https://funksquish.com/squish-box");
    const ext = send("event", page("https://funksquish.com/", "https://www.tiktok.com/@funksquish?lang=en")) as { referrer: string };
    expect(ext.referrer).toBe("https://www.tiktok.com/@funksquish");
  });

  it("never sends a private page as the referrer", () => {
    const out = send("event", page("https://funksquish.com/shop", "https://funksquish.com/partners/review/FS-P-20261026-ABCDEFGH")) as { referrer: string };
    expect(out.referrer).toBe("");
  });

  it("passes everything else through unchanged and doesn't mutate the original", () => {
    const original = { ...page("https://funksquish.com/quiz?result=jelly"), name: "quiz-complete", data: { step: 3 } };
    const out = send("event", original) as Record<string, unknown>;
    expect(out).toMatchObject({ name: "quiz-complete", data: { step: 3 }, title: "T", screen: "390x844", language: "en-US" });
    expect(original.url).toBe("https://funksquish.com/quiz?result=jelly");
  });

  it("tolerates odd input without throwing", () => {
    expect(send("event", null as unknown as object)).toBeNull();
    expect(send("event", { url: "" })).toEqual({ url: "" });
    expect(send("event", { url: "::not a url::" })).not.toBe(false);
  });
});

describe("tracker loader", () => {
  it("defines the hook before inserting the tracker, with the documented settings", async () => {
    const { umamiLoaderScript, UMAMI_SCRIPT_SRC } = await import("@/components/analytics/before-send");
    const appended: { attrs: Record<string, string>; src?: string; hookDefinedAtAppend: boolean }[] = [];
    const win: Record<string, unknown> = {};
    const doc = {
      querySelector: () => (appended.length ? {} : null),
      createElement: () => {
        const el: { attrs: Record<string, string>; src?: string; defer?: boolean; setAttribute: (k: string, v: string) => void } = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
        return el;
      },
      head: { appendChild: (el: { attrs: Record<string, string>; src?: string }) => appended.push({ ...el, hookDefinedAtAppend: typeof win[UMAMI_BEFORE_SEND_NAME] === "function" }) },
    };
    const code = umamiLoaderScript('abc"</script><script>alert(1)//');
    new Function("window", "document", code)(win, doc);
    new Function("window", "document", code)(win, doc); // a second run doesn't add a second tracker
    expect(appended).toHaveLength(1);
    expect(appended[0].hookDefinedAtAppend).toBe(true);
    expect(appended[0].src).toBe(UMAMI_SCRIPT_SRC);
    expect(appended[0].attrs).toMatchObject({ "data-do-not-track": "true", "data-before-send": UMAMI_BEFORE_SEND_NAME, "data-domains": "funksquish.com,www.funksquish.com", "data-website-id": 'abc"</script><script>alert(1)//' });
    expect(code).not.toContain("</script>");
  });

  it("only accepts UUID website ids", async () => {
    const { isUmamiWebsiteId } = await import("@/components/analytics/before-send");
    expect(isUmamiWebsiteId("00000000-0000-0000-0000-000000000000")).toBe(true);
    for (const bad of [undefined, "", "abc", "00000000-0000-0000-0000-000000000000</script>"]) expect(isUmamiWebsiteId(bad)).toBe(false);
  });
});
