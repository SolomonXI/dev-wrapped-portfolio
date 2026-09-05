import { mfaStore } from "../lib/mfa-store.js";
import { authenticator } from "../lib/totp.js";
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
import notFoundHandler from "../api/not-found.js";
import studioHandler from "../api/studio.js";
import authHandler from "../api/admin-auth.js";
import contentHandler from "../api/content.js";
import mediaHandler, { imageType } from "../api/media.js";
import { validContent } from "../assets/content-validation.js";
import { chromium } from "playwright";
import {
  createSessionCookie,
  isAuthenticated,
  isSameOrigin,
} from "../lib/auth.js";

process.env.SESSION_SECRET = "test-only-not-a-production-secret";
process.env.ADMIN_PASSWORD = "test-only-password";
process.env.MFA_ENCRYPTION_KEY =
  "test-only-encryption-key-at-least-32-characters";
const mfaSecret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
let securityRecord = {
  enabled: true,
  version: "test-version",
  secret: mfaSecret,
  lastStep: -1,
  recovery: [],
  used: [],
  failures: 0,
  lockedUntil: 0,
};
let securityEtag = 1;
mock.method(mfaStore, "read", async () => ({
  record: structuredClone(securityRecord),
  etag: String(securityEtag),
}));
mock.method(mfaStore, "write", async (record, etag) => {
  if (etag !== String(securityEtag)) {
    const error = new Error("Conflict");
    error.name = "BlobPreconditionFailedError";
    throw error;
  }
  securityRecord = structuredClone(record);
  securityEtag++;
});
const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = JSON.parse(
  await readFile(resolve(root, "data/site.json"), "utf8"),
);
const routing = JSON.parse(
  await readFile(resolve(root, "vercel.json"), "utf8"),
).routes;
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
      for (const rule of routing) {
        if (!rule.src || !new RegExp(rule.src).test(pathname)) continue;
        if (rule.headers?.Location) {
          res.writeHead(rule.status, rule.headers).end();
          return;
        }
        if (rule.dest) pathname = rule.dest;
        break;
      }
      const routes = {
        "/api/studio": studioHandler,
        "/api/admin-auth": authHandler,
        "/api/not-found": notFoundHandler,
      };
      if (routes[pathname]) {
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.send = (body) => res.end(body);
        res.json = (body) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        if (req.method === "POST") {
          let body = "";
          for await (const chunk of req) body += chunk;
          req.body = JSON.parse(body || "{}");
        }
        return await routes[pathname](req, res);
      }
      if (pathname.startsWith("/lib/")) {
        res.writeHead(404).end();
        return;
      }
      if (pathname.endsWith("/")) pathname += "index.html";
      const filename = resolve(root, "public", "." + pathname);
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
  await context.addCookies([
    {
      name: "__Host-devwrapped_admin",
      value: createSessionCookie("test-version").split(";")[0].split("=")[1],
      url: base.replace("http:", "https:") + "/",
      secure: true,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
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
    .locator("#studio-nav")
    .getByRole("button", { name: "Homepage" })
    .click();
  await page
    .locator("#editor")
    .getByLabel("Headline", { exact: true })
    .fill("A tested developer story");
  const frame = page.frameLocator("#preview-frame");
  await frame
    .getByRole("heading", { name: "A tested developer story." })
    .waitFor();
  await page
    .locator("#studio-nav")
    .getByRole("button", { name: /Skills/ })
    .click();
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
  await page
    .getByRole("button", { name: "Publish changes ↗", exact: true })
    .click();
  await page
    .getByText(
      "Published successfully — your public portfolio is up to date.",
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

test("signed admin sessions reject tampering and cross-origin saves", async () => {
  const before = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-not-a-production-secret";
  try {
    const cookie = createSessionCookie("test-version").split(";")[0];
    assert.equal(await isAuthenticated({ headers: { cookie } }), true);
    assert.equal(
      await isAuthenticated({ headers: { cookie: cookie + "bad" } }),
      false,
    );
    assert.equal(await isAuthenticated({ headers: {} }), false);
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

function mockResponse() {
  return {
    code: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    end(value) {
      this.body = value;
      return this;
    },
  };
}
test("actual server handlers block signed-out editor, saves, and uploads", async () => {
  for (const handler of [studioHandler, contentHandler, mediaHandler]) {
    const res = mockResponse();
    await handler(
      {
        method:
          handler === studioHandler
            ? "GET"
            : handler === contentHandler
              ? "PUT"
              : "POST",
        headers: {},
        body: fixture,
      },
      res,
    );
    assert.equal(res.code, handler === studioHandler ? 303 : 401);
    assert.ok(!String(res.body || "").includes("Your next great edit"));
  }
  const res = mockResponse();
  await mediaHandler(
    { method: "GET", query: { key: "content/site.json" }, headers: {} },
    res,
  );
  assert.equal(res.code, 404);
});
test("sign-in required even when editor URL is typed directly", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const path of ["/admin/", "/admin/index.html", "/api/studio"]) {
    await page.goto(base + path);
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(await page.locator("#editor").count(), 0);
  }
  assert.equal(
    (await context.request.get(base + "/lib/studio.html")).status(),
    404,
  );
  await context.close();
});
test("owner button signs in and logout revokes browser access", async () => {
  const context = await browser.newContext();
  await context.route("**/api/content", (r) => r.fulfill({ json: fixture }));
  const page = await context.newPage();
  await page.goto(base);
  await page.locator(".owner-entry").click();
  await page.getByLabel("Admin password").fill("wrong");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page.getByText("Incorrect password", { exact: true }).waitFor();
  await page.getByLabel("Admin password").fill("test-only-password");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(authenticator(mfaSecret).generate());
  await page.screenshot({
    path: "/tmp/devwrapped-mfa-login.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Verify & enter Studio" }).click();
  await page.waitForURL("**/admin/");
  await page.getByRole("heading", { name: /A good portfolio/ }).waitFor();
  await page.screenshot({
    path: "/tmp/devwrapped-studio-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(base + "/");
  await page.goto(base + "/admin/");
  assert.equal(new URL(page.url()).pathname, "/");
  await context.close();
});
test("appearance, section order, images, undo and invalid import", async (t) => {
  const { page, getSaved } = await setup(t);
  await page.goto(base + "/admin/", { waitUntil: "networkidle" });
  await page
    .locator("#studio-nav")
    .getByRole("button", { name: "Appearance" })
    .click();
  await page.getByLabel("Lime accent", { exact: true }).fill("#aaff88");
  await page.getByLabel("Statistics", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Move Contact banner up", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish changes ↗", exact: true })
    .click();
  await page
    .getByText(
      "Published successfully — your public portfolio is up to date.",
      { exact: true },
    )
    .waitFor();
  assert.equal(getSaved().design.theme.green, "#aaff88");
  assert.ok(getSaved().design.hiddenSections.includes("stats"));
  const publicPage = await page.context().newPage();
  await visit(publicPage);
  assert.equal(await publicPage.locator(".stats-strip").count(), 0);
  assert.equal(
    await publicPage.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--green"),
    ),
    "#aaff88",
  );
  await page
    .locator("#studio-nav")
    .getByRole("button", { name: /Experience/ })
    .click();
  await page
    .getByRole("button", { name: "Choose or upload image" })
    .first()
    .click();
  await page.getByRole("button", { name: "QuackHost", exact: true }).click();
  assert.match(
    await page
      .getByLabel("Company image URL", { exact: true })
      .first()
      .inputValue(),
    /quackhost/,
  );
  await page.getByRole("button", { name: "Undo last change" }).click();
  assert.match(
    await page
      .getByLabel("Company image URL", { exact: true })
      .first()
      .inputValue(),
    /independent-ai/,
  );
  await page
    .locator("#studio-nav")
    .getByRole("button", { name: /Drafts & backups/ })
    .click();
  await page.locator("#import").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"profile":{}}'),
  });
  await page
    .getByText(
      "That backup does not contain a valid portfolio. Nothing was changed.",
      { exact: true },
    )
    .waitFor();
});
test("schemas reject corrupt nested collections, dangerous keys and active image formats", () => {
  assert.equal(validContent(fixture), true);
  const bad = structuredClone(fixture);
  bad.skills[0].items = "oops";
  assert.equal(validContent(bad), false);
  const bad2 = structuredClone(fixture);
  bad2.design = { theme: { green: "red;display:none" } };
  assert.equal(validContent(bad2), false);
  const bad3 = JSON.parse(
    JSON.stringify(fixture).replace(
      '"siteName":',
      '"__proto__":{},"siteName":',
    ),
  );
  assert.equal(validContent(bad3), false);
  assert.equal(imageType(Buffer.from('<svg onload="alert(1)"></svg>')), null);
});

test("failed publish preserves edits and browser draft can be recovered", async (t) => {
  const { page, context } = await setup(t);
  await page.goto(base + "/admin/", { waitUntil: "networkidle" });
  await page
    .locator("#studio-nav")
    .getByRole("button", { name: "Homepage" })
    .click();
  await page
    .getByLabel("Headline", { exact: true })
    .fill("My recoverable draft");
  await context.route("**/api/content", (r) =>
    r.request().method() === "PUT"
      ? r.fulfill({
          status: 503,
          json: { error: "Storage temporarily unavailable" },
        })
      : r.fulfill({ json: fixture }),
  );
  await page
    .getByRole("button", { name: "Publish changes ↗", exact: true })
    .click();
  await page
    .getByText("Storage temporarily unavailable", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Headline", { exact: true }).inputValue(),
    "My recoverable draft",
  );
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("devwrapped-draft") || "{}").headline ===
      "My recoverable draft",
  );
  page.on("dialog", (d) => d.accept());
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await page
    .locator("#studio-nav")
    .getByRole("button", { name: "Homepage" })
    .click();
  assert.equal(
    await page.getByLabel("Headline", { exact: true }).inputValue(),
    "My recoverable draft",
  );
});
test("image upload uses the returned URL in the draft and public save", async (t) => {
  const { page, context, getSaved } = await setup(t);
  await context.route("**/api/media", (r) =>
    r.fulfill({ json: { url: "/assets/images/experience/quackhost.svg" } }),
  );
  await page.goto(base + "/admin/", { waitUntil: "networkidle" });
  await page
    .locator("#studio-nav")
    .getByRole("button", { name: /Experience/ })
    .click();
  await page
    .getByRole("button", { name: "Choose or upload image" })
    .first()
    .click();
  await page
    .locator("#upload-image")
    .setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhcYAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page
    .getByText(
      "Image uploaded and added to your draft. Publish to show it on the portfolio.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("button", { name: "Publish changes ↗", exact: true })
    .click();
  await page
    .getByText(
      "Published successfully — your public portfolio is up to date.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    getSaved().experience[0].image,
    "/assets/images/experience/quackhost.svg",
  );
});
test("all studio sections work on a phone without overflow", async (t) => {
  const { page } = await setup(t, { width: 360 });
  await page.goto(base + "/admin/", { waitUntil: "networkidle" });
  for (const tab of [
    "profile",
    "home",
    "projects",
    "skills",
    "experience",
    "certificates",
    "copy",
    "design",
    "backups",
  ]) {
    await page.locator(`[data-tab="${tab}"]`).first().click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      tab,
    );
  }
  await page.locator('[data-tab="projects"]').first().click();
  await page.screenshot({
    path: "/tmp/devwrapped-studio-mobile.png",
    fullPage: true,
  });
});
test("cross-origin logout and authenticated invalid uploads are denied", async () => {
  const headers = {
    cookie: createSessionCookie("test-version").split(";")[0],
    host: "example.com",
    origin: "https://bad.example",
  };
  const res = mockResponse();
  await authHandler({ method: "DELETE", headers }, res);
  assert.equal(res.code, 403);
  const res2 = mockResponse();
  await contentHandler({ method: "PUT", headers, body: fixture }, res2);
  assert.equal(res2.code, 403);
  const res3 = mockResponse();
  await mediaHandler(
    {
      method: "POST",
      headers: { ...headers, origin: "https://example.com" },
      body: { data: Buffer.from("<svg>bad</svg>").toString("base64") },
    },
    res3,
  );
  assert.equal(res3.code, 400);
});

