import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = 'https://dev-wrapped-portfolio.vercel.app';
for(const path of ['/admin','/admin/','/admin/index.html','/api/studio']) {
  const response=await fetch(base+path,{redirect:'manual'});
  assert.equal(response.status,303,path);assert.equal(new URL(response.headers.get('location'),base).pathname,'/');
}
for(const path of ['/lib/studio.html','/lib/auth.js','/api/media?key=content/site.json']) assert.equal((await fetch(base+path)).status,404,path);
for(const path of ['/admin_manage_skills/','/admin_login_mfa/index.html']) {const r=await fetch(base+path,{redirect:'manual'});assert.equal(r.status,307,path);}
// No credentials are sent, so these requests must never reach storage writes.
assert.equal((await fetch(base+'/api/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
assert.equal((await fetch(base+'/api/media',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['/','/featured_projects_wrapped_visual/','/skills_wrapped/','/experience_wrapped/','/certificates_wrapped/','/contact_me/']) {
  await page.goto(base+path,{waitUntil:'networkidle'});await page.locator('#main').waitFor();assert.equal(await page.locator('h1').count(),1,path);
 }
 await page.locator('.owner-entry').click();await page.getByRole('heading',{name:'Your story. Your studio.'}).waitFor();await page.getByLabel('Admin password').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: live public pages, owner sign-in dialog, protected routes, private-file exclusion, and unauthorized write rejection. No production content changed.');
} finally {await browser.close();}
