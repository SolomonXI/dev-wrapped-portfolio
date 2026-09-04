(async function () {
  const page = document.body.dataset.page || 'home';
  const $ = (selector, root = document) => root.querySelector(selector);
  const escape = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const safeUrl = (value = '') => /^(https?:|mailto:|\/)/i.test(value) ? value : '#';
  const tags = values => (values || []).map(v => `<span class="tag">${escape(v)}</span>`).join('');
  const empty = message => `<div class="empty">${escape(message)}</div>`;

  let data;
  try {
    const response = await fetch('/api/content', { cache: 'no-store' });
    if (!response.ok) throw new Error('Content could not be loaded');
    data = await response.json();
  } catch (error) {
    $('#app').innerHTML = empty(error.message);
    return;
  }

  const profile = data.profile || {};
  document.title = `${data.siteName || 'Dev Wrapped'} — ${page[0].toUpperCase() + page.slice(1)}`;
  $('.brand').textContent = data.siteName || 'Dev Wrapped';
  $('.copyright').textContent = `© ${new Date().getFullYear()} ${profile.name || data.siteName || 'Dev Wrapped'}`;
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === page));

  const projectCard = project => `
    <article class="card project-card">
      ${project.image ? `<img class="project-image" src="${escape(safeUrl(project.image))}" alt="${escape(project.title)} project preview">` : ''}
      <div class="body">
        <h3>${escape(project.title)}</h3>
        <p>${escape(project.description)}</p>
        <div class="tags">${tags(project.tags)}</div>
        <div class="actions">
          ${project.liveUrl ? `<a class="button primary" href="${escape(safeUrl(project.liveUrl))}" target="_blank" rel="noopener">Live project ↗</a>` : ''}
          ${project.repoUrl ? `<a class="button" href="${escape(safeUrl(project.repoUrl))}" target="_blank" rel="noopener">Source ↗</a>` : ''}
        </div>
      </div>
    </article>`;

  const pages = {
    home() {
      const stats = (data.stats || []).map(s => `<div class="card stat"><strong>${escape(s.value)}</strong><span>${escape(s.label)}</span></div>`).join('');
      const featured = (data.projects || []).filter(p => p.featured).slice(0, 3);
      return `
        <section class="hero">
          <div><div class="eyebrow">${escape(data.kicker || 'Developer portfolio')}</div><h1>${escape(data.headline || profile.name || 'Your story') } <span class="gradient-text">Wrapped.</span></h1><p class="lede">${escape(data.intro || profile.bio || '')}</p><div class="socials">${(data.socials || []).map(s => `<a class="button" href="${escape(safeUrl(s.url))}" target="_blank" rel="noopener">${escape(s.label)} ↗</a>`).join('')}</div></div>
          <aside class="card avatar-card">${profile.avatar ? `<img class="avatar" src="${escape(safeUrl(profile.avatar))}" alt="${escape(profile.name)}">` : ''}<h3>${escape(profile.name)}</h3><p class="role">${escape(profile.role)}</p><p class="location">${escape(profile.location)}</p></aside>
        </section>
        <section class="section"><div class="grid grid-3">${stats || empty('Add statistics in the editor.')}</div></section>
        <section class="section"><div class="section-head"><div><div class="eyebrow">Selected work</div><h2>Featured projects</h2></div><a class="button" href="/featured_projects_wrapped_visual/">View everything →</a></div><div class="grid grid-3">${featured.length ? featured.map(projectCard).join('') : empty('Choose featured projects in the editor.')}</div></section>`;
    },
    projects() {
      const list = data.projects || [];
      return `<header><div class="eyebrow">Portfolio</div><h1>Projects <span class="gradient-text">shipped.</span></h1><p class="lede">Work, experiments, and products—all managed from one content file.</p></header><section class="section"><div class="grid grid-3">${list.length ? list.map(projectCard).join('') : empty('No projects yet.')}</div></section>`;
    },
    skills() {
      const groups = data.skills || [];
      return `<header><div class="eyebrow">Toolkit</div><h1>Skills <span class="gradient-text">mapped.</span></h1><p class="lede">The technologies and disciplines behind the work.</p></header><section class="section"><div class="grid grid-2">${groups.length ? groups.map(g => `<article class="card skill-group"><h2>${escape(g.category)}</h2><div class="skill-list">${(g.items || []).map(item => `<div class="skill-row"><strong>${escape(item.name)}</strong><span class="muted">${escape(item.level)}%</span><div class="meter"><i style="width:${Math.max(0, Math.min(100, Number(item.level) || 0))}%"></i></div></div>`).join('')}</div></article>`).join('') : empty('No skills yet.')}</div></section>`;
    },
    experience() {
      const list = data.experience || [];
      return `<header><div class="eyebrow">Career journey</div><h1>Experience <span class="gradient-text">unfolded.</span></h1><p class="lede">Roles, responsibilities, and measurable impact.</p></header><section class="section timeline">${list.length ? list.map(item => `<article class="card timeline-item"><div class="period">${escape(item.period)}</div><h2>${escape(item.role)}</h2><p class="company">${escape(item.company)}</p>${item.summary ? `<p class="muted">${escape(item.summary)}</p>` : ''}${(item.highlights || []).length ? `<ul>${item.highlights.map(h => `<li>${escape(h)}</li>`).join('')}</ul>` : ''}</article>`).join('') : empty('No experience yet.')}</section>`;
    },
    certificates() {
      const list = data.certificates || [];
      return `<header><div class="eyebrow">Credentials</div><h1>Certificates <span class="gradient-text">earned.</span></h1><p class="lede">Qualifications, courses, and professional milestones.</p></header><section class="section"><div class="grid grid-3">${list.length ? list.map(item => `<article class="card certificate"><h3>${escape(item.title)}</h3><p class="issuer">${escape(item.issuer)}</p><p class="date">${escape(item.date)}</p>${item.url ? `<a class="button" href="${escape(safeUrl(item.url))}" target="_blank" rel="noopener">View credential ↗</a>` : ''}</article>`).join('') : empty('No certificates yet.')}</div></section>`;
    },
    contact() {
      const email = profile.email || '';
      return `<header><div class="eyebrow">Contact</div><h1>Let’s build something <span class="gradient-text">memorable.</span></h1><p class="lede">${escape(data.contactText || 'Have a project or opportunity in mind? Get in touch.')}</p><div class="socials">${email ? `<a class="button primary" href="mailto:${escape(email)}">${escape(email)}</a>` : ''}${(data.socials || []).map(s => `<a class="button" href="${escape(safeUrl(s.url))}" target="_blank" rel="noopener">${escape(s.label)} ↗</a>`).join('')}</div></header>`;
    }
  };

  $('#app').innerHTML = (pages[page] || pages.home)();
})();
