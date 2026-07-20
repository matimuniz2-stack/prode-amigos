// ONE-OFF: genera "La película del prode" — el video-resumen FINAL del torneo
// (bar chart race partido a partido + resolución de globales + coronación del
// campeón). Variante de cierre de one-off-carrera-video.mjs.
// Uso: node scripts/one-off-pelicula-final.mjs
// Requiere: pg (devDep), @napi-rs/canvas (instalado con --no-save), ffmpeg en PATH.
// Salida: public/pelicula-del-prode.mp4 (se commitea) + copia en el Escritorio.
import { readFileSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { createCanvas, loadImage } from "@napi-rs/canvas";

// ---------- config ----------
const W = 1080;
const H = 1920;
const FPS = 30;
const INTRO_FRAMES = 60; // 2s de placa inicial
const ANIM_FRAMES = 10; // transición entre partidos (más rápido que la versión de mitad de torneo)
const HOLD_FRAMES = 4; // pausa con el resultado puesto
const GLOBALS_ANIM = 40; // la resolución de las globales, en cámara lenta
const GLOBALS_HOLD = 50;
const TABLE_FINAL_FRAMES = 120; // 4s con la tabla final
const CHAMP_FRAMES = 180; // 6s de coronación
const OUT = path.join(process.cwd(), "public", "pelicula-del-prode.mp4");
const OUT_DESKTOP = path.join(homedir(), "OneDrive", "Escritorio", "la-pelicula-del-prode.mp4");

const STAGE_LABELS = {
  group: "Fase de grupos",
  r32: "Dieciseisavos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinales",
  tp: "Tercer puesto",
  final: "LA FINAL",
};

const COLORS = [
  "#f59e0b", "#ef4444", "#3b82f6", "#22c55e", "#a855f7",
  "#ec4899", "#14b8a6", "#f97316", "#38bdf8",
];

// ---------- env / db ----------
function loadEnv() {
  let txt = "";
  try {
    txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {}
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: players } = await client.query(`
  select id, nickname, avatar_url from public.profiles
  where role <> 'spectator' order by lower(nickname)
`);
const { rows: matches } = await client.query(`
  select m.id, m.match_number, m.kickoff_at, m.score_home, m.score_away,
         th.name as home_name, ta.name as away_name, s.code as stage_code
  from public.matches m
  join public.stages s on s.id = m.stage_id
  join public.teams th on th.id = m.home_team_id
  join public.teams ta on ta.id = m.away_team_id
  where m.status = 'finished'
  order by m.kickoff_at, m.match_number
`);
const { rows: pts } = await client.query(`
  select user_id, source_id, sum(points)::int as points
  from public.points_log where source_kind = 'match'
  group by user_id, source_id
`);
const { rows: globalPts } = await client.query(`
  select user_id, sum(points)::int as points
  from public.points_log where source_kind = 'global'
  group by user_id
`);
await client.end();

const pIdx = new Map(players.map((p, i) => [p.id, i]));
const byMatch = new Map(); // match_id -> int[] por jugador
for (const r of pts) {
  const i = pIdx.get(r.user_id);
  if (i === undefined) continue;
  if (!byMatch.has(r.source_id)) byMatch.set(r.source_id, players.map(() => 0));
  byMatch.get(r.source_id)[i] += r.points;
}

// ---------- pasos acumulados + ranking por paso ----------
const dayFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  weekday: "long", day: "numeric", month: "long",
});
const steps = [{ totals: players.map(() => 0), title: "Arranca el Mundial", sub: "todos en cero, todos ilusionados" }];
let acc = players.map(() => 0);
for (let i = 0; i < matches.length; i++) {
  const m = matches[i];
  const delta = byMatch.get(m.id) ?? players.map(() => 0);
  acc = acc.map((v, j) => v + delta[j]);
  steps.push({
    totals: acc,
    title: `${m.home_name} ${m.score_home} - ${m.score_away} ${m.away_name}`,
    sub: `${STAGE_LABELS[m.stage_code] ?? m.stage_code} · ${dayFmt.format(new Date(m.kickoff_at))} · partido ${i + 1}/${matches.length}`,
    slow: m.stage_code === "final",
  });
}
// Paso extra: se resuelven las globales (campeón, goleador...) → tabla real.
const globalsDelta = players.map(() => 0);
for (const r of globalPts) {
  const i = pIdx.get(r.user_id);
  if (i !== undefined) globalsDelta[i] = r.points;
}
acc = acc.map((v, j) => v + globalsDelta[j]);
steps.push({
  totals: acc,
  title: "Se pagan las globales",
  sub: "campeón, subcampeón y goleador · el último golpe de puntos",
  globals: true,
});

