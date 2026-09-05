const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const strings = (x, keys) =>
  keys.every((k) => x[k] === undefined || typeof x[k] === "string");
const list = (x, check) =>
  Array.isArray(x) && x.length <= 200 && x.every(check);
const textList = (x) => list(x, (s) => typeof s === "string");
export function validContent(x) {
  if (
    !object(x) ||
    !strings(x, ["siteName", "kicker", "headline", "intro", "contactText"]) ||
    !object(x.profile) ||
    !strings(x.profile, ["name", "role", "bio", "location", "avatar", "email"])
  )
    return false;
  const schemas = {
    socials: ["label", "url"],
    stats: ["value", "label"],
    projects: ["title", "description", "image", "liveUrl", "repoUrl"],
    experience: ["role", "company", "period", "summary", "image"],
    certificates: ["title", "issuer", "date", "url", "image"],
  };
  for (const [key, fields] of Object.entries(schemas)) {
    if (
      !list(
        x[key],
        (item) =>
          object(item) &&
          strings(item, fields) &&
          (item.hidden === undefined || typeof item.hidden === "boolean") &&
          (key !== "projects" ||
            ((item.tags === undefined || textList(item.tags)) &&
              (item.featured === undefined ||
                typeof item.featured === "boolean"))) &&
          (key !== "experience" ||
            item.highlights === undefined ||
            textList(item.highlights)),
      )
    )
      return false;
  }
  if (
    !list(
      x.skills,
      (g) =>
        object(g) &&
        strings(g, ["category"]) &&
        list(
          g.items,
          (s) =>
            object(s) &&
            strings(s, ["name", "icon"]) &&
            Number.isFinite(s.level) &&
            s.level >= 0 &&
            s.level <= 100,
        ),
    )
  )
    return false;
  if (x.design !== undefined) {
    const d = x.design;
    if (!object(d)) return false;
    if (
      d.theme !== undefined &&
      (!object(d.theme) ||
        !Object.values(d.theme).every(
          (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v),
        ))
    )
      return false;
    if (
      d.copy !== undefined &&
      (!object(d.copy) ||
        !Object.values(d.copy).every((v) => typeof v === "string"))
    )
      return false;
    const keys = [
      "hero",
      "stats",
      "projects",
      "about",
      "experience",
      "contact",
    ];
    for (const k of ["sectionOrder", "hiddenSections"])
      if (
        d[k] !== undefined &&
        (!textList(d[k]) ||
          !d[k].every((v) => keys.includes(v)) ||
          new Set(d[k]).size !== d[k].length)
      )
        return false;
    if (
      d.featuredLimit !== undefined &&
      (!Number.isInteger(d.featuredLimit) ||
        d.featuredLimit < 1 ||
        d.featuredLimit > 12)
    )
      return false;
  }
  // Reject prototype keys and oversized/deep imported values before rendering them.
  function safe(v, depth = 0) {
    if (depth > 12) return false;
    if (typeof v === "string") return v.length <= 20000;
    if (v && typeof v === "object")
      return Object.entries(v).every(
        ([k, val]) =>
          !["__proto__", "constructor", "prototype"].includes(k) &&
          safe(val, depth + 1),
      );
    return true;
  }
  return safe(x);
}
