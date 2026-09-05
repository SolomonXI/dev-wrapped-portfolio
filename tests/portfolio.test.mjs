import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
import { chromium } from "playwright";
import {
  createSessionCookie,
  isAuthenticated,
  isSameOrigin,
} from "../lib/auth.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = JSON.parse(
  await readFile(resolve(root, "data/site.json"), "utf8"),
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
};
let server, base, browser;
before(async () => {
  server = createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname.endsWith("/")) pathname += "index.html";
      const filename = resolve(root, "." + pathname);
      if (!filename.startsWith(root.endsWith(sep) ? root : root + sep)) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        types[extname(filename)] || "application/octet-stream",
      );
      res.end(await readFile(filename));
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  await new Promise((done) => server?.close(done));
});

async function setup(t, { content = fixture, width = 1440 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 950 },
    reducedMotion: "reduce",
  });
  let saved = structuredClone(content);
  await context.route("**/api/content*", async (route) => {
    if (route.request().method() === "PUT") {
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: saved });
  });
  await context.route("**/api/admin-auth", (r) =>
    r.fulfill({ json: { authenticated: true } }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(async () => {
    assert.deepEqual(errors, []);
    await context.close();
  });
  return { page, context, getSaved: () => saved };
}
async function visit(page, path = "/") {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.locator("#main").waitFor();
}

test("all public routes render with one heading, active navigation and no overflow", async (t) => {
  const { page } = await setup(t);
  for (const path of [
    "/",
    "/featured_projects_wrapped_visual/",
    "/skills_wrapped/",
    "/experience_wrapped/",
    "/certificates_wrapped/",
    "/contact_me/",
  ]) {
    await visit(page, path);
    assert.equal(await page.locator("h1").count(), 1, path);
    assert.equal(await page.locator('[aria-current="page"]').count(), 1, path);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      path,
    );
    const emptyLinks = await page
      .locator("a")
      .evaluateAll(
        (links) =>
          links.filter(
            (a) => !a.getAttribute("href") || a.getAttribute("href") === "#",
          ).length,
      );
    assert.equal(emptyLinks, 0, path);
  }
});

test("mobile layout and navigation work at 360px", async (t) => {
  const { page } = await setup(t, { width: 360 });
  await visit(page);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  assert.equal(
    await page.locator(".mobile-toggle").getAttribute("aria-expanded"),
    "true",
  );
  await page
    .locator(".side-nav")
    .getByRole("link", { name: "The toolkit" })
    .click();
  await page.waitForURL("**/skills_wrapped/");
  assert.equal(
    await page.locator(".mobile-toggle").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
});

test("project filter and detail dialog support keyboard dismissal and focus return", async (t) => {
  const { page } = await setup(t);
  await visit(page, "/featured_projects_wrapped_visual/");
  await page.getByRole("button", { name: "FastAPI", exact: true }).click();
  assert.equal(
    await page.locator(".project:visible").count(),
    fixture.projects.filter((p) => p.tags.includes("FastAPI")).length,
  );
  const trigger = page.getByRole("button", { name: "Explore SignalCV" });
  await trigger.click();
  assert.equal(
    await page.locator("#project-dialog").evaluate((el) => el.open),
    true,
  );
  assert.match(await page.locator("#project-dialog").innerText(), /SignalCV/);
  await page.keyboard.press("Escape");
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "All", exact: true }).click();
  assert.equal(
    await page.locator(".project:visible").count(),
    fixture.projects.length,
  );
});

test("five chapter story is navigable and returns focus", async (t) => {
  const { page } = await setup(t);
  await visit(page);
  await page.getByRole("button", { name: "Play my story" }).click();
  await page.keyboard.press("ArrowRight");
  assert.match(
    await page.locator("#story-dialog").innerText(),
    /02 \/ THE COLLECTION/,
  );
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next chapter" }).click();
  assert.match(
    await page.locator("#story-dialog").innerText(),
    /WHAT COMES NEXT/,
  );
  await page.getByRole("button", { name: "Back to portfolio" }).click();
  assert.equal(
    await page.locator("#story-dialog").evaluate((el) => el.open),
    false,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Play my story" })
      .evaluate((el) => el === document.activeElement),
    true,
  );
});

