'use strict';
const http = require('http');
const net = require('net');
const os = require('os');

const PORT = 8081;
const CGMINER_PORT = 4028;
const { execFile } = require('child_process');
const GRPCURL = process.env.GRPCURL || 'grpcurl';
const GRPC_PORT = 50051;
const HOST_RE = /^[a-zA-Z0-9.\-]+$/;

function cgMinerQuery(ip, command) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = '';
    let settled = false;

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(result);
    };

    socket.setTimeout(3000);
    socket.connect(CGMINER_PORT, ip, () => {
      socket.setTimeout(5000);
      socket.write(JSON.stringify({ command }));
    });

    socket.on('data', chunk => {
      data += chunk.toString();
      if (data.includes('\0')) {
        try {
          finish(null, JSON.parse(data.replace(/\0+/g, '')));
        } catch (e) {
          finish(new Error('Parse error: ' + e.message));
        }
      }
    });

    socket.on('close', () => {
      if (!settled && data.trim()) {
        try {
          finish(null, JSON.parse(data.replace(/\0+/g, '')));
        } catch {
          finish(new Error('Incomplete response'));
        }
      } else if (!settled) {
        finish(new Error('No response'));
      }
    });

    socket.on('timeout', () => finish(new Error('Timeout')));
    socket.on('error', err => finish(err));
  });
}

// Ask the miner for several commands over ONE connection using CGMiner's
// `a+b+c` multi-command syntax. Firing many parallel sockets at a single miner
// drops replies on slower units (the intermittent blank target/range); one
// socket is reliable. The multi reply nests each result as { cmd: [ {...} ] };
// unwrap to { cmd: {...} } so callers see the same shape as a single query.
async function cgMinerMultiQuery(ip, commands) {
  const raw = await cgMinerQuery(ip, commands.join('+'));
  const out = {};
  for (const cmd of commands) {
    const v = raw?.[cmd];
    out[cmd] = Array.isArray(v) ? (v[0] ?? {}) : {};
  }
  return out;
}

function normalizeLive(summary, stats, temps, fans, tuner) {
  const s = (summary?.SUMMARY ?? [])[0] ?? {};
  const st = (stats?.STATS ?? []).find(x => x['GHS av'] != null || x['GHS 5s'] != null) ?? {};

  // Current hashrate (a paused miner reads 0), not the lifetime average.
  let th;
  if (st['GHS 5s'] != null) th = st['GHS 5s'] / 1000;
  else if (st['GHS av'] != null) th = st['GHS av'] / 1000;
  else if (s['MHS 5s'] != null) th = s['MHS 5s'] / 1e6;
  else if (s['MHS 1m'] != null) th = s['MHS 1m'] / 1e6;
  else th = (s['MHS av'] ?? 0) / 1e6;
  th = parseFloat(th.toFixed(2));

  // Real power draw from Braiins tunerstatus (0 when paused); else a Power field.
  const ts = (tuner?.TUNERSTATUS ?? [])[0] ?? {};
  const watts = ts.ApproximateMinerPowerConsumption ?? s['Power'] ?? st['power'] ?? st['Power'] ?? null;

  // Hottest chip from Braiins `temps`; else legacy stats temp1..8.
  let chips = (temps?.TEMPS ?? []).map(t => t.Chip).filter(v => v != null && v > 0);
  if (chips.length === 0) {
    for (let i = 1; i <= 8; i++) { const t = st[`temp${i}`]; if (t != null && t > 0) chips.push(t); }
  }
  const chipTemp = chips.length > 0 ? parseFloat(Math.max(...chips).toFixed(1)) : null;

  // Fan from Braiins `fans` (Speed %, 0 when paused); else legacy stats fan1..8 RPM.
  let fanSpeed = null;
  const fanSpeeds = (fans?.FANS ?? []).map(f => f.Speed).filter(v => v != null);
  if (fanSpeeds.length > 0) {
    fanSpeed = Math.round(Math.max(...fanSpeeds));
  } else {
    const fanRpms = [];
    for (let i = 1; i <= 8; i++) { const rpm = st[`fan${i}`]; if (rpm != null && rpm > 0) fanRpms.push(rpm); }
    if (fanRpms.length > 0) fanSpeed = Math.min(100, Math.round((Math.max(...fanRpms) / 6000) * 100));
  }

  return { th, watts, chipTemp, fanSpeed };
}

