#!/usr/bin/env node
// Render a scenes.json into a 1080x1920 MP4 using the canvas engine + headless Chromium + ffmpeg.
// Usage: node tools/render.mjs reels/<slug>/scenes.json [--out final.mp4] [--fps 30] [--voice voice.mp3]
//        [--music music.wav] [--still 2.5,7,12 (write PNG stills instead of video)] [--preview (540x960, 15fps)]
import { createRequire } from 'module';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { const g = execSync('npm root -g').toString().trim(); ({ chromium } = require(path.join(g, 'playwright'))); }

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const specPath = path.resolve(args[0] || '');
if (!args[0] || !fs.existsSync(specPath)) { console.error('usage: node tools/render.mjs <scenes.json> [--out file.mp4]'); process.exit(1); }
const dir = path.dirname(specPath);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const preview = flag('preview');
const fps = Number(opt('fps', preview ? 15 : (spec.fps || 30)));
const out = path.resolve(dir, opt('out', preview ? 'preview.mp4' : 'final.mp4'));
const voice = opt('voice', spec.voice && fs.existsSync(path.resolve(dir, spec.voice)) ? spec.voice : null);
const music = opt('music', spec.music && fs.existsSync(path.resolve(dir, spec.music)) ? spec.music : null);
const stills = opt('still', null);

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? {} : {});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[page error]', e.message));
await page.goto(pathToFileURL(path.join(here, 'engine', 'index.html')).href + '?capture=1');
await page.evaluate(() => document.body.classList.add('capture'));
await page.evaluate(() => window.fontsReady);
const total = await page.evaluate(s => Reel.load(s), spec);
const scale = preview ? 0.5 : 1;
console.log(`duration ${total.toFixed(2)}s, ${Math.ceil(total * fps)} frames @ ${fps}fps`);

const grab = t => page.evaluate(([t, sc]) => {
  Reel.renderAt(t);
  const c = document.getElementById('reel');
  if (sc === 1) return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  const o = document.createElement('canvas'); o.width = c.width * sc; o.height = c.height * sc;
  o.getContext('2d').drawImage(c, 0, 0, o.width, o.height); return o.toDataURL('image/jpeg', 0.85).split(',')[1];
}, [t, scale]);

if (stills) {
  for (const s of stills.split(',').map(Number)) {
    const f = path.join(dir, `still_${s.toFixed(1)}s.jpg`);
    fs.writeFileSync(f, Buffer.from(await grab(s), 'base64')); console.log('wrote', f);
  }
  await browser.close(); process.exit(0);
}

const silent = path.join(dir, '.video_noaudio.mp4');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'medium', '-crf', preview ? '26' : '18', '-pix_fmt', 'yuv420p', '-r', String(fps), silent],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const n = Math.ceil(total * fps);
for (let i = 0; i < n; i++) {
  const buf = Buffer.from(await grab(i / fps), 'base64');
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % (fps * 2) === 0) process.stdout.write(`\rframe ${i}/${n}`);
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();
console.log('\nvideo done, mixing audio…');

// Audio: voice on top, music ducked under the voice (sidechain), both trimmed to the video.
const ins = ['-i', silent]; let filter = null, maps = ['-map', '0:v'];
if (voice && music) {
  ins.push('-i', path.resolve(dir, voice), '-stream_loop', '-1', '-i', path.resolve(dir, music));
  filter = `[2:a]volume=0.35[m];[1:a]asplit=2[v1][v2];[m][v1]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=400[md];[md][v2]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[a]`;
} else if (voice) { ins.push('-i', path.resolve(dir, voice)); filter = `[1:a]loudnorm=I=-14:TP=-1.5[a]`; }
else if (music) { ins.push('-stream_loop', '-1', '-i', path.resolve(dir, music)); filter = `[1:a]afade=t=out:st=${Math.max(0, total - 1.2)}:d=1.2,loudnorm=I=-16:TP=-1.5[a]`; }
const cmd = ['-y', '-loglevel', 'error', ...ins];
if (filter) cmd.push('-filter_complex', filter, ...maps, '-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
else cmd.push(...maps);
cmd.push('-c:v', 'copy', '-t', total.toFixed(3), '-movflags', '+faststart', out);
execSync('ffmpeg ' + cmd.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' '), { stdio: 'inherit' });
fs.unlinkSync(silent);
console.log('wrote', out);
