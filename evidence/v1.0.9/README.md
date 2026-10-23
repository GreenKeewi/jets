# v1.0.9 cloud validation

Scope: dedicated original B-2-inspired cockpit; speed cues and wind/engine mix; separate Northpoint island; longer winding valley; gentler airbrake. The independently published v1.0.8 G fix remains intact.

- 223 game tests and 12 standalone server tests passed. Local Cloudflare Durable Object runtime passed six-client join/capacity/authority/security smoke checks. Logs alongside this file.
- Native keyboard bomber cockpit launch and live controls passed at desktop/narrow/phone sizes. Inspected screenshots in `cockpit-final/`. Fighter-specific regression evidence remains alongside the original cockpit evidence.
- Browser keybinding conflict/remap/persistence/reset and normal gear/airbrake checks passed. Settings screenshot in `controls-final/`.
- Physical G/frame-rate/wear/repair and airbrake decay/landing regressions passed in the full unit suite. Browser G response verification in `g-final/` uses an explicit airborne initial fixture followed by native input and normal animation frames.
- Terrain metrics and inspected actual WebGL overhead screenshot demonstrate separate islands. Valley geometry and five 20-second AI scenarios pass; screenshot uses an explicitly documented low-flight fixture, not a full human-flown valley run.
- Web Audio PCM/live-context checks are functional measurements, not listening. No human audio playback assessment is claimed.

Public multiplayer remains inactive (`SERVER_ENDPOINTS=[]`): no Cloudflare deployment access is configured, and no credentials/accounts were created. Existing peer room code is separate and was not validated across networks. Public HTTPS browser navigation encountered a certificate warning in this environment; it was not bypassed. Local gameplay and GitHub Pages deployment/artifact checks are reported separately.

Complete final-build native-keyboard Strike & Escape passed in the B-2 cockpit: runway takeoff, island approach, SAM flare defeat, target destruction and successful escape at 189.75 simulation seconds with full health and zero browser errors. See `strike-keyboard/README.md` and inspected screenshots/report.
