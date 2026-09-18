import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = path.resolve(root, '..', 'film-evidence', 'runs', '2026-09-18T05-37-55.224Z-bd225e56');
const source = JSON.parse(await fs.readFile(path.join(run, 'evidence.json'), 'utf8'));
const provenance = JSON.parse(await fs.readFile(path.join(run, 'source-provenance.json'), 'utf8'));
if (source.liveAgencyFootage !== false || source.scanner.verdictsStubbed !== false) {
  throw new Error('The film requires real, unstubbed, explicitly identified offline gate evidence.');
}
const getCase = (id) => {
  const result = source.cases.find((item) => item.id === id);
  if (!result) throw new Error(`Required runtime case is missing: ${id}`);
  return result;
};
const localIntent = getCase('local-intent');
const localWork = getCase('local-work');
const outbound = getCase('outbound-evaluation-only');
const sensitive = getCase('sensitive-evaluation-only');
if (localIntent.input.prompt !== 'Get the maintenance update ready. The shift starts in two minutes.') {
  throw new Error('The recorded request differs from the film request.');
}
const receipts = [];
const destination = path.join(root, 'public', 'evidence');
await fs.mkdir(path.join(destination, 'receipts'), {recursive: true});
for (const receipt of source.receipts) {
  const bytes = await fs.readFile(receipt.path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== receipt.sha256) throw new Error(`Runtime receipt changed: ${receipt.path}`);
  await fs.copyFile(receipt.path, path.join(destination, 'receipts', path.basename(receipt.path)));
  receipts.push({file: path.basename(receipt.path), sha256: digest, records: receipt.records});
}
const pushReceipt = receipts.find((r) => r.records[0].id === outbound.checkIntent.output.id);
const sensitiveReceipt = receipts.find((r) => r.records[0].id === sensitive.output.id);
if (!pushReceipt || !sensitiveReceipt) throw new Error('A required original receipt is missing.');
const code = {};
for (const item of provenance.decidingExcerpts) code[item.symbol] = item;
const fixture = {
  kind: source.kind,
  startedAt: source.startedAt,
  run: path.basename(run),
  localIntent,
  localWork,
  outbound,
  sensitive,
  pushReceipt,
  sensitiveReceipt,
  sensitiveCheck: sensitive.output.checks.find((item) => item.gate === 'internal-label-review'),
  noOnlineCode: code['createNoOnlineWritesGate.evaluate'],
  sensitiveCode: code['reviewGate.evaluate'],
  policy: source.policy.replayPolicy,
};
await fs.writeFile(path.join(root, 'src', 'evidence.json'), JSON.stringify(fixture, null, 2));
await fs.copyFile(path.join(run, 'source-provenance.json'), path.join(destination, 'source-provenance.json'));
await fs.copyFile(path.join(run, 'transcript.txt'), path.join(destination, 'transcript.txt'));
console.log(`Imported four authentic local decisions and hash-verified receipts from ${path.basename(run)}.`);
