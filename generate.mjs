// 使い方: node generate.mjs [お題ID]   例: node generate.mjs meteor
// prompts/<お題ID>.md を有効な参加者全員に同時に送り、works/<お題ID>/ に作品HTMLを保存する。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const topic = process.argv[2] || 'meteor';
const config = JSON.parse(await readFile('config.json', 'utf8'));
const prompt = await readFile(`prompts/${topic}.md`, 'utf8');
await loadEnv('.env');

const outDir = `works/${topic}`;
await mkdir(outDir, { recursive: true });

const participants = config.participants.filter((p) => p.enabled);
if (participants.length === 0) throw new Error('config.json に enabled: true の参加者がいません');
console.log(`お題「${topic}」を ${participants.length} 体に出題します...`);

const results = await Promise.all(participants.map((p, i) => run(p, i)));
const manifestPath = `${outDir}/manifest.json`;
await writeFile(manifestPath, JSON.stringify({ topic, createdAt: new Date().toISOString(), entries: results }, null, 2));
console.log(`\n完了: ${manifestPath}\n観戦: npm run serve → http://localhost:5173/viewer/?topic=${topic}`);

async function run(p, i) {
  const id = `${String(i + 1).padStart(2, '0')}-${slug(p.model)}`;
  const started = Date.now();
  const entry = { id, name: p.name, model: p.model, file: `${id}.html` };
  try {
    const text = await chat(p, prompt);
    const html = extractHtml(text);
    await writeFile(`${outDir}/${entry.file}`, html);
    await writeFile(`${outDir}/${id}.raw.txt`, text);
    entry.ok = true;
  } catch (e) {
    entry.ok = false;
    entry.error = String(e.message || e);
    await writeFile(`${outDir}/${entry.file}`, errorPage(p.name, entry.error));
  }
  entry.seconds = Math.round((Date.now() - started) / 1000);
  console.log(`${entry.ok ? '✔' : '✘'} ${p.name} (${entry.seconds}s)${entry.ok ? '' : ' ' + entry.error}`);
  return entry;
}

async function chat(p, content) {
  const headers = { 'Content-Type': 'application/json' };
  if (p.apiKeyEnv) {
    const key = process.env[p.apiKeyEnv];
    if (!key) throw new Error(`環境変数 ${p.apiKeyEnv} が未設定です`);
    headers.Authorization = `Bearer ${key}`;
  }
  const res = await fetch(`${p.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout((config.timeoutSec ?? 300) * 1000),
    body: JSON.stringify({
      model: p.model,
      messages: [{ role: 'user', content }],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('応答が空でした');
  return text;
}

function extractHtml(text) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*(<!DOCTYPE[\s\S]*?)```/i);
  const html = (fenced ? fenced[1] : text).trim();
  if (!/<html|<!DOCTYPE|<canvas|<body/i.test(html)) throw new Error('HTMLが見つかりませんでした');
  return html;
}

function errorPage(name, message) {
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  return `<!DOCTYPE html><html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#300;color:#fcc;font:16px sans-serif;text-align:center">
<div><div style="font-size:48px">💥</div><b>${esc(name)}</b><br>生成失敗<br><small>${esc(message)}</small></div></body></html>`;
}

function slug(s) {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

async function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of (await readFile(path, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
