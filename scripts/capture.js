import { spawnSync } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const mode = process.argv[2] ?? 'mock';
if (!['mock','ollama'].includes(mode)) throw new Error('使用 mock 或 ollama');
const out = join('examples', mode);
await mkdir(out, {recursive:true});
const names = (await readdir('examples/inputs')).filter(name => name.endsWith('.json')).sort();
for (const name of names) {
  const start = performance.now();
  const result = spawnSync(process.execPath, ['src/cli.js','--mode',mode,'--input',join('examples/inputs', name)], {
    encoding:'utf8', timeout: 900000,
  });
  if (result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  const parsed = JSON.parse(result.stdout);
  await writeFile(join(out, name), JSON.stringify({...parsed, elapsedMs: Math.round(performance.now() - start)}, null, 2) + '\n');
  console.log(name, parsed.status, parsed.reason ?? '');
}
