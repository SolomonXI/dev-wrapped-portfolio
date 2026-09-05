import {
  normalize,
  copyDefaults,
  themeDefaults,
  sectionDefaults,
} from "./settings.js";
import { validContent } from "./content-validation.js";

const $ = (s) => document.querySelector(s);
const esc = (v = "") =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const attr = (p) => esc(JSON.stringify(p));
const safeImage = (v) =>
  /^(https?:\/\/|\/(?!\/))/.test(String(v || "")) ? esc(v) : "";
const editor = $("#editor");
const draftKey = "devwrapped-draft";
let state,
  published = "",
  active = "overview",
  device = "desktop",
  previewTimer,
  draftTimer,
  editTimer,
  saving = false,
  uploading = false,
  mediaPath,
  mediaTrigger;
let history = [],
  future = [];
const tabs = [
  ["overview", "◉", "Overview"],
  ["profile", "◎", "Profile & links"],
  ["home", "▤", "Homepage"],
  ["projects", "▦", "Projects"],
  ["skills", "⌘", "Skills"],
  ["experience", "↗", "Experience"],
  ["certificates", "✧", "Credentials"],
  ["copy", "≋", "Headings & pages"],
  ["design", "◐", "Appearance"],
  ["backups", "↶", "Drafts & backups"],
];
const labels = {
  hero: "Introduction / record",
  stats: "Statistics",
  projects: "Selected projects",
  about: "About & toolkit",
  experience: "Experience",
  contact: "Contact banner",
};
const status = (message, error = false) => {
  $("#status").textContent = message;
  $("#status").className = "status " + (error ? "error" : "");
};
const dirty = () => Boolean(state && JSON.stringify(state) !== published);
function saveLocal() {
  try {
    localStorage.setItem(draftKey, JSON.stringify(state));
  } catch {
    status(
      "Browser draft storage is unavailable. Publish or download a backup to keep your changes.",
      true,
    );
  }
}
function checkpoint() {
  clearTimeout(editTimer);
  const current = JSON.stringify(state);
  if (history.at(-1) !== current) {
    history.push(current);
    if (history.length > 80) history.shift();
    future = [];
  }
  updateIndicator();
}
function changed() {
  updateIndicator();
  updatePreview();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveLocal, 450);
}
function updateIndicator() {
  $("#publish").disabled = !state || !dirty() || saving || uploading;
  $("#publish").textContent = saving ? "Publishing…" : "Publish changes ↗";
  $("#save-indicator").textContent = saving
    ? "Publishing"
    : dirty()
      ? "Unpublished changes"
      : "All changes published";
  $("#save-indicator").classList.toggle("unsaved", dirty());
  $("#undo").disabled =
    history.length < 2 && history.at(-1) === JSON.stringify(state);
  $("#redo").disabled = !future.length;
}
function get(path) {
  return path.reduce((o, k) => o?.[k], state);
}
function set(path, value) {
  const parent = path.slice(0, -1).reduce((o, k) => o[k], state);
  parent[path.at(-1)] = value;
}
const field = (label, path, value = "", type = "text", wide = false) =>
  `<label class="field ${wide ? "wide" : ""}"><span>${esc(label)}</span>${type === "textarea" ? `<textarea data-path="${attr(path)}" rows="3">${esc(value)}</textarea>` : `<input data-path="${attr(path)}" type="${type}" value="${esc(value)}" ${type === "number" ? 'min="0" max="100"' : ""} ${type === "email" ? 'autocomplete="email"' : ""}>`}</label>`;
const check = (label, path, value) =>
  `<label class="toggle-field"><input type="checkbox" data-path="${attr(path)}" ${value ? "checked" : ""}><span>${esc(label)}</span></label>`;
const imageField = (label, path, value) =>
  `<div class="image-field wide"><div class="image-swatch">${safeImage(value) ? `<img src="${safeImage(value)}" alt="${esc(label)} preview">` : "<span>＋</span>"}</div><div>${field(label, path, value)}<button class="text-button" type="button" data-media="${attr(path)}">Choose or upload image ↗</button></div></div>`;
const card = (title, help, body, action = "") =>
  `<section class="editor-card"><header><div><h2>${esc(title)}</h2><p>${esc(help)}</p></div>${action}</header>${body}</section>`;
