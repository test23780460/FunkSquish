/**
 * Umami "before send" hook (https://docs.umami.is/docs/tracker-configuration,
 * `data-before-send`). Umami calls it with every page view and event before
 * anything leaves the browser. It keeps analytics to what the Privacy Policy
 * describes:
 *
 *  - Private owner pages and checkout pages are never recorded (their URLs can
 *    contain application references or Stripe session ids).
 *  - URL parameters are removed, except campaign tags (utm_*). Shared Squish Box
 *    links carry a box name the visitor typed, which could be a child's name.
 *  - Referrers keep only the site and path, never parameters, and private pages
 *    are never sent as a referrer either.
 *
 * It's a plain string so it can run inline before the tracker loads (Umami
 * requires the function to exist on `window` first). Tests evaluate this exact
 * string, so what's tested is what ships.
 *
 * The tracker is inserted by the same inline script (`umamiLoaderScript`), right
 * after the hook is defined. Next's `beforeInteractive` strategy was NOT enough:
 * it's dropped on pages that render a not-found boundary while the tracker
 * still loaded (found in browser QA, 2026-10-27).
 */
export const UMAMI_BEFORE_SEND_NAME = "fsUmamiBeforeSend";

/** Never recorded. Prefix match on whole path segments. */
export const ANALYTICS_EXCLUDED_PATHS = ["/partners/review", "/checkout"] as const;

/** The only URL parameters analytics may keep (marketing campaign tags). */
export const ANALYTICS_KEPT_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export const UMAMI_BEFORE_SEND_SCRIPT = `(function () {
  var EXCLUDED = ${JSON.stringify(ANALYTICS_EXCLUDED_PATHS)};
  var KEEP = ${JSON.stringify(ANALYTICS_KEPT_PARAMS)};
  var BASE = "https://funksquish.com";
  function parse(u) {
    try { return new URL(u, BASE); } catch (e) { return null; }
  }
  function excluded(u) {
    var x = typeof u === "string" ? parse(u) : null;
    if (!x) return false;
    return EXCLUDED.some(function (p) { return x.pathname === p || x.pathname.indexOf(p + "/") === 0; });
  }
  function clean(u, keepCampaign) {
    if (typeof u !== "string" || u === "") return u;
    var x = parse(u);
    if (!x) return u.split("?")[0].split("#")[0];
    var kept = [];
    if (keepCampaign) {
      x.searchParams.forEach(function (v, k) { if (KEEP.indexOf(k) !== -1) kept.push(encodeURIComponent(k) + "=" + encodeURIComponent(v)); });
    }
    var absolute = /^[a-z][a-z0-9+.-]*:/i.test(u);
    return (absolute ? x.origin : "") + x.pathname + (kept.length ? "?" + kept.join("&") : "");
  }
  window.${UMAMI_BEFORE_SEND_NAME} = function (type, payload) {
    if (!payload || typeof payload !== "object") return payload;
    if (excluded(payload.url)) return false;
    var next = {};
    for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) next[k] = payload[k];
    next.url = clean(payload.url, true);
    // A private page as the referrer (owner moving on to a public page) is dropped too: its path can hold a reference.
    if (payload.referrer) next.referrer = excluded(payload.referrer) ? "" : clean(payload.referrer, false);
    return next;
  };
})();`;

export const UMAMI_SCRIPT_SRC = "https://cloud.umami.is/script.js";
export const UMAMI_DOMAINS = "funksquish.com,www.funksquish.com";

/** JSON for embedding inside an inline <script>: "<" is escaped so "</script>" can never close the tag. */
const js = (v: string) => JSON.stringify(v).replace(/</g, "\\u003c");

/** Umami website ids are UUIDs; anything else is treated as "not configured". */
export const isUmamiWebsiteId = (v: string | undefined): v is string => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Defines the hook, then inserts Umami's tracker — in that order, in one script. */
export function umamiLoaderScript(websiteId: string): string {
  return `${UMAMI_BEFORE_SEND_SCRIPT}
(function () {
  if (document.querySelector('script[data-fs-umami]')) return;
  var s = document.createElement("script");
  s.src = ${js(UMAMI_SCRIPT_SRC)};
  s.defer = true;
  s.setAttribute("data-fs-umami", "");
  s.setAttribute("data-website-id", ${js(websiteId)});
  s.setAttribute("data-domains", ${js(UMAMI_DOMAINS)});
  s.setAttribute("data-do-not-track", "true");
  s.setAttribute("data-before-send", ${js(UMAMI_BEFORE_SEND_NAME)});
  document.head.appendChild(s);
})();`;
}