function detectModel(stats, devdetails) {
  // Braiins reports the model in devdetails (e.g. "Antminer S19j Pro"); the
  // legacy stats.Type is empty on current BOSer builds.
  const dd = (devdetails?.DEVDETAILS ?? []).find(x => x.Model) ?? {};
  if (dd.Model) return dd.Model;
  const st = (stats?.STATS ?? []).find(x => x.Type) ?? {};
  return st.Type || 'Antminer';
}

// Physical hashboard slots for the machine. The miner only reports *populated*
// boards, so when a board is pulled/disabled the total must come from the model.
// Every Antminer S/T-series in this class ships 3 hashboards.
const BOARDS_BY_MODEL = [
  { re: /\b[ST](9|17|19|21)\b/i, boards: 3 },
];
function modelBoardCount(model) {
  for (const { re, boards } of BOARDS_BY_MODEL) if (re.test(model || '')) return boards;
  return 3; // sane default — virtually all Antminers have 3 hashboards
}

// Boards actually present & hashing. Braiins drops missing/disabled boards from
// `devs` entirely, so the count of alive ASCs IS the active-board count.
function activeBoardCount(devs, devdetails, temps) {
  const alive = (devs?.DEVS ?? []).filter(d => d.Enabled === 'Y' && d.Status === 'Alive');
  if (alive.length) return alive.length;
  const dd = (devdetails?.DEVDETAILS ?? []).filter(d => d.Model);
  if (dd.length) return dd.length;
  return (temps?.TEMPS ?? []).length;
}

// Whole-machine power target (the slider ceiling) from the open CGMiner API —
// no password required. PowerLimit is the configured tuner target in watts.
function fullPowerTarget(tuner) {
  const ts = (tuner?.TUNERSTATUS ?? [])[0] ?? {};
  const v = ts.PowerLimit ?? ts?.DynamicPowerScaling?.ScaledPowerLimit ?? null;
  return v != null && Number(v) > 0 ? Number(v) : null;
}

async function probeMiner(ip) {
  try {
    const q = await cgMinerMultiQuery(ip, ['summary', 'stats', 'devdetails', 'temps', 'fans', 'tunerstatus']);
    if (!q.summary?.SUMMARY?.[0]) return null;
    return { ip, model: detectModel(q.stats, q.devdetails), live: normalizeLive(q.summary, q.stats, q.temps, q.fans, q.tunerstatus), config: { powerTarget: null, powerMin: null, fullTarget: null, boards: null } };
  } catch {
    return null;
  }
}

async function scanSubnet(subnet) {
  const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
  const results = [];
  const BATCH = 20;
  for (let i = 0; i < hosts.length; i += BATCH) {
    const batch = await Promise.all(hosts.slice(i, i + BATCH).map(ip => probeMiner(ip)));
    results.push(...batch.filter(Boolean));
  }
  return results;
}

function grpcCall(ip, method, payload, token) {
  return new Promise((resolve, reject) => {
    const args = ['-plaintext', '-max-time', '10'];
    if (token) args.push('-H', 'authorization: ' + token);
    args.push('-d', JSON.stringify(payload || {}), ip + ':' + GRPC_PORT, method);
    execFile(GRPCURL, args, { timeout: 12000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(((stderr || '') + (err.message || '')).trim() || 'grpc error'));
      try { resolve(stdout.trim() ? JSON.parse(stdout) : {}); } catch { resolve({}); }
    });
  });
}

