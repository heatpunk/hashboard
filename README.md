# Hashboard – ASIC-monitor för mobil

Realtidsövervakning av CGMiner-baserade ASIC-miners, byggd för att nås från mobil/surfplatta på samma LAN.

## Starta appen

```bash
npm install
npm run dev:full
```

När proxyn startar skrivs adressen ut:

```
Hashboard UI   → http://192.168.1.x:8080  ← öppna denna på mobil/surfplatta
```

Öppna den adressen i webbläsaren på din mobil (måste vara i samma nätverk som maskinen).

## Hur det fungerar

- **Vite (port 8080)** – serverar React-appen, öppen på alla nätverksgränssnitt.
- **Proxy (port 8081)** – bryggar webbläsaren mot CGMiner TCP-API (port 4028). Lyssnar bara lokalt; Vite vidarebefordrar `/api`-anrop till den.
- Appen faller tillbaka på simulerade värden om ingen miner svarar.

## Lägg till en miner

1. Tryck på kugghjulet (Inställningar).
2. Ange minerens IP-adress (t.ex. `192.168.1.106`).
3. Badgen växlar från **SIM** till **LIVE** inom 5 sekunder om minern svarar.

## Skanna hela subnätet

Tryck **Scan LAN** i inställningarna – söker av hela `/24`-subnätet automatiskt.
