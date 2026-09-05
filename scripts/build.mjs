import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out = new URL('../public/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
// Only public portfolio pages/assets enter the static output. Never copy lib/, API sources, or legacy editor HTML.
for (const name of ['index.html','assets','featured_projects_wrapped_visual','skills_wrapped','experience_wrapped','certificates_wrapped','contact_me']) {
  await cp(new URL('../'+name, import.meta.url),new URL(name,out),{recursive:true});
}
console.log('Public portfolio built at '+fileURLToPath(out));