const addButton = (key, label = "Add item") =>
  `<button class="button primary small" type="button" data-add="${key}">＋ ${esc(label)}</button>`;
function controls(path, index, length) {
  return `<div class="item-controls"><button type="button" class="mini-button" data-move="${attr([...path, index])}" data-direction="-1" aria-label="Move item up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" class="mini-button" data-move="${attr([...path, index])}" data-direction="1" aria-label="Move item down" ${index === length - 1 ? "disabled" : ""}>↓</button><button type="button" class="mini-button danger" data-remove="${attr([...path, index])}">Remove</button></div>`;
}
function repeater(key, renderFields) {
  return `<div class="repeater">${state[key].map((item, i) => `<details class="repeat-item" ${i === 0 ? "open" : ""}><summary><span class="item-number">${String(i + 1).padStart(2, "0")}</span>${safeImage(item.image || item.icon) ? `<img class="item-thumb" src="${safeImage(item.image || item.icon)}" alt="">` : ""}<span class="item-name">${esc(item.title || item.role || item.category || item.label || "Untitled")}<small>${esc(item.company || item.issuer || (item.hidden ? "Hidden from portfolio" : item.featured ? "Featured release" : ""))}</small></span><span class="expand">＋</span></summary><div class="item-body">${controls([key], i, state[key].length)}<div class="fields">${renderFields(item, i)}</div></div></details>`).join("") || '<div class="empty"><b>Your next chapter starts here.</b><p>Add an item to bring this section to life.</p></div>'}</div>`;
}
function render() {
  $("#studio-nav").innerHTML = tabs
    .map(
      ([key, symbol, label]) =>
        `<button type="button" data-tab="${key}" ${active === key ? 'aria-current="page"' : ""}><span class="nav-symbol">${symbol}</span>${label}${Array.isArray(state[key]) ? `<small>${state[key].length}</small>` : ""}</button>`,
    )
    .join("");
  $("#current-section").textContent = tabs.find((t) => t[0] === active)[2];
  const p = state.profile;
  const pages = {
    overview: () =>
      `<div class="welcome-card"><div class="eyebrow">YOU’RE THE HEADLINER</div><h2>Hey, ${esc((p.name || "creator").split(" ")[0])}.<br>Let’s make it yours.</h2><p>Your portfolio is a living collection. Give it something new.</p><button class="button dark" type="button" data-tab="home">Edit your introduction ↗</button><div class="welcome-record" aria-hidden="true"><span>YOUR<br>NEXT<br>RELEASE</span></div></div><div class="metric-grid">${[
        ["projects", "Projects"],
        ["skills", "Skill groups"],
        ["experience", "Experiences"],
      ]
        .map(
          ([key, label]) =>
            `<button class="metric" type="button" data-tab="${key}"><strong>${String(state[key].length).padStart(2, "0")}</strong><span>${label} ↗</span></button>`,
        )
        .join(
          "",
        )}</div>${card("A good portfolio, on repeat.", "Your three-step editing routine.", `<div class="steps"><div><b>01</b><span><strong>Make it personal</strong><p>Update your story, links, and profile photo.</p></span><button class="text-button" type="button" data-tab="profile">Edit →</button></div><div><b>02</b><span><strong>Show the work</strong><p>Add projects, covers, and your latest experience.</p></span><button class="text-button" type="button" data-tab="projects">Edit →</button></div><div><b>03</b><span><strong>Preview. Then publish.</strong><p>Try the desktop and phone views before going live.</p></span></div></div>`)}<div class="tip"><b>A safe space to experiment.</b> Edits autosave as a draft on this browser. The public portfolio stays unchanged until you publish.</div>`,
    profile: () =>
      card(
        "The person behind the projects.",
        "Your identity, photo, and contact information.",
        `<div class="fields">${field("Full name", ["profile", "name"], p.name)}${field("Role", ["profile", "role"], p.role)}${field("Location", ["profile", "location"], p.location)}${field("Email", ["profile", "email"], p.email, "email")}${imageField("Profile photo URL", ["profile", "avatar"], p.avatar)}${field("Short bio", ["profile", "bio"], p.bio, "textarea", true)}${field("Contact message", ["contactText"], state.contactText, "textarea", true)}</div>`,
      ) +
      card(
        "Find me elsewhere.",
        "Public links shown on your portfolio.",
        repeater(
          "socials",
          (x, i) =>
            field("Label", ["socials", i, "label"], x.label) +
            field("URL", ["socials", i, "url"], x.url),
        ),
        addButton("socials", "Add link"),
      ),
    home: () =>
      card(
        "Your opening track.",
        "The first things a visitor sees.",
        `<div class="fields">${field("Site name", ["siteName"], state.siteName)}${field("Kicker", ["kicker"], state.kicker)}${field("Headline", ["headline"], state.headline, "text", true)}${field("Introduction", ["intro"], state.intro, "textarea", true)}</div>`,
      ) +
      card(
        "The numbers that matter.",
        "Use real facts. Leave empty to calculate counts from your content.",
        repeater(
          "stats",
          (x, i) =>
            field("Value", ["stats", i, "value"], x.value) +
            field("Label", ["stats", i, "label"], x.label),
        ),
        addButton("stats", "Add statistic"),
      ),
    projects: () =>
      card(
        "The project playlist.",
        "Reorder your work, choose cover artwork, and pick your featured releases.",
        repeater(
          "projects",
          (x, i) =>
            field("Title", ["projects", i, "title"], x.title) +
            field(
              "Tags (comma separated)",
              ["projects", i, "tags"],
              (x.tags || []).join(", "),
            ) +
            imageField("Project image URL", ["projects", i, "image"], x.image) +
            field(
              "Description",
              ["projects", i, "description"],
              x.description,
              "textarea",
              true,
            ) +
            field("Live URL", ["projects", i, "liveUrl"], x.liveUrl) +
            field("Repository URL", ["projects", i, "repoUrl"], x.repoUrl) +
            check(
              "Featured on homepage",
              ["projects", i, "featured"],
              x.featured,
            ) +
            check("Hide from portfolio", ["projects", i, "hidden"], x.hidden),
        ),
        addButton("projects", "Add project"),
      ),
    skills: () =>
      card(
        "In heavy rotation.",
        "Group your skills. Levels express your own confidence, not measured usage.",
        repeater(
          "skills",
          (g, i) =>
            field(
              "Category",
              ["skills", i, "category"],
              g.category,
              "text",
              true,
            ) +
            `<div class="nested wide">${g.items.map((s, j) => `<div class="skill-item"><div class="fields">${field("Skill", ["skills", i, "items", j, "name"], s.name)}${field("Confidence (0–100)", ["skills", i, "items", j, "level"], s.level, "number")}${imageField("Icon URL", ["skills", i, "items", j, "icon"], s.icon)}</div>${controls(["skills", i, "items"], j, g.items.length)}</div>`).join("")}<button class="button" type="button" data-add-skill="${i}">＋ Add skill</button></div>`,
        ),
        addButton("skills", "Add group"),
      ),
    experience: () =>
      card(
        "Every chapter counts.",
        "Your roles, company artwork, and the work you’re proud of.",
        repeater(
          "experience",
          (x, i) =>
            field("Role", ["experience", i, "role"], x.role) +
            field("Company", ["experience", i, "company"], x.company) +
            field("Period", ["experience", i, "period"], x.period) +
            check(
              "Hide from portfolio",
              ["experience", i, "hidden"],
              x.hidden,
            ) +
            imageField(
              "Company image URL",
              ["experience", i, "image"],
              x.image,
            ) +
            field(
              "Summary",
              ["experience", i, "summary"],
              x.summary,
              "textarea",
              true,
            ) +
            field(
              "Highlights (one per line)",
              ["experience", i, "highlights"],
              (x.highlights || []).join("\n"),
              "textarea",
              true,
            ),
        ),
        addButton("experience", "Add experience"),
      ),
    certificates: () =>
      card(
        "Keep learning.",
        "Add qualifications, certificates, and links to verify them.",
        repeater(
          "certificates",
          (x, i) =>
            field("Title", ["certificates", i, "title"], x.title) +
            field("Issuer", ["certificates", i, "issuer"], x.issuer) +
            field("Date", ["certificates", i, "date"], x.date) +
            field("Credential URL", ["certificates", i, "url"], x.url) +
            imageField(
              "Certificate image URL",
              ["certificates", i, "image"],
              x.image,
            ) +
            check(
              "Hide from portfolio",
              ["certificates", i, "hidden"],
              x.hidden,
            ),
        ),
        addButton("certificates", "Add credential"),
      ),
    copy: () =>
      card(
        "Put it in your own words.",
        "Edit the main headings, page introductions, and record labels. Leave the look to the design.",
        `<div class="copy-groups">${[
          [
            "Homepage & shared sections",
            Object.keys(copyDefaults).filter((k) => !k.includes("Page")),
          ],
          ...[
            "projects",
            "skills",
            "experience",
            "certificates",
            "contact",
          ].map((k) => [
            k[0].toUpperCase() + k.slice(1) + " page",
            [k + "PageTitle", k + "PageIntro"],
          ]),
        ]
          .map(
            ([title, keys], i) =>
              `<details class="repeat-item" ${i === 0 ? "open" : ""}><summary>${title}<span class="expand">＋</span></summary><div class="item-body fields">${keys
                .map((k) =>
                  field(
                    k
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (c) => c.toUpperCase()),
                    ["design", "copy", k],
                    state.design.copy[k],
                    /Intro/.test(k) ? "textarea" : "text",
                    true,
                  ),
                )
                .join("")}</div></details>`,
          )
          .join("")}</div>`,
      ),
    design: () =>
      card(
        "Keep the energy. Change the mix.",
        "The original Wrapped palette is your starting point.",
        `<div class="fields color-fields">${Object.entries(themeDefaults)
          .map(([key]) =>
            field(
              {
                bg: "Background",
                panel: "Panel",
                text: "Text",
                muted: "Secondary text",
                green: "Lime accent",
                purple: "Lavender accent",
                pink: "Pink accent",
              }[key],
              ["design", "theme", key],
              state.design.theme[key],
              "color",
            ),
          )
          .join(
            "",
          )}</div><button class="button" type="button" id="reset-colors">Restore original colours</button><p class="help">Keep text and background colours distinct so everyone can read your portfolio.</p>`,
      ) +
      card(
        "Arrange your tracklist.",
        "Show, hide, and reorder homepage sections. Dedicated pages remain available.",
        `<div class="section-order">${state.design.sectionOrder.map((key, i) => `<div><span class="item-number">${String(i + 1).padStart(2, "0")}</span><label><input type="checkbox" data-section="${key}" ${!state.design.hiddenSections.includes(key) ? "checked" : ""}>${labels[key]}</label><div class="item-controls"><button type="button" class="mini-button" data-section-move="${i}" data-direction="-1" aria-label="Move ${labels[key]} up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="mini-button" data-section-move="${i}" data-direction="1" aria-label="Move ${labels[key]} down" ${i === state.design.sectionOrder.length - 1 ? "disabled" : ""}>↓</button></div></div>`).join("")}</div><div class="fields">${field("Homepage project count (1–12)", ["design", "featuredLimit"], state.design.featuredLimit, "number")}</div>`,
      ),
    backups: () =>
      card(
        "Nothing good gets lost.",
        "Drafts stay on this browser. Download a backup to keep a portable copy.",
        `<div class="backup-actions"><button type="button" class="button" id="save-draft">Save browser draft</button><button type="button" class="button" id="download">Download backup</button><label class="button upload-label">Import backup<input id="import" type="file" accept="application/json,.json"></label><button type="button" class="button danger" id="reset">Reload published version</button></div><p class="help">Importing only updates your draft and preview. Review before publishing. Replacing a draft can be undone.</p>`,
      ),
  };
  editor.innerHTML = pages[active]();
  updateIndicator();
}
function navigate(key) {
  if (!tabs.some((t) => t[0] === key)) return;
  checkpoint();
  active = key;
  render();
  const route =
    {
      projects: "/featured_projects_wrapped_visual/",
      skills: "/skills_wrapped/",
      experience: "/experience_wrapped/",
      certificates: "/certificates_wrapped/",
      profile: "/contact_me/",
    }[key] || "/";
  $("#preview-page").value = route;
  updatePreview(true);
}
function resizePreview() {
  const wrap = $(".preview-frame-wrap");
  const width = device === "mobile" ? 390 : 1440;
  const scale = Math.min(wrap.clientWidth / width, 1);
  const frame = $("#preview-frame");
  frame.style.width = width + "px";
  frame.style.height = Math.max(900, wrap.clientHeight / scale) + "px";
  frame.style.transform = `scale(${scale})`;
}
function updatePreview(immediate = false) {
  clearTimeout(previewTimer);
  const run = () => {
    if (!state) return;
    try {
      sessionStorage.setItem("devwrapped-preview", JSON.stringify(state));
      $("#preview-frame").src =
        $("#preview-page").value + "?preview=1&t=" + Date.now();
    } catch {
      status("Preview storage is unavailable in this browser.", true);
    }
  };
  if (immediate) run();
  else previewTimer = setTimeout(run, 650);
}
new ResizeObserver(resizePreview).observe($(".preview-frame-wrap"));
$("#preview-page").onchange = () => updatePreview(true);
document.querySelectorAll("[data-device]").forEach(
  (button) =>
    (button.onclick = () => {
      device = button.dataset.device;
      document
        .querySelectorAll("[data-device]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      resizePreview();
    }),
);
editor.onsubmit = (e) => e.preventDefault();
editor.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.dataset.path && !el.dataset.section) return;
  let path;
  if (el.dataset.section) {
    const hidden = new Set(state.design.hiddenSections);
    el.checked
      ? hidden.delete(el.dataset.section)
      : hidden.add(el.dataset.section);
    state.design.hiddenSections = [...hidden];
  } else {
    path = JSON.parse(el.dataset.path);
    let value = el.type === "checkbox" ? el.checked : el.value;
    const key = path.at(-1);
    if (key === "tags" || key === "highlights")
      value = value
        .split(key === "tags" ? "," : "\n")
        .map((s) => s.trim())
        .filter(Boolean);
    if (key === "level") value = Math.min(100, Math.max(0, Number(value) || 0));
    if (key === "featuredLimit")
      value = Math.min(12, Math.max(1, Number(value) || 1));
    set(path, value);
  }
  changed();
  clearTimeout(editTimer);
  editTimer = setTimeout(checkpoint, 700);
});
editor.addEventListener("focusout", (e) => {
  if (e.target.dataset.path) {
    checkpoint();
    const path = JSON.parse(e.target.dataset.path);
    if (["image", "icon", "avatar"].includes(path.at(-1))) {
      const swatch = e.target
        .closest(".image-field")
        ?.querySelector(".image-swatch");
      if (swatch)
        swatch.innerHTML = safeImage(e.target.value)
          ? `<img src="${safeImage(e.target.value)}" alt="Image preview">`
          : "<span>＋</span>";
    }
  }
});
const templates = {
  socials: { label: "New link", url: "" },
  stats: { value: "", label: "New statistic" },
  projects: {
    title: "New project",
    description: "",
    tags: [],
    image: "",
    liveUrl: "",
    repoUrl: "",
    featured: false,
  },
  skills: { category: "New category", items: [] },
  experience: {
    role: "New role",
    company: "",
    period: "",
    summary: "",
    highlights: [],
    image: "",
  },
  certificates: {
    title: "New certificate",
    issuer: "",
    date: "",
    url: "",
    image: "",
  },
};
function mutate(fn) {
  checkpoint();
  fn();
  checkpoint();
  render();
  changed();
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button,[data-media]");
  if (!b || !state) return;
  if (b.dataset.tab) {
    navigate(b.dataset.tab);
    return;
  }
  if (b.dataset.media) {
    mediaPath = JSON.parse(b.dataset.media);
    mediaTrigger = b;
    showMedia();
    return;
  }
  if (b.dataset.add) {
    mutate(() =>
      state[b.dataset.add].push(structuredClone(templates[b.dataset.add])),
    );
    const item = editor.querySelector(".repeat-item:last-child");
    if (item) {
      item.open = true;
      item.querySelector("input")?.focus();
    }
    return;
  }
  if (b.dataset.addSkill !== undefined) {
    const i = Number(b.dataset.addSkill);
    mutate(() =>
      state.skills[i].items.push({ name: "New skill", level: 50, icon: "" }),
    );
    editor.querySelectorAll(".repeat-item")[i].open = true;
    return;
  }
  if (b.dataset.remove) {
    if (!confirm("Remove this item? You can undo before publishing.")) return;
    const path = JSON.parse(b.dataset.remove);
    const i = path.pop();
    mutate(() => get(path).splice(i, 1));
    return;
  }
  if (b.dataset.move) {
    const path = JSON.parse(b.dataset.move),
      i = path.pop(),
      j = i + Number(b.dataset.direction);
    mutate(() => {
      const list = get(path);
      if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
    });
    return;
  }
  if (b.dataset.sectionMove !== undefined) {
    const i = Number(b.dataset.sectionMove),
      j = i + Number(b.dataset.direction);
    mutate(() => {
      const list = state.design.sectionOrder;
      if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
    });
    return;
  }
  if (b.id === "reset-colors")
    mutate(() => (state.design.theme = { ...themeDefaults }));
  if (b.id === "save-draft") {
    clearTimeout(draftTimer);
    saveLocal();
    status("Draft saved on this browser. The public portfolio is unchanged.");
  }
  if (b.id === "download") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    a.download = "devwrapped-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  if (
    b.id === "reset" &&
    confirm("Replace your edits with the latest published version?")
  ) {
    try {
      await loadPublished(true);
      clearTimeout(draftTimer);
      localStorage.removeItem(draftKey);
      $("#draft-banner").hidden = true;
    } catch (err) {
      status(err.message, true);
    }
  }
});
$("#undo").onclick = () => {
  checkpoint();
  if (history.length < 2) return;
  future.push(history.pop());
  state = JSON.parse(history.at(-1));
  render();
  changed();
  status("Last change undone.");
};
$("#redo").onclick = () => {
  if (!future.length) return;
  const next = future.pop();
  history.push(next);
  state = JSON.parse(next);
  render();
  changed();
  status("Change restored.");
};
window.addEventListener("beforeunload", (e) => {
  if (dirty()) {
    saveLocal();
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveLocal();
    status("Browser draft saved. Use Publish changes to go live.");
  }
});
async function loadPublished(keepHistory = false) {
  const response = await fetch("/api/content", { cache: "no-store" });
  if (!response.ok)
    throw new Error(
      "Could not load published content. Your draft has not been changed. Refresh to retry.",
    );
  const data = await response.json();
  if (!validContent(data))
    throw new Error(
      "The saved portfolio has an unsupported format. No changes have been made.",
    );
  const next = normalize(data);
  next.design.sectionOrder = [
    ...new Set([...next.design.sectionOrder, ...sectionDefaults]),
  ];
  if (keepHistory) checkpoint();
  state = next;
  published = JSON.stringify(state);
  if (!keepHistory) history = [];
  checkpoint();
  render();
  updatePreview(true);
  status("You’re backstage. Changes stay private until you publish.");
}
$("#publish").onclick = async () => {
  checkpoint();
  if (!validContent(state)) {
    status("Please check the form: a value is invalid.", true);
    return;
  }
  if (!editor.reportValidity()) return;
  saving = true;
  updateIndicator();
  const snapshot = JSON.stringify(state);
  status("Publishing your portfolio…");
  try {
    const response = await fetch("/api/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: snapshot,
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      saveLocal();
      published = JSON.stringify(state);
      location.replace("/");
      return;
    }
    if (!response.ok)
      throw new Error(
        result.error || "Publishing failed. Your draft is safe; try again.",
      );
    published = snapshot;
    clearTimeout(draftTimer);
    if (!dirty()) localStorage.removeItem(draftKey);
    else saveLocal();
    $("#draft-banner").hidden = true;
    status(
      dirty()
        ? "Published. Your newer edits are still an unpublished draft."
        : "Published successfully — your public portfolio is up to date.",
    );
  } catch (err) {
    status(err.message || "Connection failed. Your draft is safe.", true);
  } finally {
    saving = false;
    updateIndicator();
  }
};
$("#logout").onclick = async () => {
  if (
    dirty() &&
    !confirm("Sign out? Your unpublished draft will stay on this browser.")
  )
    return;
  try {
    const response = await fetch("/api/admin-auth", { method: "DELETE" });
    if (!response.ok) throw new Error();
    if (dirty()) saveLocal();
    sessionStorage.removeItem("devwrapped-preview");
    published = JSON.stringify(state);
    location.replace("/");
  } catch {
    status("Could not sign out. Check your connection and try again.", true);
  }
};
$("#restore-draft").onclick = () => {
  try {
    const data = JSON.parse(localStorage.getItem(draftKey));
    if (!validContent(data)) throw new Error();
    mutate(() => (state = normalize(data)));
    $("#draft-banner").hidden = true;
    status("Draft restored. Review it before publishing.");
  } catch {
    status("This draft is invalid. It has not replaced your content.", true);
  }
};
$("#dismiss-draft").onclick = () => {
  if (confirm("Discard the saved browser draft?")) {
    localStorage.removeItem(draftKey);
    $("#draft-banner").hidden = true;
  }
};
editor.addEventListener("change", async (e) => {
  if (e.target.id !== "import") return;
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024)
      throw new Error("Backups must be smaller than 1 MB.");
    const data = JSON.parse(await file.text());
    if (!validContent(data))
      throw new Error(
        "That backup does not contain a valid portfolio. Nothing was changed.",
      );
    if (dirty() && !confirm("Replace the current draft with this backup?"))
      return;
    mutate(() => (state = normalize(data)));
    status("Backup imported into your draft. Preview it before publishing.");
  } catch (err) {
    status(err.message || "Could not import the file.", true);
  } finally {
    e.target.value = "";
  }
});
const library = [
  ["TypeScript", "skills/typescript.svg"],
  ["Python", "skills/python.svg"],
  ["React", "skills/react.svg"],
  ["Next.js", "skills/nextjs.svg"],
  ["Expo", "skills/expo.svg"],
  ["QuackHost", "experience/quackhost.svg"],
  ["Bournemouth University", "experience/bournemouth-university.svg"],
  ["Independent AI", "experience/independent-ai.svg"],
  ["SignalCV", "projects/signalcv.webp"],
  ["Dev Wrapped", "projects/dev-wrapped.webp"],
  ["Clearline", "projects/clearline.webp"],
  ["Spotify dashboard", "projects/spotify-stats.webp"],
  ["Glow-Up", "projects/glow-up-command-deck.webp"],
  ["Milo (concept artwork)", "projects/milo-finance.svg"],
  ["Shadow Routine (concept artwork)", "projects/shadow-routine.svg"],
].map(([label, path]) => ({ label, url: "/assets/images/" + path }));
function showMedia() {
  const assets = [...library];
  const add = (url, label) => {
    if (safeImage(url) && !assets.some((a) => a.url === url))
      assets.push({ url, label });
  };
  add(state.profile.avatar, "Profile photo");
  for (const key of ["projects", "experience", "certificates"])
    state[key].forEach((x) => add(x.image, x.title || x.company));
  state.skills.forEach((g) => g.items.forEach((s) => add(s.icon, s.name)));
  $("#media-grid").innerHTML = assets
    .map(
      (x) =>
        `<button type="button" data-pick="${esc(x.url)}"><img src="${safeImage(x.url)}" alt="" loading="lazy"><span>${esc(x.label)}</span></button>`,
    )
    .join("");
  $("#media-status").textContent = "";
  $("#media-dialog").showModal();
}
$("#media-grid").onclick = (e) => {
  const b = e.target.closest("[data-pick]");
  if (b) {
    mutate(() => set(mediaPath, b.dataset.pick));
    $("#media-dialog").close();
  }
};
$("[data-close-media]").onclick = () => $("#media-dialog").close();
$("#media-dialog").addEventListener("close", () => {
  editor
    .querySelector(`[data-media="${CSS.escape(JSON.stringify(mediaPath))}"]`)
    ?.focus();
});
$("#upload-image").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const path = [...mediaPath];
  uploading = true;
  updateIndicator();
  e.target.disabled = true;
  $("#media-status").textContent = "Uploading image…";
  try {
    if (file.size > 3 * 1024 * 1024)
      throw new Error("Choose an image smaller than 3 MB.");
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const response = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Upload failed.");
    mutate(() => set(path, result.url));
    $("#media-dialog").close();
    status(
      "Image uploaded and added to your draft. Publish to show it on the portfolio.",
    );
  } catch (err) {
    $("#media-status").textContent = err.message || "Upload failed. Try again.";
  } finally {
    uploading = false;
    e.target.disabled = false;
    e.target.value = "";
    updateIndicator();
  }
};
try {
  const response = await fetch("/api/admin-auth", { cache: "no-store" });
  if (!response.ok)
    throw new Error("Cannot verify your session. Refresh to retry.");
  if (!(await response.json()).authenticated) {
    location.replace("/");
  } else {
    await loadPublished();
    try {
      $("#draft-banner").hidden = !localStorage.getItem(draftKey);
    } catch {}
  }
} catch (err) {
  status(err.message, true);
}
// Recheck after back/forward-cache restoration; never leave a signed-out studio visible.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) location.reload();
});
