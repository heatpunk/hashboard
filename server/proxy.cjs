'use strict';
const http = require('http');
const net = require('net');
const os = require('os');

const PORT = 8081;
const CGMINER_PORT = 4028;

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

const TOTAL_BOARDS = 3;        // S19j Pro hashboard slots
const MIN_POWER_FULL_W = 944;  // Braiins min power target for a full S19j Pro (not exposed via the socket API)

// Scale the machine's full (all-boards) power target + Braiins floor down to
// the boards that are actually active (active / total).
function buildConfig(tuner, temps) {
  const fullTarget = (tuner?.TUNERSTATUS ?? [])[0]?.PowerLimit ?? null;
  const active = (temps?.TEMPS ?? []).length || TOTAL_BOARDS;
  const factor = TOTAL_BOARDS > 0 ? active / TOTAL_BOARDS : 1;
  return {
    powerTarget: fullTarget != null ? Math.round(fullTarget * factor) : null,
    powerMin: Math.round(MIN_POWER_FULL_W * factor),
    fullTarget,
    boards: { active, total: TOTAL_BOARDS },
  };
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
    return { ip, model: detectModel(stats), live: normalizeLive(summary, stats, temps, fans, tuner), config: buildConfig(tuner, temps) };
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
      return send(res, 200, {
        ok: true,
        live: normalizeLive(summary, stats, temps, fans, tuner),
        config: buildConfig(tuner, temps),
        model: detectModel(stats),
      });
    } catch (err) {
      return send(res, 502, { ok: false, error: err.message });
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
    .find(n => n.family === 'IPv4' && !n.internal)?.address ?? 'okänd';
  console.log(`Hashboard proxy → http://127.0.0.1:${PORT} (intern)`);
  console.log(`Hashboard UI   → http://${lanIp}:8080  ← öppna denna på mobil/surfplatta`);
  console.log('Bryggar webbläsaren mot CGMiner TCP (port 4028) på LAN.');
});
