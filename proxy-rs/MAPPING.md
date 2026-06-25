# asic-rs field mapping

This document maps asic-rs `MinerData` fields to the JSON contract that
Hashboard's React UI consumes via `/api/miners/{ip}/stats`.

## Field mapping table

| Hashboard field          | asic-rs source                                                                 | Notes |
|--------------------------|--------------------------------------------------------------------------------|-------|
| `live.th`                | `MinerData.hashrate` → `HashRate.as_unit(TeraHash).value`                     | Rounded to 2 decimals. 0.0 when `hashrate` is `None` or paused. |
| `live.watts`             | `MinerData.wattage` → `Power.as_watts()`                                      | `null` when `wattage` is `None`. |
| `live.chipTemp`          | `BoardData.outlet_chip_temperature` (hottest chip per board), fallback to `BoardData.board_temperature`, then `ChipData.temperature` | Max across all boards, rounded to 1 decimal. `null` when no temperature data. |
| `live.fanSpeed`          | `FanData.rpm` → `AngularVelocity.as_rpm()`, mapped to 0–100 % (6000 RPM = 100 %) | Max across all fans. `null` when `fans` is empty. |
| `config.fullTarget`      | (see below)                                                                    | `null` when not available. |
| `config.powerMin`        | always `null`                                                                  | Braiins floor not on open API. |
| `config.boards.active`   | Count of `BoardData` where `active == Some(true)`, else boards with hashrate/chips | 0 → `boards: null`. |
| `config.boards.total`    | `max(active, MinerData.expected_hashboards ?? model_default_3)`                | Never less than active. |
| `model`                  | `"{device_info.make} {device_info.model}"`, fallback `"Antminer"`             | Mirrors old `detectModel`. |
| `needPassword`           | always `false`                                                                 | Reads use open CGMiner API. |

## `config.fullTarget` resolution (in order)

1. `MinerData.tuning_target` if it is `TuningTarget::Power(p)` and `p.as_watts() > 0`
2. `MinerData.scaled_tuning_target` if it is `TuningTarget::Power(p)` and `p.as_watts() > 0`
3. `MinerData.tuning_capabilities.power.maximum` if it is `TuningTarget::Power(p)` and `p.as_watts() > 0`
4. `null` — asic-rs does not always expose a power limit for all firmware backends

**Known gap:** For stock Antminer firmware without an explicit tuner target configured,
asic-rs may not report a power limit. In that case `fullTarget` will be `null` and the
UI slider will have no ceiling. This is the same behaviour as the old proxy in that case
(`ts.PowerLimit` was also null for unconfigured miners).

## Pause / resume decision (Issue #31)

**Choice: option 1 — native `pause()`/`resume()` from asic-rs.**

The asic-rs `Miner` trait includes `Pause` and `Resume` traits via `HasMinerControl`:

```rust
pub trait Pause {
    async fn pause(&self, at_time: Option<Duration>) -> anyhow::Result<bool>;
    fn supports_pause(&self) -> bool;
}
pub trait Resume {
    async fn resume(&self, at_time: Option<Duration>) -> anyhow::Result<bool>;
    fn supports_resume(&self) -> bool;
}
```

`proxy-rs` calls `miner.supports_pause()` / `miner.supports_resume()` first. If the
firmware supports it, the native call is made. If not, a `502` is returned with an
error message indicating the firmware does not support pause/resume.

**Consequence:** `grpcurl` is NOT needed in the Docker image (removed in Dockerfile).
`server/proxy.cjs` used `grpcurl` + `braiins.bos.v1.ActionsService/PauseMining` because
the old proxy was not using a library — it called gRPC directly. asic-rs handles the
Braiins gRPC protocol internally for firmwares that support it.

**Maintainer action required:** Verify on a real BraiinsOS miner that
`supports_pause()` returns `true` and the pause/resume round-trip works correctly.
If a BraiinsOS miner returns `supports_pause() == false`, file a bug against asic-rs
or fall back to option 3 (keep grpcurl and implement a thin BraiinsOS gRPC fallback).

## Fields asic-rs does NOT give (and our fallback)

| Missing field             | Fallback used                                           |
|---------------------------|---------------------------------------------------------|
| Power limit for all FW    | `tuning_capabilities.power.maximum` if available, else `null` |
| Fan speed as percentage   | Derived from `FanData.rpm` ÷ 6000 RPM × 100, capped at 100 % |
| Explicit "paused" state   | `live.th == 0` and `live.watts == 0` signal paused state to UI |