// orden (índice de fila) por paso: puntos desc, después nombre (estable)
const rankOf = steps.map((s) =>
  players
    .map((_, j) => j)
    .sort((a, b) => s.totals[b] - s.totals[a] || players[a].nickname.localeCompare(players[b].nickname))
    .reduce((m, j, pos) => ((m[j] = pos), m), players.map(() => 0)),
);

const finalTotals = steps[steps.length - 1].totals;
const champIdx = finalTotals.indexOf(Math.max(...finalTotals));
const champ = players[champIdx];

// ---------- avatares ----------
const avatars = await Promise.all(
  players.map(async (p) => {
    if (!p.avatar_url) return null;
    try {
      const res = await fetch(p.avatar_url);
      if (!res.ok) return null;
      return await loadImage(Buffer.from(await res.arrayBuffer()));
    } catch {
      return null;
    }
  }),
);

// ---------- dibujo ----------
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const FONT = '"Segoe UI", Arial, sans-serif';

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function truncate(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

const ROW_Y0 = 500;
const ROW_H = 138;
const BAR_X = 512;
const BAR_MAX_W = 380;

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0d4a37");
  g.addColorStop(1, "#062419");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawFrame(stepA, stepB, rankA, rankB, t, progress) {
  const e = ease(t);
  drawBackground();

  // título
  ctx.textAlign = "center";
  ctx.fillStyle = "#f5efe0";
  ctx.font = `900 66px ${FONT}`;
  ctx.fillText("LA PELICULA DEL PRODE", W / 2, 110);
  ctx.fillStyle = "rgba(245,239,224,0.55)";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText("Mundial 2026 · la historia completa", W / 2, 165);

  // tarjeta del partido
  const card = t >= 0.35 ? stepB : stepA;
  const highlight = card.globals || card.slow;
  ctx.fillStyle = highlight ? "#e9b949" : "#f5efe0";
  rr(60, 215, W - 120, 185, 28);
  ctx.fill();
  ctx.fillStyle = "#14100b";
  ctx.font = `800 ${highlight ? 54 : 48}px ${FONT}`;
  ctx.fillText(truncate(card.title, W - 200), W / 2, highlight ? 305 : 295);
  ctx.fillStyle = "rgba(20,16,11,0.6)";
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(truncate(card.sub ?? "", W - 180), W / 2, 365);

  // valores interpolados y máximos para la escala de barras
  const vals = players.map((_, j) => stepA.totals[j] + (stepB.totals[j] - stepA.totals[j]) * e);
  const maxV = Math.max(10, ...vals);

  for (let j = 0; j < players.length; j++) {
    const rowPos = rankA[j] + (rankB[j] - rankA[j]) * e;
    const y = ROW_Y0 + rowPos * ROW_H;
    const cy = y + ROW_H / 2;
    const rank = Math.round(rowPos) + 1;

    // círculo de puesto
    const medal = rank === 1 ? "#e9b949" : rank === 2 ? "#c7c9d1" : rank === 3 ? "#cd8f5a" : "rgba(245,239,224,0.14)";
    ctx.beginPath();
    ctx.arc(95, cy, 33, 0, Math.PI * 2);
    ctx.fillStyle = medal;
    ctx.fill();
    ctx.fillStyle = rank <= 3 ? "#14100b" : "#f5efe0";
    ctx.font = `900 34px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(rank), 95, cy + 12);

    // avatar
    const ax = 195, ar = 44;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, cy, ar, 0, Math.PI * 2);
    ctx.clip();
    if (avatars[j]) {
      ctx.drawImage(avatars[j], ax - ar, cy - ar, ar * 2, ar * 2);
    } else {
      ctx.fillStyle = COLORS[j % COLORS.length];
      ctx.fillRect(ax - ar, cy - ar, ar * 2, ar * 2);
      ctx.fillStyle = "#14100b";
      ctx.font = `900 42px ${FONT}`;
      ctx.fillText(players[j].nickname.charAt(0).toUpperCase(), ax, cy + 15);
    }
    ctx.restore();

    // nombre
    ctx.textAlign = "left";
    ctx.fillStyle = "#f5efe0";
    ctx.font = `700 36px ${FONT}`;
    ctx.fillText(truncate(players[j].nickname, 245), 254, cy + 12);

    // barra
    const bw = Math.max(8, (vals[j] / maxV) * BAR_MAX_W);
    ctx.fillStyle = "rgba(245,239,224,0.10)";
    rr(BAR_X, cy - 26, BAR_MAX_W, 52, 26);
    ctx.fill();
    ctx.fillStyle = COLORS[j % COLORS.length];
    rr(BAR_X, cy - 26, bw, 52, 26);
    ctx.fill();

    // puntos
    ctx.textAlign = "right";
    ctx.fillStyle = "#f5efe0";
    ctx.font = `900 40px ${FONT}`;
    ctx.fillText(String(Math.round(vals[j])), W - 62, cy + 14);
  }

  // barra de progreso + footer
  ctx.fillStyle = "rgba(245,239,224,0.15)";
  rr(60, 1806, W - 120, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#e9b949";
  rr(60, 1806, Math.max(12, (W - 120) * progress), 12, 6);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(245,239,224,0.5)";
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText("prodelospibes.com", W / 2, 1872);
}

// Papelitos del cierre: partículas deterministas que caen en la coronación.
const CONFETTI = Array.from({ length: 130 }).map((_, i) => ({
  x: (i * 197) % W,
  speed: 9 + ((i * 37) % 12),
  phase: (i * 131) % H,
  size: 10 + ((i * 53) % 14),
  color: ["#e9b949", "#f5efe0", "#22c55e", "#75AADB", "#ef4444"][i % 5],
  round: i % 3 === 0,
  sway: 20 + ((i * 29) % 40),
}));

function drawChampFrame(k) {
  drawBackground();

  // placa dorada central
  ctx.fillStyle = "#e9b949";
  rr(70, 420, W - 140, 1080, 48);
  ctx.fill();
  ctx.strokeStyle = "#f5efe0";
  ctx.lineWidth = 14;
  rr(70, 420, W - 140, 1080, 48);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f5efe0";
  ctx.font = `900 60px ${FONT}`;
  ctx.fillText("FIN DEL MUNDIAL 2026", W / 2, 300);

  ctx.fillStyle = "#14100b";
  ctx.font = `900 56px ${FONT}`;
  ctx.fillText("CAMPEON DEL PRODE", W / 2, 560);

  // avatar del campeón
  const cx = W / 2, cyA = 880, r = 230;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cyA, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatars[champIdx]) {
    ctx.drawImage(avatars[champIdx], cx - r, cyA - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = "#0B3D2E";
    ctx.fillRect(cx - r, cyA - r, r * 2, r * 2);
    ctx.fillStyle = "#e9b949";
    ctx.font = `900 220px ${FONT}`;
    ctx.fillText(champ.nickname.charAt(0).toUpperCase(), cx, cyA + 80);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cyA, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#f5efe0";
  ctx.lineWidth = 16;
  ctx.stroke();

  ctx.fillStyle = "#14100b";
  ctx.font = `900 110px ${FONT}`;
  ctx.fillText(truncate(champ.nickname.toUpperCase(), W - 260), W / 2, 1290);
  ctx.font = `800 54px ${FONT}`;
  ctx.fillText(`${finalTotals[champIdx]} puntos · gloria eterna`, W / 2, 1390);

  ctx.fillStyle = "rgba(245,239,224,0.7)";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText("gracias por jugar, nos vemos en 2030", W / 2, 1620);

  ctx.fillStyle = "rgba(245,239,224,0.5)";
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText("prodelospibes.com", W / 2, 1872);

  // papelitos por encima de todo
  for (const p of CONFETTI) {
    const y = (p.phase + k * p.speed) % (H + 60) - 30;
    const x = p.x + Math.sin((k + p.phase) / 18) * p.sway;
    ctx.fillStyle = p.color;
    if (p.round) {
      ctx.beginPath();
      ctx.arc(x, y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, p.size, p.size * 0.6);
    }
  }
}

// ---------- render ----------
const framesDir = path.join(tmpdir(), "prode-pelicula-frames");
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

let f = 0;
async function emit() {
  const buf = await canvas.encode("png");
  writeFileSync(path.join(framesDir, `f${String(f).padStart(5, "0")}.png`), buf);
  f++;
  if (f % 300 === 0) console.log(`  ${f} frames...`);
}

console.log(`Jugadores: ${players.length} · partidos: ${matches.length} · pasos: ${steps.length}`);
console.log(`Campeón: ${champ.nickname} (${finalTotals[champIdx]} pts)`);

for (let k = 0; k < INTRO_FRAMES; k++) {
  drawFrame(steps[0], steps[0], rankOf[0], rankOf[0], 0, 0);
  await emit();
}
for (let i = 0; i < steps.length - 1; i++) {
  const progress = (i + 1) / (steps.length - 1);
  const to = steps[i + 1];
  // la final y las globales van en cámara lenta, el resto a ritmo de trailer
  const anim = to.globals ? GLOBALS_ANIM : to.slow ? ANIM_FRAMES * 3 : ANIM_FRAMES;
  const hold = to.globals ? GLOBALS_HOLD : to.slow ? HOLD_FRAMES * 6 : HOLD_FRAMES;
  for (let k = 0; k < anim; k++) {
    drawFrame(steps[i], to, rankOf[i], rankOf[i + 1], (k + 1) / anim, progress);
    await emit();
  }
  for (let k = 0; k < hold; k++) {
    drawFrame(steps[i], to, rankOf[i], rankOf[i + 1], 1, progress);
    await emit();
  }
}
// tabla final quieta
const last = steps[steps.length - 1];
const lastRank = rankOf[steps.length - 1];
const finalStep = { ...last, title: "ASI TERMINO EL PRODE", sub: "la tabla definitiva del Mundial 2026", globals: true };
for (let k = 0; k < TABLE_FINAL_FRAMES; k++) {
  drawFrame(last, finalStep, lastRank, lastRank, 1, 1);
  await emit();
}
// coronación
for (let k = 0; k < CHAMP_FRAMES; k++) {
  drawChampFrame(k);
  await emit();
}

console.log(`Frames listos (${f}). Codificando MP4...`);
const ff = spawnSync("ffmpeg", [
  "-y", "-framerate", String(FPS),
  "-i", path.join(framesDir, "f%05d.png"),
  "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  OUT,
], { stdio: ["ignore", "ignore", "pipe"] });
if (ff.status !== 0) {
  console.error(ff.stderr?.toString().slice(-2000));
  process.exit(1);
}
rmSync(framesDir, { recursive: true, force: true });
copyFileSync(OUT, OUT_DESKTOP);
console.log(`Listo: ${OUT} (${(f / FPS).toFixed(0)}s de video) + copia en el Escritorio`);