async function minerLogin(ip, password) {
  const r = await grpcCall(ip, 'braiins.bos.v1.AuthenticationService/Login', { username: 'root', password: password || '' });
  if (!r.token) throw new Error('login failed');
  return r.token;
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true });
  }

  const statsMatch = url.pathname.match(/^\/api\/miners\/([^/]+)\/stats$/);
  if (statsMatch) {
    const ip = decodeURIComponent(statsMatch[1]);
    try {
      // Everything the dial needs is in the open CGMiner API (port 4028) — no
      // password. tunerstatus.PowerLimit = whole-machine target; devs = boards
      // actually hashing; devdetails = model → physical board count. One
      // connection (multi-command) so a slower miner never drops part of it.
      const q = await cgMinerMultiQuery(ip, ['summary', 'stats', 'devs', 'devdetails', 'temps', 'fans', 'tunerstatus']);
      const { summary, stats, devs, devdetails, temps, fans, tunerstatus: tuner } = q;

      const model = detectModel(stats, devdetails);
      const active = activeBoardCount(devs, devdetails, temps);
      // total is a model property; never let it drop below the active count.
      const total = Math.max(active, modelBoardCount(model));
      const fullTarget = fullPowerTarget(tuner);

      // fullTarget = scale ceiling (MAX). The client scales it by active/total
      // to the nearest 50 W for the Target readout. powerMin: the Braiins floor
      // isn't on the open API, so the dial floor is 0.
      const config = {
        fullTarget,
        powerMin: null,
        boards: active > 0 ? { active, total } : null,
      };
      console.log(`[stats] ${ip} model="${model}" fullTarget=${fullTarget} boards=${active}/${total}`);

      return send(res, 200, {
        ok: true,
        live: normalizeLive(summary, stats, temps, fans, tuner),
        config,
        model,
        needPassword: false,
      });
    } catch (err) {
      return send(res, 502, { ok: false, error: err.message });
    }
  }

  const ctrlMatch = url.pathname.match(/^\/api\/miners\/([^/]+)\/(pause|resume)$/);
  if (ctrlMatch && req.method === 'POST') {
    const ip = decodeURIComponent(ctrlMatch[1]);
    const action = ctrlMatch[2];
    if (!HOST_RE.test(ip)) return send(res, 400, { ok: false, error: 'bad host' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      let password = '';
      try { password = JSON.parse(body || '{}').password || ''; } catch (e) {}
      let token;
      try {
        token = await minerLogin(ip, password);
      } catch (err) {
        const denied = /denied|unauth|invalid|permission|password|credential/i.test(err.message);
        return send(res, denied ? 401 : 502, { ok: false, needPassword: denied, error: err.message });
      }
      const method = action === 'pause'
        ? 'braiins.bos.v1.ActionsService/PauseMining'
        : 'braiins.bos.v1.ActionsService/ResumeMining';
      try {
        await grpcCall(ip, method, {}, token);
        return send(res, 200, { ok: true, command: action });
      } catch (err) {
        return send(res, 502, { ok: false, error: err.message });
      }
    });
    return;
  }

  const rawMatch = url.pathname.match(/^\/api\/miners\/([^/]+)\/rawdata$/);
  if (rawMatch) {
    const ip = decodeURIComponent(rawMatch[1]);
    if (!HOST_RE.test(ip)) return send(res, 400, { ok: false, error: 'bad host' });
    try {
      const raw = await cgMinerMultiQuery(ip, ['summary', 'stats', 'devs', 'devdetails', 'temps', 'fans', 'tunerstatus']);
      return send(res, 200, { ok: true, raw });
    } catch (e) {
      return send(res, 502, { ok: false, error: e.message });
    }
  }

  if (url.pathname === '/api/scan') {
    const subnet = url.searchParams.get('subnet') ?? '192.168.1';
    try {
      const miners = await scanSubnet(subnet);
      return send(res, 200, { ok: true, miners });
    } catch (err) {
      return send(res, 500, { ok: false, error: err.message });
    }
  }

  send(res, 404, { ok: false, error: 'Not found' });
}).listen(PORT, '127.0.0.1', () => {
  const lanIp = Object.values(os.networkInterfaces())
    .flat()
    .find(n => n.family === 'IPv4' && !n.internal)?.address ?? 'unknown';
  console.log(`Hashboard proxy → http://127.0.0.1:${PORT} (internal)`);
  console.log(`Hashboard UI   → http://${lanIp}:8080  ← open this on phone/tablet`);
  console.log('Bridges the browser to the miner CGMiner TCP API (port 4028) on the LAN.');
});
