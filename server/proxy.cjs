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

function normalizeLive(summary, stats) {
  const s = (summary?.SUMMARY ?? [])[0] ?? {};
  const st = (stats?.STATS ?? []).find(x => x['GHS av'] != null || x['GHS 5s'] != null) ?? {};

  const ghsAv = st['GHS av'] ?? 0;
  const mhsAv = s['MHS av'] ?? s['MHS 5s'] ?? 0;
  const th = ghsAv > 0
    ? parseFloat((ghsAv / 1000).toFixed(2))
    : parseFloat((mhsAv / 1e6).toFixed(2));

  const watts = s['Power'] ?? st['power'] ?? st['Power'] ?? null;

  const boardTemps = [];
  for (let i = 1; i <= 8; i++) {
    const t = st[`temp${i}`];
    if (t != null && t > 0) boardTemps.push(t);
  }
  const chipTemp = boardTemps.length > 0
    ? parseFloat((boardTemps.reduce((a, b) => a + b, 0) / boardTemps.length).toFixed(1))
    : null;

  const fanRpms = [];
  for (let i = 1; i <= 8; i++) {
    const rpm = st[`fan${i}`];
    if (rpm != null && rpm > 0) fanRpms.push(rpm);
  }
  const avgRpm = fanRpms.length > 0
    ? fanRpms.reduce((a, b) => a + b, 0) / fanRpms.length
    : null;
  const fanSpeed = avgRpm != null ? Math.min(100, Math.round((avgRpm / 6000) * 100)) : null;

  return { th, watts, chipTemp, fanSpeed };
}

function detectModel(stats) {
  const st = (stats?.STATS ?? []).find(x => x.Type) ?? {};
  return st.Type || 'Antminer';
}

async function probeMiner(ip) {
  try {
    const summary = await cgMinerQuery(ip, 'summary');
    if (!summary?.SUMMARY?.[0]) return null;
    const stats = await cgMinerQuery(ip, 'stats').catch(() => ({}));
    return { ip, model: detectModel(stats), live: normalizeLive(summary, stats) };
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
      const [summary, stats] = await Promise.all([
        cgMinerQuery(ip, 'summary'),
        cgMinerQuery(ip, 'stats').catch(() => ({})),
      ]);
      return send(res, 200, {
        ok: true,
        live: normalizeLive(summary, stats),
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