test("first-time mobile enrollment requires code, displays backups, and opens studio only after confirmation", async () => {
  const previous = structuredClone(securityRecord);
  securityRecord = {
    enabled: false,
    version: null,
    used: [],
    failures: 0,
    lockedUntil: 0,
  };
  securityEtag++;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    await context.route("**/api/content", (r) => r.fulfill({ json: fixture }));
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator("[data-owner]").last().click();
    await page.getByLabel("Admin password").fill("test-only-password");
    await page.getByRole("button", { name: "Continue securely" }).click();
    await page
      .getByRole("heading", { name: "Add your second track." })
      .waitFor();
    assert.equal(
      (
        await context.request.get(base + "/admin/", { maxRedirects: 0 })
      ).status(),
      303,
    );
    await page.locator(".manual-key summary").click();
    const seed = await page.locator("#setup-secret").textContent();
    await page
      .getByLabel("Authenticator code", { exact: true })
      .fill(authenticator(seed).generate());
    await page
      .getByRole("button", { name: "Verify & enable protection" })
      .click();
    await page
      .getByRole("heading", { name: "Keep these somewhere safe." })
      .waitFor();
    assert.equal(await page.locator(".recovery-codes code").count(), 8);
    assert.equal(
      await page.getByRole("button", { name: "Enter my Studio" }).isEnabled(),
      false,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.getByLabel("I have saved my recovery codes").check();
    await page.getByRole("button", { name: "Enter my Studio" }).click();
    await page.waitForURL("**/admin/");
    await page.locator("#editor").waitFor();
    await page
      .locator("#studio-nav")
      .getByRole("button", { name: "Account security" })
      .click();
    await page.getByRole("button", { name: "Replace authenticator" }).waitFor();
  } finally {
    await context.close();
    securityRecord = previous;
    securityEtag++;
  }
});
