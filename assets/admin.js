(async function () {
  const REPO = 'SolomonXI/dev-wrapped-portfolio';
  const BRANCH = 'main';
  const FILE = 'data/site.json';
  const editor = document.querySelector('#editor');
  const status = document.querySelector('#status');
  const tokenInput = document.querySelector('#github-token');
  let state = {};

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const field = (label, path, value = '', opts = {}) => `<label class="${opts.wide ? 'span-2' : ''}">${esc(label)}${opts.type === 'textarea' ? `<textarea data-path='${esc(JSON.stringify(path))}'>${esc(value)}</textarea>` : `<input data-path='${esc(JSON.stringify(path))}' type="${opts.type || 'text'}" value="${esc(value)}" ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''}>`}</label>`;
  const section = (title, help, body, addType = '') => `<section class="card editor-section"><header><div><h2>${esc(title)}</h2><p>${esc(help)}</p></div>${addType ? `<button class="button" type="button" data-add="${addType}">+ Add</button>` : ''}</header>${body}</section>`;
  const setStatus = (message, type = '') => { status.textContent = message; status.className = `status ${type}`; };
  const get = path => path.reduce((obj, key) => obj?.[key], state);
  const set = (path, value) => { const last = path[path.length - 1]; const target = path.slice(0, -1).reduce((obj, key) => obj[key], state); target[last] = value; };

  function renderRepeater(name, items, fields) {
    if (!items.length) return '<div class="empty">Nothing here yet. Use “Add” to create the first item.</div>';
    return `<div class="repeater">${items.map((item, index) => `<div class="repeat-item"><div class="repeat-top"><strong>${esc(item.title || item.name || item.category || item.label || item.role || `${name} ${index + 1}`)}</strong><button type="button" class="icon-button" data-remove='${esc(JSON.stringify([name,index]))}'>Remove</button></div><div class="fields">${fields(item,index)}</div></div>`).join('')}</div>`;
  }

  function render() {
    const profile = state.profile ||= {};
    state.socials ||= []; state.stats ||= []; state.projects ||= []; state.skills ||= []; state.experience ||= []; state.certificates ||= [];
    editor.innerHTML = [
      section('Site copy', 'Headlines and introductory text used on the homepage.', `<div class="fields">${field('Site name',['siteName'],state.siteName)}${field('Kicker',['kicker'],state.kicker)}${field('Headline',['headline'],state.headline,{wide:true})}${field('Introduction',['intro'],state.intro,{type:'textarea',wide:true})}${field('Contact message',['contactText'],state.contactText,{type:'textarea',wide:true})}</div>`),
      section('Profile', 'Your identity and contact details.', `<div class="fields">${field('Full name',['profile','name'],profile.name)}${field('Role',['profile','role'],profile.role)}${field('Location',['profile','location'],profile.location)}${field('Email',['profile','email'],profile.email,{type:'email'})}${field('Avatar URL',['profile','avatar'],profile.avatar,{wide:true})}${field('Short bio',['profile','bio'],profile.bio,{type:'textarea',wide:true})}</div>`),
      section('Social links', 'GitHub, LinkedIn, or any other public profile.', renderRepeater('socials',state.socials,(item,i)=>field('Label',['socials',i,'label'],item.label)+field('URL',['socials',i,'url'],item.url)), 'social'),
      section('Homepage stats', 'Short numbers or facts shown below your profile.', renderRepeater('stats',state.stats,(item,i)=>field('Value',['stats',i,'value'],item.value)+field('Label',['stats',i,'label'],item.label)), 'stat'),
      section('Projects', 'Projects can include a screenshot, live link, repository, and comma-separated tags.', renderRepeater('projects',state.projects,(item,i)=>field('Title',['projects',i,'title'],item.title)+field('Image URL',['projects',i,'image'],item.image)+field('Description',['projects',i,'description'],item.description,{type:'textarea',wide:true})+field('Live URL',['projects',i,'liveUrl'],item.liveUrl)+field('Repository URL',['projects',i,'repoUrl'],item.repoUrl)+field('Tags (comma separated)',['projects',i,'tags'],(item.tags||[]).join(', '),{wide:true})+`<label class="check-label span-2"><input data-path='${esc(JSON.stringify(['projects',i,'featured']))}' type="checkbox" ${item.featured?'checked':''}> Featured on homepage</label>`), 'project'),
      section('Skills', 'Group related skills and assign a confidence level from 0–100.', renderRepeater('skills',state.skills,(group,i)=>field('Category',['skills',i,'category'],group.category,{wide:true})+`<div class="span-2 nested"><div class="repeat-top"><strong>Skills</strong><button class="button" type="button" data-add-skill="${i}">+ Add skill</button></div>${(group.items||[]).map((skill,j)=>`<div class="fields"><label>Skill<input data-path='${esc(JSON.stringify(['skills',i,'items',j,'name']))}' value="${esc(skill.name)}"></label><label>Level<input data-path='${esc(JSON.stringify(['skills',i,'items',j,'level']))}' type="number" min="0" max="100" value="${esc(skill.level)}"></label><button type="button" class="icon-button span-2" data-remove='${esc(JSON.stringify(['skills',i,'items',j]))}'>Remove skill</button></div>`).join('') || '<p class="muted">No skills in this group yet.</p>'}</div>`), 'skillGroup'),
      section('Experience', 'Roles, dates, summary, and one achievement per line.', renderRepeater('experience',state.experience,(item,i)=>field('Role',['experience',i,'role'],item.role)+field('Company',['experience',i,'company'],item.company)+field('Period',['experience',i,'period'],item.period,{wide:true})+field('Summary',['experience',i,'summary'],item.summary,{type:'textarea',wide:true})+field('Highlights (one per line)',['experience',i,'highlights'],(item.highlights||[]).join('\n'),{type:'textarea',wide:true})), 'experience'),
      section('Certificates', 'Qualifications and links to public credentials.', renderRepeater('certificates',state.certificates,(item,i)=>field('Title',['certificates',i,'title'],item.title)+field('Issuer',['certificates',i,'issuer'],item.issuer)+field('Date',['certificates',i,'date'],item.date)+field('Credential URL',['certificates',i,'url'],item.url)), 'certificate')
    ].join('');
  }

  const templates = {
    social: { label: 'LinkedIn', url: '' }, stat: { value: '0', label: 'New statistic' },
    project: { title: 'New project', description: '', tags: [], image: '', liveUrl: '', repoUrl: '', featured: false },
    skillGroup: { category: 'New category', items: [] },
    experience: { role: 'New role', company: '', period: '', summary: '', highlights: [] },
    certificate: { title: 'New certificate', issuer: '', date: '', url: '' }
  };
  const collections = { social:'socials', stat:'stats', project:'projects', skillGroup:'skills', experience:'experience', certificate:'certificates' };

  editor.addEventListener('input', event => {
    const el = event.target;
    if (!el.dataset.path) return;
    const path = JSON.parse(el.dataset.path);
    let value = el.type === 'checkbox' ? el.checked : el.value;
    const last = path[path.length - 1];
    if (last === 'tags') value = value.split(',').map(v=>v.trim()).filter(Boolean);
    if (last === 'highlights') value = value.split('\n').map(v=>v.trim()).filter(Boolean);
    if (last === 'level') value = Math.max(0, Math.min(100, Number(value) || 0));
    set(path, value);
  });

  editor.addEventListener('click', event => {
    const add = event.target.closest('[data-add]');
    if (add) { const type=add.dataset.add; state[collections[type]].push(structuredClone(templates[type])); render(); return; }
    const addSkill = event.target.closest('[data-add-skill]');
    if (addSkill) { const group=state.skills[Number(addSkill.dataset.addSkill)]; (group.items ||= []).push({name:'New skill',level:50}); render(); return; }
    const remove = event.target.closest('[data-remove]');
    if (remove) { const path=JSON.parse(remove.dataset.remove); const index=path.pop(); get(path).splice(index,1); render(); }
  });

  async function loadPublished() {
    setStatus('Loading published content…');
    const response = await fetch(`/data/site.json?t=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error('Could not load the published content.');
    state = await response.json(); render(); setStatus('Published content loaded.', 'success');
  }

  document.querySelector('#save-draft').addEventListener('click', () => { localStorage.setItem('devwrapped-draft', JSON.stringify(state)); setStatus('Draft saved in this browser.', 'success'); });
  document.querySelector('#reset').addEventListener('click', () => loadPublished().catch(e=>setStatus(e.message,'error')));
  document.querySelector('#download').addEventListener('click', () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})); a.download='devwrapped-content.json'; a.click(); URL.revokeObjectURL(a.href); });
  document.querySelector('#import').addEventListener('change', async event => { try { state=JSON.parse(await event.target.files[0].text()); render(); setStatus('Backup imported. Review it, then publish.', 'success'); } catch { setStatus('That file is not valid JSON.', 'error'); } });

  document.querySelector('#publish').addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) { setStatus('Enter a fine-grained GitHub token first.', 'error'); tokenInput.focus(); return; }
    try {
      setStatus('Publishing to GitHub…');
      const headers = { Accept:'application/vnd.github+json', Authorization:`Bearer ${token}`, 'X-GitHub-Api-Version':'2022-11-28' };
      const current = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`, { headers });
      if (!current.ok) throw new Error(`GitHub could not read the content file (${current.status}). Check the token and repository access.`);
      const { sha } = await current.json();
      const json = JSON.stringify(state, null, 2) + '\n';
      const bytes = new TextEncoder().encode(json);
      let binary=''; bytes.forEach(b=>binary+=String.fromCharCode(b));
      const saved = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, { method:'PUT', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify({message:'Update portfolio content from editor',content:btoa(binary),sha,branch:BRANCH}) });
      if (!saved.ok) { const detail=await saved.json().catch(()=>({})); throw new Error(detail.message || `GitHub rejected the update (${saved.status}).`); }
      localStorage.removeItem('devwrapped-draft');
      setStatus('Published. Vercel is deploying the update; it usually appears within a minute.', 'success');
    } catch (error) { setStatus(error.message, 'error'); }
  });

  try {
    await loadPublished();
    const draft = localStorage.getItem('devwrapped-draft');
    if (draft && confirm('A browser draft exists. Restore it?')) { state=JSON.parse(draft); render(); setStatus('Browser draft restored.','success'); }
  } catch (error) { setStatus(error.message,'error'); }
})();
