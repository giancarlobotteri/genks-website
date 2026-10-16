import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {renderGenksAuthEmail} from '../src/lib/email-design.ts';

const directory=path.resolve('supabase/email-templates');
const templates=JSON.parse(await fs.readFile(path.join(directory,'source.json'),'utf8'));
const links=html=>[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]);
const variables=html=>[...html.matchAll(/{{[\s\S]*?}}/g)].map(match=>match[0]).sort();
for(const template of templates){
  assert.match(template.name,/^[a-z-]+$/);
  const rendered=renderGenksAuthEmail(template.html);
  for(const link of links(template.html))assert.ok(links(rendered).includes(link),'Authentication links must remain unchanged');
  assert.deepEqual(variables(rendered),variables(template.html),'All authentication variables must be preserved');
  await fs.writeFile(path.join(directory,`${template.name}.html`),rendered);
}
console.log(`Generated ${templates.length} blue-and-white authentication templates; links and placeholders preserved.`);
