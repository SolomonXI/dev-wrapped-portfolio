(async function () {
  const editor = document.querySelector('#editor');
  const status = document.querySelector('#status');
  const previewFrame = document.querySelector('#preview-frame');
  const loggedOut = document.querySelector('#logged-out');
  const loggedIn = document.querySelector('#logged-in');
  let state = {};
  let authenticated = false;
  let previewTimer;

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const field = (label, path, value = '', opts = {}) => `<label class="${opts.wide ? 'span-2' : ''}">${esc(label)}${opts.type === 'textarea' ? `<textarea data-path='${esc(JSON.stringify(path))}'>${esc(value)}</textarea>` : `<input data-path='${esc(JSON.stringify(path))}' type="${opts.type || 'text'}" value="${esc(value)}" ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''}>`}</label>`;
  const section = (title, help, body, addType = '') => `<section class="card editor-section"><header><div><h2>${esc(title)}</h2><p>${esc(help)}</p></div>${addType ? `<button class="button" type="button" data-add="${addType}">+ Add</button>` : ''}</header>${body}</section>`;
  const setStatus = (message, type = '') => { status.textContent = message; status.className = `status ${type}`; };
  const get = path => path.reduce((obj, key) => obj?.[key], state);
  const set = (path, value) => { const last = path[path.length - 1]; const target = path.slice(0, -1).reduce((obj, key) => obj[key], state); target[last] = value; };
  const updatePreview = (immediate = false) => {
    clearTimeout(previewTimer);
    const refresh = () => {
      sessionStorage.setItem('devwrapped-preview', JSON.stringify(state));
      previewFrame.src = `/?preview=1&t=${Date.now()}`;
    };
    if (immediate) refresh(); else previewTimer = setTimeout(refresh, 350);
  };

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
    updatePreview();
  });

  editor.addEventListener('click', event => {
    const add = event.target.closest('[data-add]');
    if (add) { const type=add.dataset.add; state[collections[type]].push(structuredClone(templates[type])); render(); updatePreview(true); return; }
    const addSkill = event.target.closest('[data-add-skill]');
    if (addSkill) { const group=state.skills[Number(addSkill.dataset.addSkill)]; (group.items ||= []).push({name:'New skill',level:50}); render(); updatePreview(true); return; }
    const remove = event.target.closest('[data-remove]');
    if (remove) { const path=JSON.parse(remove.dataset.remove); const index=path.pop(); get(path).splice(index,1); render(); updatePreview(true); }
  });

  async function loadPublished() {
    setStatus('Loading published content…');
    const response = await fetch(`/api/content?t=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error('Could not load the published content.');
    state = await response.json(); render(); updatePreview(true); setStatus('Published content loaded. Changes below update the preview instantly.', 'success');
  }

  function showSession(isAuthenticated) {
    authenticated = isAuthenticated;
    loggedOut.hidden = authenticated;
    loggedIn.hidden = !authenticated;
  }

  async function checkSession() {
    const response = await fetch('/api/admin-auth', { cache:'no-store' });
    const result = response.ok ? await response.json() : { authenticated:false };
    showSession(Boolean(result.authenticated));
    return Boolean(result.authenticated);
  }

  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const password = document.querySelector('#admin-password').value;
    setStatus('Signing in…');
    const response = await fetch('/api/admin-auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password}) });
    const result = await response.json().catch(()=>({}));
    if (!response.ok) { setStatus(result.error || 'Sign-in failed.', 'error'); return; }
    document.querySelector('#admin-password').value = '';
    showSession(true);
    setStatus('Signed in. You can now save changes directly.', 'success');
  });

  document.querySelector('#logout').addEventListener('click', async () => {
    await fetch('/api/admin-auth', { method:'DELETE' });
    showSession(false);
    setStatus('Signed out.', 'success');
  });

  document.querySelector('#save-draft').addEventListener('click', () => { localStorage.setItem('devwrapped-draft', JSON.stringify(state)); updatePreview(true); setStatus('Draft saved in this browser and shown in the preview. Use Save & publish to update the public site.', 'success'); });
  document.querySelector('#reset').addEventListener('click', () => loadPublished().catch(e=>setStatus(e.message,'error')));
  document.querySelector('#download').addEventListener('click', () => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})); a.download='devwrapped-content.json'; a.click(); URL.revokeObjectURL(a.href); });
  document.querySelector('#import').addEventListener('change', async event => { try { state=JSON.parse(await event.target.files[0].text()); render(); updatePreview(true); setStatus('Backup imported and displayed in the preview. Review it, then publish.', 'success'); } catch { setStatus('That file is not valid JSON.', 'error'); } });

  document.querySelector('#publish').addEventListener('click', async () => {
    if (!authenticated) { showSession(false); setStatus('Sign in before saving.', 'error'); return; }
    try {
      setStatus('Saving changes…');
      const saved = await fetch('/api/content', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(state) });
      const result = await saved.json().catch(()=>({}));
      if (saved.status === 401) { showSession(false); throw new Error('Your session expired. Please sign in again.'); }
      if (!saved.ok) throw new Error(result.error || 'The changes could not be saved.');
      localStorage.removeItem('devwrapped-draft');
      updatePreview(true);
      setStatus('Saved successfully — the public website is now showing these changes.', 'success');
    } catch (error) { setStatus(error.message, 'error'); }
  });

  try {
    await checkSession();
    await loadPublished();
    const draft = localStorage.getItem('devwrapped-draft');
    if (draft && confirm('A browser draft exists. Restore it?')) { state=JSON.parse(draft); render(); updatePreview(true); setStatus('Browser draft restored. Use Save & publish to update the public website.','success'); }
  } catch (error) { setStatus(error.message,'error'); }
})();
