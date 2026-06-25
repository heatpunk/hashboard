# Hashboard – ASIC-monitor för mobil

Realtidsövervakning av CGMiner-baserade ASIC-miners, byggd för att nås från mobil/surfplatta på samma LAN.

## Starta appen

```bash
npm install
npm run dev:full
```

`dev:full` startar Rust-proxyn (`cargo run` i `proxy-rs/`) och Vite parallellt.

När proxyn startar skrivs adressen ut:

```
Hashboard proxy-rs → http://127.0.0.1:8081
```

Öppna Vite-adressen (visas i terminalen) i webbläsaren på din mobil (måste vara i samma nätverk).

## Arkitektur

```
Browser / Mobile
       │
       ▼
serve.cjs  :80  (Node.js – serverar dist/ + reverse-proxies /api/*)
       │
       ▼
proxy-rs   :8081  (Rust – asic-rs – pratar med minern)
       │
       ▼
Miner  :4028  (CGMiner / BraiinsOS / LuxOS / Vnish / stock Antminer …)
```

- **UI (React/Vite)** – byggs till `dist/` och serveras statiskt av `serve.cjs`.
- **`serve.cjs` (Node.js, port 80/8080)** – serverar `dist/` och reverse-proxar alla `/api/*`-anrop till `proxy-rs` på `127.0.0.1:8081`. Lämnas oförändrat.
- **`proxy-rs` (Rust, port 8081)** – ny Rust-tjänst som ersätter den gamla Node-proxyn. Använder [asic-rs](https://github.com/256foundation/asic-rs) (256Foundation) för firmware-stöd: BraiinsOS, LuxOS, Vnish, stock Antminer, Whatsminer, Avalonminer, ePIC, Marathon, Bitaxe m.fl.
- **Miner** – CGMiner-kompatibelt TCP-API på port 4028.

## API

| Endpoint | Beskrivning |
|----------|-------------|
| `GET /api/health` | Hälsokontroll |
| `GET /api/miners/{ip}/stats` | Live-data (hashrate, watt, temp, fans) |
| `POST /api/miners/{ip}/pause` | Pausa mining |
| `POST /api/miners/{ip}/resume` | Återuppta mining |
| `GET /api/miners/{ip}/rawdata` | Rådata från asic-rs (debug) |
| `GET /api/scan?subnet=192.168.1` | Skanna hela `/24`-subnätet |

## Lägg till en miner

1. Tryck på kugghjulet (Inställningar).
2. Ange minerens IP-adress (t.ex. `192.168.1.106`).
3. Badgen växlar från **SIM** till **LIVE** inom 5 sekunder om minern svarar.

## Skanna hela subnätet

Tryck **Scan LAN** i inställningarna – söker av hela `/24`-subnätet automatiskt.
