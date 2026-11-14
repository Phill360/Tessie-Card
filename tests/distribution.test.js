import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildBundle } from '../scripts/build.mjs';
test('HACS points to a reproducible single file with both image states embedded', async () => {
  const root = new URL('../', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('hacs.json', root), 'utf8'));
  assert.equal(manifest.content_in_root, true);
  assert.equal(manifest.filename, 'tessie-card.js');
  const artifact = await readFile(new URL(manifest.filename, root), 'utf8');
  assert.equal(artifact, await buildBundle());
  assert.equal((artifact.match(/data:image\/png;base64,/g) || []).length, 2);
  assert.doesNotMatch(artifact, /new URL\([^\n]*assets\//);
  const { VERSION, tariffRate } = await import('../tessie-card.js');
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(VERSION, pkg.version);
  assert.equal(tariffRate({ state: '30', attributes: { unit_of_measurement: 'c/kWh' } }, 'AUD'), .3);
});
