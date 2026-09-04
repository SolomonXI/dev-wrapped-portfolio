(async function () {
  const page = document.body.dataset.page || 'home';
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const safeUrl = (value = '') => /^(https?:|mailto:|\/)/i.test(value) ? value : '#';
  const main = document.querySelector('main');

  try {
    let data;
    if (new URLSearchParams(location.search).get('preview') === '1') {
      data = JSON.parse(sessionStorage.getItem('devwrapped-preview') || 'null');
    }
    if (!data) {
      const response = await fetch('/api/content', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load portfolio content');
      data = await response.json();
    }
    const profile = data.profile || {};
    const socials = (data.socials || []).filter(item => item.label && item.url);

    document.title = `${data.siteName || 'Dev Wrapped'} — ${page[0].toUpperCase() + page.slice(1)}`;
    document.querySelectorAll('div').forEach(el => {
      if (el.children.length === 0 && el.textContent.trim() === 'Dev Wrapped') el.textContent = data.siteName || 'Dev Wrapped';
    });
    document.querySelectorAll('footer *').forEach(el => {
      if (el.children.length === 0 && el.textContent.trim().startsWith('© ')) el.textContent = `© ${new Date().getFullYear()} ${data.siteName || 'Dev Wrapped'}. All rights reserved.`;
    });
    const currentPath = location.pathname.replace(/\/+$/, '/') || '/';
    document.querySelectorAll('nav a[href]').forEach(link => {
      const path = new URL(link.href, location.origin).pathname.replace(/\/+$/, '/') || '/';
      const active = path === currentPath;
      link.classList.toggle('text-primary', active);
      link.classList.toggle('font-bold', active);
      link.classList.toggle('border-b-2', active);
      link.classList.toggle('border-primary', active);
      link.classList.toggle('pb-1', active);
      link.classList.toggle('text-on-surface-variant', !active);
    });
    document.querySelectorAll('nav button').forEach(button => {
      button.classList.add('text-on-surface-variant');
      if (button.textContent.trim().toLowerCase().includes('contact')) button.addEventListener('click', () => { location.href = '/contact_me/'; });
    });
    document.querySelectorAll('footer a').forEach(link => {
      const match = socials.find(item => item.label.toLowerCase() === link.textContent.trim().toLowerCase());
      if (match) { link.href = safeUrl(match.url); link.target = '_blank'; link.rel = 'noopener'; }
      if (link.textContent.trim().toLowerCase() === 'email' && profile.email) link.href = `mailto:${profile.email}`;
    });

    const renderers = {
      home() {
        const sections = [...main.children].filter(el => el.tagName === 'SECTION');
        const hero = sections[0];
        const bento = sections[1];
        hero.querySelector('h1').innerHTML = `${esc(data.headline || profile.name || 'Your developer story')} <span class="text-primary">Wrapped</span>`;
        hero.querySelector('p').textContent = data.intro || profile.bio || '';

        const profileCard = bento.children[0];
        const image = profileCard.querySelector('img');
        if (profile.avatar) { image.src = safeUrl(profile.avatar); image.alt = profile.name || 'Profile photo'; }
        profileCard.querySelector('h2').textContent = profile.name || 'Add your name';
        const profileParagraphs = profileCard.querySelectorAll('p');
        if (profileParagraphs[0]) profileParagraphs[0].textContent = profile.role || 'Add your role';
        if (profileParagraphs[1]) profileParagraphs[1].textContent = profile.bio || 'Add a short bio from the editor.';
        const locationIcon = profileCard.querySelector('.material-symbols-outlined');
        if (locationIcon?.parentElement) locationIcon.parentElement.lastChild.textContent = ` ${profile.location || 'Add your location'}`;
        const chipRow = [...profileCard.querySelectorAll('div')].find(el => el.classList.contains('flex-wrap'));
        const allSkills = (data.skills || []).flatMap(group => group.items || []);
        if (chipRow) chipRow.innerHTML = allSkills.slice(0, 4).map(item => `<span class="bg-[#282828]/80 px-3 py-1 rounded-full font-label-bold text-[12px]">${esc(item.name)}</span>`).join('') || '<span class="text-on-surface-variant text-sm">Add skills in the editor</span>';

        const highlights = bento.children[1];
        const techCard = highlights.children[0];
        const techList = [...techCard.children].find(el => el.classList.contains('flex-col') && el.classList.contains('gap-3'));
        if (techList) techList.innerHTML = allSkills.slice(0, 4).map(item => `<div class="flex items-center gap-4"><span class="font-label-bold text-label-bold w-16 truncate">${esc(item.name)}</span><div class="flex-grow h-1 bg-surface-container-high rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-secondary to-tertiary-container rounded-full" style="width:${Math.max(0, Math.min(100, Number(item.level) || 0))}%"></div></div></div>`).join('') || '<p class="text-on-surface-variant">Add skills to see your top technologies.</p>';

        const stats = data.stats || [];
        const impactCard = highlights.children[1];
        const primaryStat = stats[0] || { value: '0', label: 'Portfolio stat' };
        const secondaryStat = stats[1] || { value: '0', label: 'More to add' };
        impactCard.querySelector('.font-stats-number').textContent = primaryStat.value;
        const impactLabels = [...impactCard.querySelectorAll('div')].filter(el => el.children.length === 0 && el.className.includes('font-label-bold'));
        if (impactLabels[0]) impactLabels[0].textContent = primaryStat.label;
        const secondaryValue = impactCard.querySelector('.font-headline-md');
        if (secondaryValue) secondaryValue.textContent = secondaryStat.value;
        const secondaryLabel = secondaryValue?.nextElementSibling;
        if (secondaryLabel) secondaryLabel.textContent = secondaryStat.label;

        const categoryCard = highlights.children[2];
        const category = (data.skills || [])[0];
        const categoryTitle = categoryCard.querySelector('.font-headline-lg-mobile');
        if (categoryTitle) categoryTitle.textContent = category?.category || 'Your strongest category';
        const categoryCopy = categoryCard.querySelector('p');
        if (categoryCopy) categoryCopy.textContent = category ? `${category.items?.length || 0} skills tracked in ${category.category}.` : 'Add skill groups from the editor to complete this card.';

        const share = sections[3]?.querySelector('button');
        if (share) share.addEventListener('click', async () => {
          const payload = { title: data.siteName || 'Dev Wrapped', text: data.intro || '', url: location.href };
          if (navigator.share) await navigator.share(payload).catch(() => {});
          else await navigator.clipboard?.writeText(location.href);
        });
      },

      projects() {
        const header = main.querySelector('header');
        const intro = header?.querySelector('p');
        if (intro) intro.textContent = data.intro || 'The highlights of my engineering journey.';
        const projects = data.projects || [];
        const grid = [...main.children].find(el => el.classList.contains('grid') && el.querySelector('article'));
        const filters = [...main.children].find(el => el.querySelector?.('.filter-btn'));
        const card = (project, index) => {
          const href = safeUrl(project.liveUrl || project.repoUrl || '#');
          return `<article data-tags="${esc((project.tags || []).join('|').toLowerCase())}" class="project-card rounded-xl p-[1px] bg-surface-container/80 backdrop-blur-md relative overflow-hidden group bg-surface-container/90"><div class="project-card-inner bg-surface-container/90 rounded-xl h-full flex flex-col z-10 relative transition-colors duration-300 overflow-hidden">${project.image ? `<a class="block relative h-48 w-full overflow-hidden" href="${esc(href)}" target="_blank" rel="noopener"><img alt="${esc(project.title)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="${esc(safeUrl(project.image))}">${project.featured ? '<span class="absolute top-4 right-4 bg-primary/20 text-primary px-3 py-1 rounded-full font-label-bold text-[12px] uppercase tracking-wider flex items-center gap-1 border border-primary/30 backdrop-blur-sm"><span class="material-symbols-outlined text-xs">star</span>Featured</span>' : ''}</a>` : ''}<div class="p-card-padding flex flex-col flex-grow hover:bg-white/5 transition-colors"><h3 class="font-headline-md text-headline-md text-on-surface mb-2 group-hover:text-primary transition-colors">${esc(project.title || `Project ${index + 1}`)}</h3><p class="font-body-md text-body-md text-on-surface-variant flex-grow mb-6">${esc(project.description)}</p><div class="flex flex-wrap gap-2 mb-6">${(project.tags || []).map(tag => `<span class="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full font-label-bold text-[12px]">${esc(tag)}</span>`).join('')}</div><div class="flex gap-4 mt-auto pt-4 border-t border-white/5">${project.liveUrl ? `<a href="${esc(safeUrl(project.liveUrl))}" target="_blank" rel="noopener" class="text-primary flex items-center gap-1 font-label-bold text-label-bold">Live Demo <span class="material-symbols-outlined text-sm">arrow_forward</span></a>` : ''}${project.repoUrl ? `<a href="${esc(safeUrl(project.repoUrl))}" target="_blank" rel="noopener" class="text-secondary flex items-center gap-1 font-label-bold text-label-bold">Source</a>` : ''}</div></div></div></article>`;
        };
        grid.innerHTML = projects.length ? projects.map(card).join('') : '<div class="md:col-span-2 lg:col-span-3 glass-panel p-8 rounded-2xl text-center text-on-surface-variant">No projects yet. Add your first project from the editor.</div>';
        const topTags = [...new Set(projects.flatMap(p => p.tags || []))].slice(0, 3);
        filters.innerHTML = ['All', ...topTags].map((tag, i) => `<button data-filter="${esc(tag.toLowerCase())}" class="filter-btn ${i === 0 ? 'active' : ''} px-6 py-2 rounded-full font-label-bold text-label-bold border border-outline-variant transition-colors hover:border-primary glass-panel">${esc(tag)}</button>`).join('');
        filters.addEventListener('click', event => {
          const button = event.target.closest('[data-filter]'); if (!button) return;
          filters.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === button));
          grid.querySelectorAll('article').forEach(article => { article.hidden = button.dataset.filter !== 'all' && !article.dataset.tags.split('|').includes(button.dataset.filter); });
        });
      },

      skills() {
        const header = main.querySelector('header');
        const headerCopy = header?.querySelector('p');
        if (headerCopy) headerCopy.textContent = 'A data-driven breakdown of the technologies behind my work.';
        const grid = [...main.children].find(el => el.classList.contains('grid'));
        const groups = data.skills || [];
        const all = groups.flatMap(group => (group.items || []).map(item => ({...item, category: group.category})));
        if (!all.length) { grid.innerHTML = '<div class="lg:col-span-12 glass-panel p-8 rounded-2xl text-center text-on-surface-variant">No skills yet. Add skills from the editor.</div>'; return; }
        const technical = all.filter(item => /technical|technology|development|engineering/i.test(item.category || ''));
        const top = [...(technical.length ? technical : all)].sort((a,b) => Number(b.level)-Number(a.level))[0];
        const initials = name => name.split(/\s+|\./).filter(Boolean).map(part=>part[0]).join('').slice(0,3).toUpperCase();
        const overview = all.slice(0, 6).map((item, i) => `<div class="bg-surface-container-low rounded-lg p-6 glass-panel glow-card transition-all duration-300 flex justify-between items-center group"><div class="flex items-center gap-4"><div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-${i%2?'secondary':'primary'} font-bold text-xl">${esc(initials(item.name))}</div><span class="font-body-lg text-body-lg font-bold text-on-surface">${esc(item.name)}</span></div><span class="font-label-bold text-label-bold px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant border border-white/5">${esc(item.level)}%</span></div>`).join('');
        const categoryCards = groups.map((group, i) => `<div class="bg-surface-container-low rounded-xl p-card-padding glass-panel glow-card transition-all duration-300"><div class="flex items-center gap-3 mb-6"><div class="w-10 h-10 rounded-full bg-${i%3===0?'primary':i%3===1?'secondary':'tertiary'}/10 flex items-center justify-center"><span class="material-symbols-outlined text-${i%3===0?'primary':i%3===1?'secondary':'tertiary'}">code</span></div><h4 class="font-headline-md text-headline-md text-on-surface">${esc(group.category)}</h4></div><ul class="space-y-4">${(group.items || []).map((item,j) => `<li class="flex items-center justify-between ${j < group.items.length-1 ? 'pb-4 border-b border-white/5' : ''}"><span class="font-body-md text-body-md font-bold text-white">${esc(item.name)}</span><div class="h-1 bg-gradient-to-r from-primary to-secondary rounded-full" style="width:${Math.max(24, Math.round((Number(item.level)||0)*.64))}px"></div></li>`).join('')}</ul></div>`).join('');
        grid.innerHTML = `<div class="lg:col-span-5 bg-surface-container-low rounded-xl p-card-padding flex flex-col items-center justify-center highlight-glow relative overflow-hidden group"><div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50"></div><div class="relative z-10 text-center flex flex-col items-center gap-6"><h2 class="font-headline-md text-headline-md text-on-surface">Most Used Tech</h2><div class="w-32 h-32 rounded-2xl bg-surface-container flex items-center justify-center border border-primary/30 shadow-[0_0_40px_rgba(83,224,118,0.4)]"><span class="font-display-xl text-display-xl text-primary">${esc(initials(top.name))}</span></div><div class="mt-4"><p class="font-stats-number text-stats-number text-white">${esc(top.name)}</p><p class="font-label-bold text-label-bold text-primary mt-2 uppercase tracking-widest">${esc(top.category)}</p></div></div></div><div class="lg:col-span-7 flex flex-col gap-6"><h3 class="font-headline-md text-headline-md text-on-surface flex items-center gap-3"><span class="material-symbols-outlined text-secondary">code</span>Skills Overview</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-4">${overview}</div></div><div class="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-gutter mt-8">${categoryCards}</div>`;
      },

      experience() {
        const outer = main.firstElementChild;
        const roles = data.experience || [];
        const header = outer.children[0];
        const copy = header.querySelector('p');
        if (copy) copy.textContent = 'Reliving the commits, the lessons, and the work that shaped my career.';
        const stat = outer.children[1];
        stat.querySelector('h2').textContent = roles.length;
        stat.querySelector('p').textContent = roles.length === 1 ? 'Role Added' : 'Roles Added';
        const timeline = outer.children[2];
        const colors = ['tertiary-container','secondary','primary'];
        const roleHtml = (item, i) => {
          const color = colors[i % colors.length]; const reverse = i % 2 === 1;
          const highlights = (item.highlights || []).map(h => `<li class="flex items-start gap-3"><span class="material-symbols-outlined text-${color} mt-1">bolt</span><span class="font-body-md text-body-md text-on-surface-variant">${esc(h)}</span></li>`).join('');
          const companyVisual = item.image
            ? `<img class="w-12 h-12 rounded-lg object-cover border border-white/10 shadow-lg" src="${esc(safeUrl(item.image))}" alt="${esc(item.company || item.role)} visual">`
            : `<div class="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-${color} font-bold">${esc((item.company||'?').slice(0,1).toUpperCase())}</div>`;
          return `<div class="relative z-10 flex flex-col ${reverse?'md:flex-row-reverse':'md:flex-row'} items-center justify-between w-full mb-16 md:mb-24 group"><div class="hidden md:block w-5/12 ${reverse?'text-left pl-12':'text-right pr-12'}"><p class="font-label-bold text-label-bold text-${color} mb-2">${esc(item.period)}</p><h3 class="font-headline-lg text-headline-lg text-white">${esc(item.role)}</h3></div><div class="absolute left-8 md:left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full bg-surface border-4 border-${color} z-20"></div><div class="w-full md:w-5/12 pl-20 ${reverse?'md:pr-12 md:pl-0 text-left md:text-right':'md:pl-12'}"><div class="md:hidden mb-2"><p class="font-label-bold text-label-bold text-${color}">${esc(item.period)}</p><h3 class="font-headline-md text-headline-md text-white">${esc(item.role)}</h3></div><div class="bg-surface-container rounded-xl p-card-padding border border-white/5 hover:bg-surface-bright transition-colors duration-300 shadow-xl ${reverse?'text-left md:text-right':''}"><div class="flex items-center gap-4 mb-4 ${reverse?'flex-row md:flex-row-reverse':''}">${companyVisual}<h4 class="font-headline-md text-headline-md text-on-surface">${esc(item.company)}</h4></div>${item.summary?`<p class="font-body-md text-body-md text-on-surface-variant mb-4">${esc(item.summary)}</p>`:''}<ul class="space-y-3 ${reverse?'inline-block text-left':''}">${highlights}</ul></div></div></div>`;
        };
        timeline.innerHTML = '<div class="absolute left-8 md:left-1/2 transform md:-translate-x-1/2 top-0 bottom-0 timeline-line z-0"></div>' + (roles.length ? roles.map(roleHtml).join('') : '<div class="relative z-10 bg-surface-container p-8 rounded-xl text-center text-on-surface-variant">No experience yet. Add your first role from the editor.</div>');
      },

      certificates() {
        const sections = [...main.children].filter(el => el.tagName === 'SECTION');
        const certificates = data.certificates || [];
        sections[0].querySelector('p').textContent = 'A curated history of certifications and continuous learning milestones.';
        const year = String(new Date().getFullYear());
        const issuers = new Set(certificates.map(c=>c.issuer).filter(Boolean)).size;
        const linked = certificates.filter(c=>c.url).length;
        const metrics = [[certificates.length,'Total Certs','workspace_premium','primary'],[issuers,'Issuers','business','secondary'],[certificates.filter(c=>String(c.date).includes(year)).length,'This Year','calendar_today','tertiary'],[linked,'Verified Links','verified','primary-fixed']];
        sections[1].innerHTML = metrics.map(m=>`<div class="bg-surface-container-low p-card-padding rounded-xl border border-white/5 flex flex-col items-center md:items-start cert-card-glow transition-all duration-300"><span class="material-symbols-outlined text-${m[3]} text-3xl mb-2">${m[2]}</span><span class="font-stats-number text-stats-number text-on-background">${m[0]}</span><span class="font-label-bold text-label-bold text-on-surface-variant uppercase mt-1">${m[1]}</span></div>`).join('');
        sections[2].innerHTML = certificates.length ? certificates.map((item,i)=>`<div class="group relative bg-[#181818] p-card-padding rounded-xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:bg-[#282828] transition-all duration-300">${i===0?'<div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-secondary-container rounded-l-xl"></div>':''}<div class="flex items-center gap-6 w-full md:w-auto"><div class="w-16 h-16 bg-surface-container flex items-center justify-center rounded-lg flex-shrink-0 border border-white/5"><span class="material-symbols-outlined text-${i%2?'secondary':'primary'} text-4xl">workspace_premium</span></div><div class="flex flex-col gap-1"><h3 class="font-headline-md text-headline-md text-on-background group-hover:text-primary transition-colors">${esc(item.title)}</h3><p class="font-body-md text-body-md text-on-surface-variant">${esc(item.issuer)}</p><div class="flex items-center gap-3 mt-2"><span class="font-label-bold text-label-bold bg-[#282828] text-on-surface-variant px-3 py-1 rounded-full text-xs">${esc(item.date)}</span></div></div></div>${item.url?`<a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener" class="w-full md:w-auto bg-transparent border border-white/20 text-on-background font-label-bold text-label-bold px-6 py-2 rounded-full hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">Verify <span class="material-symbols-outlined text-[18px]">verified</span></a>`:''}</div>`).join('') : '<div class="bg-[#181818] p-card-padding rounded-xl border border-white/10 text-center text-on-surface-variant">No certificates yet. Add one from the editor.</div>';
      },

      contact() {
        const copy = main.querySelector('h1')?.nextElementSibling;
        if (copy) copy.textContent = data.contactText || 'Let’s build something legendary together.';
        const form = main.querySelector('form');
        form.addEventListener('submit', event => {
          event.preventDefault();
          if (!profile.email) { alert('Add your contact email in the editor first.'); return; }
          const values = new FormData(form);
          const subject = encodeURIComponent(`Portfolio message from ${values.get('name') || 'a visitor'}`);
          const body = encodeURIComponent(`From: ${values.get('name')} <${values.get('email')}>\n\n${values.get('message')}`);
          location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
        });
        const socialRow = [...main.querySelectorAll('div')].find(el => el.classList.contains('mt-16') && el.classList.contains('justify-center'));
        if (socialRow) socialRow.innerHTML = socials.map(item => `<a title="${esc(item.label)}" class="text-on-surface-variant hover:text-primary transition-colors transform hover:-translate-y-1 duration-300 flex items-center justify-center min-w-12 h-12 px-4 rounded-full glass-panel hover:bg-surface-variant" href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener"><span class="font-label-bold text-label-bold">${esc(item.label)}</span></a>`).join('');
      }
    };

    (renderers[page] || renderers.home)();
  } catch (error) {
    console.error(error);
    if (main) main.innerHTML = `<div class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-section-gap text-on-surface-variant">${esc(error.message)}</div>`;
  } finally {
    document.body.classList.remove('content-loading');
  }
})();
