(async () => {
  "use strict";
  const app = document.querySelector("#app");
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const url = (value) => {
    const raw = String(value || "").trim();
    if (/^\/(?!\/)/.test(raw)) return raw;
    try {
      const parsed = new URL(raw);
      return ["https:", "http:", "mailto:"].includes(parsed.protocol)
        ? parsed.href
        : "";
    } catch {
      return "";
    }
  };
  const paths = {
    home: "/",
    projects: "/featured_projects_wrapped_visual/",
    skills: "/skills_wrapped/",
    experience: "/experience_wrapped/",
    certificates: "/certificates_wrapped/",
    contact: "/contact_me/",
  };
  const preview = new URLSearchParams(location.search).get("preview") === "1";
  const route = (key) => paths[key] + (preview ? "?preview=1" : "");
  const page = document.body.dataset.page || "home";
  const year = new Date().getFullYear();
  const shapes = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    projects:
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    skills: '<path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-15-2 16"/>',
    experience:
      '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c5 4 13 4 18 0m-9 1v4"/>',
    certificates:
      '<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
    contact:
      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M7 17 17 7M7 7h10v10"/>',
    play: '<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    sound: '<path d="M4 9v6M8 5v14M12 3v18M16 7v10M20 9v6"/>',
    heart:
      '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5z"/>',
    check: '<path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="9"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    chat: '<path d="M21 11a8 8 0 0 1-8 8H8l-5 3V5a2 2 0 0 1 2-2h8a8 8 0 0 1 8 8zM7 8h8m-8 5h6"/>',
    people:
      '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m0-18a4 4 0 0 1 0 8m3 4a5 5 0 0 1 3 4v2"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  };
  const icon = (key) =>
    `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${shapes[key] || shapes.skills}</svg>`;
  const number = (value) => String(value).padStart(2, "0");
  let data;
  try {
    if (preview) {
      try {
        data = JSON.parse(
          sessionStorage.getItem("devwrapped-preview") || "null",
        );
      } catch {}
    }
    if (!data) {
      const response = await fetch("/api/content", { cache: "no-store" });
      if (!response.ok)
        throw new Error("The portfolio could not be loaded. Please try again.");
      data = await response.json();
    }
    const p = data.profile || {};
    const projects = (data.projects || []).filter((x) => x && x.title);
    const groups = (data.skills || []).filter(Boolean);
    const skills = groups.flatMap((g) =>
      (g.items || []).map((s) => ({ ...s, category: g.category })),
    );
    const technical = skills.filter((s) =>
      /tech|develop|engineering/i.test(s.category || ""),
    );
    const topSkills = technical.length ? technical : skills;
    const experience = (data.experience || []).filter(Boolean);
    const certificates = (data.certificates || []).filter(Boolean);
    const socials = (data.socials || []).filter((s) => s.label && url(s.url));
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || "")
      ? p.email
      : "";
    const contactHref = email ? `mailto:${esc(email)}` : route("contact");
    const firstName = String(p.name || "Developer").split(/\s+/)[0];
    const avatar = url(p.avatar)
      ? `<img src="${esc(url(p.avatar))}" alt="${esc(p.name)}" width="42" height="42">`
      : icon("skills");
    const image = (src, alt, cls = "") =>
      url(src)
        ? `<img src="${esc(url(src))}" alt="${esc(alt)}" class="${cls}" loading="lazy" decoding="async">`
        : "";
    const humanIcon = (name) =>
      ({
        reliability: "check",
        scheduling: "calendar",
        "record keeping": "copy",
        communication: "chat",
        "customer service": "heart",
        coordination: "people",
      })[String(name).toLowerCase()] || "skills";
    const skillIcon = (skill) =>
      `<span class="tech-icon">${url(skill.icon) ? image(skill.icon, `${skill.name} logo`) : icon(humanIcon(skill.name))}</span>`;
    const socialLinks = socials
      .map(
        (s) =>
          `<a href="${esc(url(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`,
      )
      .join("");
    const navLabels = {
      home: "Overview",
      projects: "Selected work",
      skills: "The toolkit",
      experience: "My journey",
      certificates: "Credentials",
      contact: "Get in touch",
    };
    document.title = `${page === "home" ? p.name || data.siteName : navLabels[page]} — ${data.siteName || "Dev Wrapped"}`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription)
      metaDescription.content =
        data.intro || p.bio || "A developer portfolio, wrapped.";
    const heading = (index, title, sub = "", link = "") =>
      `<div class="section-heading"><div><div class="eyebrow">${esc(index)}</div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${link}</div>`;
    const viewLink = (key, label) =>
      `<a class="section-link" href="${route(key)}">${esc(label)} ${icon("arrow")}</a>`;
    const empty = (text) => `<div class="empty">${esc(text)}</div>`;
    const projectLinks = (project) =>
      `<div class="project-links">${url(project.liveUrl) ? `<a href="${esc(url(project.liveUrl))}" target="_blank" rel="noopener noreferrer">Visit project ${icon("external")}</a>` : ""}${url(project.repoUrl) ? `<a href="${esc(url(project.repoUrl))}" target="_blank" rel="noopener noreferrer">Source code ${icon("skills")}</a>` : ""}${!url(project.liveUrl) && !url(project.repoUrl) ? "<span>Project preview · not publicly linked</span>" : ""}</div>`;
    const tags = (project) =>
      `<div class="tags">${(project.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`;
    const projectCard = (project) => {
      const i = projects.indexOf(project);
      const illustrative = /\/(milo-finance|shadow-routine)\.svg$/.test(
        project.image || "",
      );
      return `<article class="project" data-project-tags="${esc(JSON.stringify(project.tags || []))}"><div class="project-cover">${image(project.image, illustrative ? `${project.title} — concept artwork, not a live screenshot` : `${project.title} preview`)}<span class="cover-label">${illustrative ? "CONCEPT ARTWORK" : project.featured ? "FEATURED RELEASE" : "FROM THE COLLECTION"}</span><button type="button" class="project-play" data-project="${i}" aria-label="Explore ${esc(project.title)}">${icon("external")}</button></div><div class="project-body"><div class="project-title"><span class="track-number">${number(i + 1)}</span><h3>${esc(project.title)}</h3></div><p>${esc(project.description)}</p>${tags(project)}${projectLinks(project)}</div></article>`;
    };
    const hero = () => {
      const words = String(data.headline || `${firstName}’s developer story`)
        .trim()
        .split(/\s+/);
      const last = words.pop().replace(/[.!?]+$/, "");
      return `<section class="hero" aria-label="Introduction"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> ${esc(data.kicker || "A developer portfolio, wrapped")}</div><h1>${esc(words.join(" "))}<br><em>${esc(last)}.</em></h1><p>${esc(data.intro || p.bio)}</p><div class="hero-actions"><button class="btn dark" data-story>${icon("play")} Play my story</button><a class="text-link" href="#selected-work">Explore the projects ↗</a></div><div class="hero-footer">${avatar}<span>${esc(p.name)} · ${esc(p.location)}</span></div></div><div class="record-scene" aria-hidden="true"><span class="art-caption">INDEPENDENTLY BUILT. ALWAYS EVOLVING.</span><div class="record"><div class="record-label"><span>THE DEVELOPER EDITION</span><b>DEV<br>WRAPPED</b><span>${year} · VOL. 01</span></div></div>${topSkills[0] ? `<div class="orbit-card one">${image(topSkills[0].icon, "")}<div><small>In the rotation</small><b>${esc(topSkills[0].name)}</b></div></div>` : ""}<div class="orbit-card two">${icon("sound")}<div><small>A growing collection</small><b>${projects.length} projects. One story.</b></div></div><span class="spark">✳</span></div></section>`;
    };
    const stats = () =>
      `<section class="stats-strip" aria-label="Portfolio at a glance">${(data
        .stats?.length
        ? data.stats.slice(0, 3)
        : [
            { value: projects.length, label: "Projects in the collection" },
            {
              value: technical.length || skills.length,
              label: "Technologies in rotation",
            },
            { value: experience.length, label: "Chapters in the journey" },
          ]
      )
        .map(
          (s) =>
            `<div class="stat-item"><strong class="stat-value">${esc(s.value)}</strong><span class="stat-label">${esc(s.label)}</span><span class="stat-note">${icon("external")}</span></div>`,
        )
        .join("")}</section>`;
    const projectSection = (full = false) => {
      const chosen = full
        ? projects
        : [
            ...projects.filter((x) => x.featured),
            ...projects.filter((x) => !x.featured),
          ].slice(0, 3);
      const categories = [...new Set(projects.flatMap((x) => x.tags || []))];
      return `<section class="section" id="selected-work">${heading("01 / THE PROJECT PLAYLIST", full ? "The full collection." : "Worth a closer look.", full ? "Different problems. Thoughtful software." : "A few favourites from the things I’ve been building.", !full ? viewLink("projects", "All projects") : "")}${full && categories.length ? `<div class="filters" role="group" aria-label="Filter projects">${["All", ...categories].map((t, i) => `<button class="filter" data-filter="${esc(t)}" aria-pressed="${i === 0}">${esc(t)}</button>`).join("")}</div><p id="filter-status" class="sr-only" role="status"></p>` : ""}<div class="projects-grid">${chosen.length ? chosen.map(projectCard).join("") : empty("The next project is taking shape. Check back soon.")}</div></section>`;
    };
    const stackRows = () =>
      topSkills
        .slice(0, 4)
        .map(
          (s, i) =>
            `<div class="tech-row"><span class="tech-rank">${number(i + 1)}</span>${skillIcon(s)}<div><strong>${esc(s.name)}</strong><span class="tech-detail">${esc(s.category)}</span></div><div class="tech-meter" aria-hidden="true">${[9, 15, 11, 23, 17, 12, 20, 14].map((h, j) => `<i style="height:${h}px;opacity:${j < 6 ? ".75" : ".25"}"></i>`).join("")}</div></div>`,
        )
        .join("");
    const about = () =>
      `<section class="about-grid" aria-label="About and toolkit"><article class="about-card"><div class="eyebrow">02 / THE PERSON BEHIND THE PROJECTS</div><h2>Curious by default.<br>Builder by choice.</h2><p>${esc(p.bio || data.intro)}</p><div class="profile-line">${avatar}<div><strong>${esc(p.name)}</strong><span>${esc(p.role)}</span></div></div></article><article class="stack-card">${heading("MY HEAVY ROTATION", "The everyday toolkit.", "", viewLink("skills", "Full stack"))}${stackRows() || empty("The toolkit is being updated.")}</article></section>`;
    const skillSection = () =>
      `<section class="section">${heading("02 / BUILT WITH", "Tools, not just buzzwords.", "The technical and human skills I bring to a project.")}<div class="skills-categories">${groups.map((g) => `<article class="skills-category"><h3>${esc(g.category)}</h3>${(g.items || []).map((s) => `<div class="tech-row">${skillIcon(s)}<strong>${esc(s.name)}</strong><span class="level">${Math.min(100, Math.max(0, Number(s.level) || 0))}%</span></div>`).join("")}</article>`).join("") || empty("Skills are being updated.")}</div><p class="fine-print">Levels are self-assessed confidence, not external certifications or measured usage.</p></section>`;
    const journey = (full = false) =>
      `<section class="section" id="journey">${heading("03 / THE CAREER TRACKLIST", "Every chapter counts.", "The work, the learning, and the people along the way.", !full ? viewLink("experience", "My journey") : "")}<div class="experience-list">${experience.map((e, i) => `<details class="experience-item" ${full && i === 0 ? "open" : ""}><summary>${url(e.image) ? image(e.image, `${e.company} visual`) : `<span class="tech-icon">${icon("experience")}</span>`}<div><h3>${esc(e.role)}</h3><p class="company">${esc(e.company)}</p></div><span class="period">${esc(e.period)}</span><span class="expand" aria-hidden="true">+</span></summary><div class="experience-body"><p>${esc(e.summary)}</p><ul>${(e.highlights || []).map((h) => `<li>${esc(h)}</li>`).join("")}</ul></div></details>`).join("") || empty("The next chapter starts here.")}</div></section>`;
    const credentials = () =>
      `<section class="section">${heading("04 / KEEP LEARNING", "A work in progress.", "Learning does not stop at the end of a project.")}<div class="cert-grid">${certificates.map((c) => `<article class="cert">${icon("certificates")}<h3>${esc(c.title)}</h3><p>${esc(c.issuer)} · ${esc(c.date)}</p>${url(c.url) ? `<a href="${esc(url(c.url))}" target="_blank" rel="noopener noreferrer">View credential ↗</a>` : ""}</article>`).join("") || empty("No certifications listed yet. In the meantime, the projects show what I’m putting into practice.")}</div></section>`;
    const contact = () =>
      `<section class="contact-banner" id="contact"><div><div class="eyebrow">NEXT UP / LET’S BUILD SOMETHING</div><h2>A good idea needs<br>a good collaborator.</h2><p>${esc(data.contactText)}</p></div><div class="contact-actions">${email ? `<a href="${contactHref}" class="btn dark">Start a conversation ${icon("external")}</a><button class="copy-email" type="button" data-copy-email>${icon("copy")} ${esc(email)}</button>` : socials.length ? `<a href="${esc(url(socials[0].url))}" class="btn dark" target="_blank" rel="noopener noreferrer">Connect with me ${icon("external")}</a>` : "<small>Contact details coming soon.</small>"}</div></section>`;
    const routeHeader = (label, title, copy) =>
      `<header class="route-header"><div class="eyebrow">${esc(label)}</div><h1>${esc(title)}</h1><p>${esc(copy)}</p></header>`;
    const pages = {
      home: () =>
        hero() + stats() + projectSection() + about() + journey() + contact(),
      projects: () =>
        routeHeader(
          "THE DEVELOPER DISCOGRAPHY",
          "Less talk. More things built.",
          "A collection of practical products, creative experiments, and problems worth solving.",
        ) +
        projectSection(true) +
        contact(),
      skills: () =>
        routeHeader(
          "IN HEAVY ROTATION",
          "The stack behind the story.",
          "Good software takes the right tools, curiosity, and a little persistence.",
        ) +
        skillSection() +
        contact(),
      experience: () =>
        routeHeader(
          "THE LONG PLAY",
          "Not an overnight story.",
          "From co-owning a hosting company to studying software engineering. Every chapter adds something.",
        ) +
        journey(true) +
        contact(),
      certificates: () =>
        routeHeader(
          "ALWAYS A STUDENT",
          "Stay curious. Keep going.",
          "A space for qualifications and milestones along the way.",
        ) +
        credentials() +
        contact(),
      contact: () =>
        routeHeader(
          "LET’S MAKE SOMETHING",
          "Your next collaborator?",
          "A project, a placement, or a conversation about an idea. I’d love to hear from you.",
        ) +
        contact() +
        `<div class="contact-profile">${avatar}<div><h2>${esc(p.name)}</h2><p>${esc(p.role)} · ${esc(p.location)}</p><div class="social-nav">${socialLinks}</div></div></div>`,
    };
    app.innerHTML = `<a class="skip" href="#main">Skip to content</a><aside class="sidebar" id="portfolio-nav" aria-label="Portfolio navigation"><a class="brand" href="${route("home")}"><span class="brand-mark">${icon("sound")}</span><span>${esc(data.siteName || "Dev Wrapped")}<small>THE DEVELOPER EDITION</small></span></a><div class="nav-label">Your next discovery</div><nav class="side-nav">${Object.keys(
      paths,
    )
      .map(
        (key) =>
          `<a href="${route(key)}" ${page === key ? 'class="active" aria-current="page"' : ""}>${icon(key)}${navLabels[key]}</a>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-bottom"><div class="mini-profile">${avatar}<div><strong>${esc(firstName)}</strong><span>${esc(p.location)}</span></div></div><div class="social-nav">${socialLinks}</div><p class="edition">INDEPENDENT PORTFOLIO / ${year}</p></div></aside><div class="page-wrap"><header class="topbar"><div class="breadcrumb"><button class="mobile-toggle" aria-label="Open navigation" aria-controls="portfolio-nav" aria-expanded="false">${icon("menu")}</button><span>Portfolio</span><span>/</span><b>${navLabels[page] || "Overview"}</b></div><a class="top-contact" href="${contactHref}">${icon("contact")} Let’s talk ${icon("external")}</a></header><main id="main" class="main">${(pages[page] || pages.home)()}<footer class="footer"><span>© ${year} ${esc(p.name || data.siteName)}. A portfolio, on repeat.</span><span><button class="footer-share" data-share>Share this portfolio ↗</button> · <a href="/admin/">Studio</a></span></footer></main></div><dialog class="dialog" id="project-dialog" aria-labelledby="project-dialog-title"></dialog><dialog class="dialog story-dialog" id="story-dialog" aria-labelledby="story-title"></dialog><div class="toast" role="status" hidden></div>`;
    const toggle = document.querySelector(".mobile-toggle");
    const sidebar = document.querySelector(".sidebar");
    const smallScreen = matchMedia("(max-width: 640px)");
    const syncNav = () => {
      const closed =
        smallScreen.matches && !document.body.classList.contains("nav-open");
      sidebar.inert = closed;
      if (closed) sidebar.setAttribute("aria-hidden", "true");
      else sidebar.removeAttribute("aria-hidden");
    };
    const closeNav = () => {
      const wasOpen = document.body.classList.contains("nav-open");
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation");
      syncNav();
      if (wasOpen) toggle.focus();
    };
    toggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute(
        "aria-label",
        open ? "Close navigation" : "Open navigation",
      );
      syncNav();
      if (open) sidebar.querySelector("a").focus();
    });
    smallScreen.addEventListener("change", () => {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      syncNav();
    });
    syncNav();
    document.addEventListener("click", (event) => {
      if (
        document.body.classList.contains("nav-open") &&
        !event.target.closest(".sidebar,.mobile-toggle")
      )
        closeNav();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeNav();
    });
    const filters = document.querySelector(".filters");
    filters?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      filters
        .querySelectorAll("button")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      let shown = 0;
      document.querySelectorAll(".project").forEach((card) => {
        const match =
          button.dataset.filter === "All" ||
          JSON.parse(card.dataset.projectTags).includes(button.dataset.filter);
        card.hidden = !match;
        if (match) shown++;
      });
      document.querySelector("#filter-status").textContent =
        `${shown} ${shown === 1 ? "project" : "projects"} shown`;
    });
    let dialogTrigger;
    const projectDialog = document.querySelector("#project-dialog");
    document.querySelectorAll("[data-project]").forEach((button) =>
      button.addEventListener("click", () => {
        dialogTrigger = button;
        const project = projects[Number(button.dataset.project)];
        projectDialog.innerHTML = `<button class="dialog-close" data-close aria-label="Close project">${icon("close")}</button>${image(project.image, `${project.title} preview`, "dialog-cover")}<div class="dialog-content"><div class="eyebrow">PROJECT ${number(Number(button.dataset.project) + 1)} / ${esc((project.tags || [])[0] || "THE COLLECTION")}</div><h2 id="project-dialog-title">${esc(project.title)}</h2><p>${esc(project.description)}</p>${/\/(milo-finance|shadow-routine)\.svg$/.test(project.image || "") ? '<p class="fine-print">Cover shown is concept artwork, not a screenshot of the current product.</p>' : ""}${tags(project)}${projectLinks(project)}</div>`;
        projectDialog.showModal();
        projectDialog
          .querySelector("[data-close]")
          .addEventListener("click", () => projectDialog.close());
      }),
    );
    const storyDialog = document.querySelector("#story-dialog");
    let storyIndex = 0;
    const top = topSkills[0];
    const stories = [
      {
        label: "01 / MEET THE DEVELOPER",
        title: `Hey, I’m ${firstName}.`,
        copy: p.role || p.bio,
        color: "var(--green)",
      },
      {
        label: "02 / THE COLLECTION",
        title: "Ideas turned into interfaces.",
        count: projects.length,
        copy: "Projects across web, mobile, and beyond. Each one starts with a problem worth solving.",
        color: "var(--purple)",
      },
      {
        label: "03 / IN THE TOOLKIT",
        title: top ? top.name : "Always learning.",
        image: top?.icon,
        copy: top
          ? `Part of a toolkit that includes ${topSkills.map((s) => s.name).join(", ")}.`
          : "Learning by building, one project at a time.",
        color: "var(--pink)",
      },
      {
        label: "04 / THE JOURNEY",
        title: experience.find((e) => e.company === "QuackHost")
          ? "It started with QuackHost."
          : "Every chapter matters.",
        copy:
          experience.find((e) => e.company === "QuackHost")?.summary ||
          experience[0]?.summary ||
          p.bio,
        color: "var(--green)",
      },
      {
        label: "05 / WHAT COMES NEXT",
        title: "Let’s build the next chapter.",
        copy: data.contactText,
        color: "var(--purple)",
      },
    ];
    function renderStory() {
      const s = stories[storyIndex];
      storyDialog.style.background = s.color;
      storyDialog.innerHTML = `<button class="dialog-close" data-close aria-label="Close story">${icon("close")}</button><div class="story-progress" aria-hidden="true">${stories.map((_, i) => `<i class="${i <= storyIndex ? "current" : ""}"></i>`).join("")}</div><div class="story-slide" aria-live="polite"><span class="eyebrow">${esc(s.label)}</span>${s.count !== undefined ? `<div class="story-number">${number(s.count)}</div>` : ""}${s.image ? image(s.image, "Technology logo") : ""}<h2 id="story-title">${esc(s.title)}</h2><p>${esc(s.copy)}</p></div><div class="story-controls"><button data-prev ${storyIndex === 0 ? "disabled" : ""}>← Previous</button><button data-next>${storyIndex === stories.length - 1 ? "Back to portfolio" : "Next chapter →"}</button></div>`;
      storyDialog.querySelector("[data-close]").onclick = () =>
        storyDialog.close();
      storyDialog.querySelector("[data-prev]").onclick = () => {
        storyIndex--;
        renderStory();
        storyDialog.querySelector("[data-prev]").focus();
      };
      storyDialog.querySelector("[data-next]").onclick = () => {
        if (storyIndex === stories.length - 1) {
          storyDialog.close();
          return;
        }
        storyIndex++;
        renderStory();
        storyDialog.querySelector("[data-next]").focus();
      };
    }
    document.querySelectorAll("[data-story]").forEach((button) =>
      button.addEventListener("click", () => {
        dialogTrigger = button;
        storyIndex = 0;
        renderStory();
        storyDialog.showModal();
      }),
    );
    storyDialog.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" && storyIndex < stories.length - 1) {
        event.preventDefault();
        storyIndex++;
        renderStory();
        storyDialog.querySelector("[data-next]").focus();
      }
      if (event.key === "ArrowLeft" && storyIndex > 0) {
        event.preventDefault();
        storyIndex--;
        renderStory();
        storyDialog.querySelector("[data-next]").focus();
      }
    });
    [projectDialog, storyDialog].forEach((dialog) => {
      dialog.addEventListener("close", () => dialogTrigger?.focus());
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          const r = dialog.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            dialog.close();
        }
      });
    });
    let toastTimer;
    function toast(message) {
      const el = document.querySelector(".toast");
      el.textContent = message;
      el.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (el.hidden = true), 4500);
    }
    document
      .querySelector("[data-copy-email]")
      ?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(email);
          toast("Email address copied. Say hello!");
        } catch {
          toast(`Email me at ${email}`);
        }
      });
    document
      .querySelector("[data-share]")
      ?.addEventListener("click", async () => {
        const link = location.origin;
        try {
          if (navigator.share)
            await navigator.share({
              title: data.siteName,
              text: data.intro,
              url: link,
            });
          else {
            await navigator.clipboard.writeText(link);
            toast("Portfolio link copied.");
          }
        } catch (error) {
          if (error.name !== "AbortError") toast(`Share this link: ${link}`);
        }
      });
    document.querySelectorAll("img").forEach((img) =>
      img.addEventListener(
        "error",
        () => {
          img.hidden = true;
        },
        { once: true },
      ),
    );
  } catch (error) {
    app.innerHTML = `<main class="loading"><h1>One more try?</h1><p>${esc(error.message || "Unable to load the portfolio.")}</p><button class="btn green" id="retry">Reload portfolio</button></main>`;
    document.querySelector("#retry").onclick = () => location.reload();
  }
})();
