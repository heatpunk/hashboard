# Instruktioner för Claude

- Gör jobbet själv. Lägg inte arbete på användaren.
- Svara kort och utan facktermer.
- När något ska byggas, mergas, pushas eller triggas – gör det direkt.
- Fråga bara när det är absolut nödvändigt för att kunna gå vidare.

## Projekt

ASIC-miner-monitor byggd i React/Vite med en Node.js-proxy mot CGMiner (port 4028).

## Releaseflöde

1. Bumpa version i `startos/versions/current.ts` och `startos/manifest/index.ts` (Docker-taggen).
2. Uppdatera `IMAGE`-variabeln i `Makefile`.
2b. Bumpa `version` i `umbrel/hashboard/umbrel-app.yml` + image-taggen i `umbrel/hashboard/docker-compose.yml`, och spegla till repot `heatpunk/umbrel-app-store`.
2c. Bumpa `version` i `hashboard-addon/config.yaml` (Home Assistant hämtar imagen med versionen som tagg) och i `custom_components/hashboard/manifest.json`.
3. Committa och pusha till `main`.
4. Trigga `release.yml` via `workflow_dispatch` med versionsnumret som input – det bygger Docker-imagen, packar `hashboard.s9pk` och skapar en GitHub Release automatiskt.