test("QuackHost expands and all technical icons load", async (t) => {
  const { page } = await setup(t);
  await visit(page, "/experience_wrapped/");
  const role = page.locator("details").filter({ hasText: "QuackHost" });
  await role.locator("summary").click();
  assert.equal(await role.getAttribute("open"), "");
  assert.match(await role.innerText(), /Co-owned/);
  await visit(page, "/skills_wrapped/");
  const logos = page.locator('img[alt$="logo"]');
  assert.equal(await logos.count(), 5);
  assert.equal(
    await logos.evaluateAll((xs) =>
      xs.every((x) => x.complete && x.naturalWidth > 0),
    ),
    true,
  );
});

test("admin edit previews every route, saves, and appears in public content", async (t) => {
  const { page, getSaved } = await setup(t);
  await page.goto(base + "/admin/", { waitUntil: "networkidle" });
  await page
    .locator("#editor")
    .getByLabel("Headline", { exact: true })
    .fill("A tested developer story");
  const frame = page.frameLocator("#preview-frame");
  await frame
    .getByRole("heading", { name: "A tested developer story." })
    .waitFor();
  await page.locator("#preview-page").selectOption("/skills_wrapped/");
  await frame
    .getByRole("heading", { name: "The stack behind the story." })
    .waitFor();
  await page
    .locator("#editor")
    .getByLabel("Skill", { exact: true })
    .first()
    .fill("Edited TypeScript");
  await frame.getByText("Edited TypeScript", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByText(
      "Saved successfully — the public website is now showing these changes.",
      { exact: true },
    )
    .waitFor();
  assert.equal(getSaved().headline, "A tested developer story");
  const publicPage = await page.context().newPage();
  await visit(publicPage);
  assert.match(
    (await publicPage.locator("h1").innerText()).replace(/\s+/g, " "),
    /A tested developer story/,
  );
});

test("empty collections do not break public pages", async (t) => {
  const content = {
    ...fixture,
    projects: [],
    experience: [],
    skills: [],
    certificates: [],
    socials: [],
    profile: { name: "New developer" },
    stats: [],
  };
  const { page } = await setup(t, { content });
  for (const path of [
    "/",
    "/skills_wrapped/",
    "/featured_projects_wrapped_visual/",
    "/experience_wrapped/",
    "/contact_me/",
  ]) {
    await visit(page, path);
    assert.equal(await page.locator("h1").count(), 1);
  }
});

test("content is escaped and unsafe links are not made clickable", async (t) => {
  const content = structuredClone(fixture);
  content.profile.name = '<img src=x onerror="window.pwned=1">';
  content.profile.avatar = "javascript:alert(1)";
  content.projects[0].liveUrl = "javascript:alert(1)";
  content.projects[0].title = "<script>window.pwned=1</script>";
  const { page } = await setup(t, { content });
  await visit(page);
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  assert.equal(
    await page
      .locator('a[href^="javascript:"],img[src^="javascript:"]')
      .count(),
    0,
  );
  assert.match(
    await page.locator("#main").innerText(),
    /<script>window.pwned=1<\/script>/,
  );
});

test("failed content request has a usable recovery screen", async (t) => {
  const { page, context } = await setup(t);
  await context.route("**/api/content", (r) =>
    r.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Reload portfolio" }).waitFor();
});

test("signed admin sessions reject tampering and cross-origin saves", () => {
  const before = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-not-a-production-secret";
  try {
    const cookie = createSessionCookie().split(";")[0];
    assert.equal(isAuthenticated({ headers: { cookie } }), true);
    assert.equal(
      isAuthenticated({ headers: { cookie: cookie + "bad" } }),
      false,
    );
    assert.equal(isAuthenticated({ headers: {} }), false);
    assert.equal(
      isSameOrigin({
        headers: { origin: "https://example.com", host: "example.com" },
      }),
      true,
    );
    assert.equal(
      isSameOrigin({
        headers: { origin: "https://bad.example", host: "example.com" },
      }),
      false,
    );
  } finally {
    if (before === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = before;
  }
});

test("studio stays within the viewport at phone and tablet sizes", async (t) => {
  const { page } = await setup(t);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/admin/", { waitUntil: "networkidle" });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.equal(await page.locator("#preview-page").isVisible(), true);
  }
});
