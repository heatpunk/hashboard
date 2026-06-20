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

function buildConfig() {
  // CGMiner doesn't expose the Braiins power limit or active board count reliably.
  // These are filled from gRPC (fetchBosTarget/fetchBosBoards) in the stats endpoint.
  return { powerTarget: null, powerMin: null, fullTarget: null, boards: null };
}

function detectModel(stats) {
  const st = (stats?.STATS ?? []).find(x => x.Type) ?? {};
  return st.Type || 'Antminer';
}

async function probeMiner(ip) {
  try {
    const summary = await cgMinerQuery(ip, 'summary');
    if (!summary?.SUMMARY?.[0]) return null;
    const [stats, temps, fans, tuner] = await Promise.all([
      cgMinerQuery(ip, 'stats').catch(() => ({})),
      cgMinerQuery(ip, 'temps').catch(() => ({})),
      cgMinerQuery(ip, 'fans').catch(() => ({})),
      cgMinerQuery(ip, 'tunerstatus').catch(() => ({})),
    ]);
    return { ip, model: detectModel(stats), live: normalizeLive(summary, stats, temps, fans, tuner), config: buildConfig() };
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

// Cache auth tokens briefly so polling doesn't log in on every request.
const tokenCache = new Map(); // ip -> { token, expires }
// Throttle repeated failed empty-password logins (one per ip per 30s).
const authNeeded = new Map(); // ip -> expires

function isAuthError(msg) {
  return /denied|unauth|invalid|permission|password|credential|login failed/i.test(msg || '');
}
async function getToken(ip, password) {
  const cached = tokenCache.get(ip);
  if (cached && cached.expires > Date.now()) return cached.token;
  const token = await minerLogin(ip, password);
  tokenCache.set(ip, { token, expires: Date.now() + 60000 });
  return token;
}

// The configured power target lives ONLY in the Braiins OS gRPC API
// (PerformanceService/GetTunerState) — it is NOT exposed by the open CGMiner
// TCP API. grpcurl emits proto fields in lowerCamelCase; Power.watt (uint64)
// arrives as a string. Power-target mode → powerTargetModeState.currentTarget.
async function fetchBosTarget(ip, token) {
  const r = await grpcCall(ip, 'braiins.bos.v1.PerformanceService/GetTunerState', {}, token);
  console.log(`[grpc] GetTunerState ${ip}:`, JSON.stringify(r).slice(0, 300));
  const w = r?.powerTargetModeState?.currentTarget?.watt
    ?? r?.powerTargetModeState?.profile?.target?.watt;
  return w != null ? Number(w) : null;
}

// Real total vs active hashboards from gRPC (each board carries an `enabled` flag).
async function fetchBosBoards(ip, token) {
  const r = await grpcCall(ip, 'braiins.bos.v1.MinerService/GetHashboards', {}, token);
  const boards = r?.hashboards;
  console.log(`[grpc] GetHashboards ${ip}: total=${Array.isArray(boards) ? boards.length : 'null'} enabled=${Array.isArray(boards) ? boards.filter(b => b.enabled).length : 'null'} raw=${JSON.stringify(boards ?? null).slice(0, 200)}`);
  if (!Array.isArray(boards) || boards.length === 0) return null;
  const total = boards.length;
  const active = boards.filter(b => b.enabled).length || total;
  return { active, total };
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
      const [summary, stats, temps, fans, tuner] = await Promise.all([
        cgMinerQuery(ip, 'summary'),
        cgMinerQuery(ip, 'stats').catch(() => ({})),
        cgMinerQuery(ip, 'temps').catch(() => ({})),
        cgMinerQuery(ip, 'fans').catch(() => ({})),
        cgMinerQuery(ip, 'tunerstatus').catch(() => ({})),
      ]);

      const config = buildConfig();
      // CGMiner temps entries correspond to physical hashboards (including inactive ones).
      // Used as the reliable total board count when gRPC only returns enabled boards.
      const tempsTotal = (temps?.TEMPS ?? []).length;

      // The configured power target lives only in the authenticated Braiins gRPC API.
      // We fetch target + enabled board count, combine with CGMiner temps total to get
      // the correct active/total ratio, and scale the target accordingly.
      const password = req.headers['x-miner-password'] || '';
      let needPassword = false;
      if (HOST_RE.test(ip)) {
        const throttled = !password && (authNeeded.get(ip) ?? 0) > Date.now();
        if (throttled) {
          needPassword = true;
        } else {
          try {
            const token = await getToken(ip, password);
            const [fullTarget, grpcBoards] = await Promise.all([
              fetchBosTarget(ip, token).catch(e => { console.error(`[grpc] GetTunerState ${ip} error:`, e.message); return null; }),
              fetchBosBoards(ip, token).catch(e => { console.error(`[grpc] GetHashboards ${ip} error:`, e.message); return null; }),
            ]);
            console.log(`[grpc] ${ip} fullTarget=${fullTarget} grpcBoards=${JSON.stringify(grpcBoards)} tempsTotal=${tempsTotal}`);
            if (grpcBoards != null) {
              // grpcBoards.active = enabled boards from gRPC (all boards returned, enabled flag per board)
              // tempsTotal = physical board count from CGMiner temps (reliable as total)
              config.boards = {
                active: grpcBoards.active,
                total: tempsTotal > 0 ? tempsTotal : grpcBoards.total,
              };
            }
            if (fullTarget != null && fullTarget > 0) {
              const b = config.boards;
              const ratio = b && b.active > 0 && b.total > 0 ? b.active / b.total : 1;
              config.fullTarget = fullTarget;
              config.powerTarget = Math.round(fullTarget * ratio);
            }
            console.log(`[grpc] ${ip} result: boards=${JSON.stringify(config.boards)} powerTarget=${config.powerTarget}`);
            authNeeded.delete(ip);
          } catch (e) {
            console.error(`[grpc] ${ip} auth/outer error:`, e.message);
            if (isAuthError(e.message)) {
              needPassword = true;
              if (!password) authNeeded.set(ip, Date.now() + 30000);
            }
          }
        }
      }

      return send(res, 200, {
        ok: true,
        live: normalizeLive(summary, stats, temps, fans, tuner),
        config,
        model: detectModel(stats),
        needPassword,
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
    const results = {};
    await Promise.all(['summary', 'stats', 'temps', 'fans', 'tunerstatus'].map(async cmd => {
      try { results[cmd] = await cgMinerQuery(ip, cmd); }
      catch (e) { results[cmd] = { error: e.message }; }
    }));
    return send(res, 200, { ok: true, raw: results });
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
