# Authoritative shared multiplayer backend

## Current status

The repository contains a server-authoritative backend, a browser transport adapter, staged game/menu integration, and repeatable local tests. The existing game remains playable solo and through its existing PeerJS friend rooms. Dedicated-server endpoints are empty by default: the presence of this code does **not** mean a public server has been deployed.

The selected deployment target is **Cloudflare Workers Free + one SQLite-backed Durable Object**. This provides one shared sky for up to six human pilots, with bots filling remaining seats. The Durable Object runs the same `sim.js` as the browser; clients submit controls, never positions, health, damage or scores. The server owns the simulation and respawn decisions.

The server asks Cloudflare for eastern North America (`enam`). This is a best-effort location hint, not a guarantee of Canadian hosting or measured latency. Players anywhere can connect to the same server; distance and network route affect latency. There is no cross-region simulation or promise that global play is always slower.

## Architecture

- `server/protocol.js`: dedicated transport version/build, strict input/join validation, sequencing, discrete-action buffering, cooldowns and stale-control expiry.
- `server/rooms.js`: shared simulation, server-generated identities, six seats, bot takeover, empty-room cleanup and completion timeout.
- `server/cloudflare/worker.js`: one shared Durable Object; origin checks, connection/message limits, 4 KiB incoming messages, 60 Hz fixed physics, roughly 10 Hz snapshots. The timer stops when empty. Active gameplay cannot hibernate.
- `server-client.js`: optional browser adapter, 20 Hz maximum input sends with coalesced action pulses, unchanged-control refresh around 10 Hz, 100 ms snapshot interpolation, ping, disconnect handling and respawn requests.
- `multiplayer-router.js` and `server-ui.js`: staged game/menu integration. Valid configured endpoints expose the shared-sky controls; an empty or invalid configuration hides them and makes no server requests. Only one transport can own a match. Dedicated disconnects preserve solo and friend-room options.
- `server/index.js`: alternative standalone Node/WebSocket service, useful for local integration testing or another host. Unlike the selected Cloudflare deployment, it can create a bounded number of separate rooms.

There is no database account system, authentication secret, player password, persistent profile, chat, payment integration or connection to unrelated projects. Match state is in memory. Deployments/restarts can end a match; reconnecting assigns a new seat, not a persistent identity. Origin checks reduce casual abuse but are not authentication and can be spoofed by non-browser clients. A public anonymous service can have its free quota exhausted by abuse. The six-seat cap limits simultaneous play, not total API requests from hostile clients.

## Free-plan budget

Checked against Cloudflare's official documentation on 22 October 2026:

- Durable Objects Free: 100,000 billable requests/day and 13,000 GB-seconds/day. Incoming WebSocket messages count at 20:1 for billing; outgoing messages do not incur request charges.
- At 20 control messages/second/player, the request allowance is approximately **27.8 aggregate player-hours/day before overhead**, or about **4.6 hours with all six seats continuously occupied**. Pings, connections, health checks, other account usage and abuse reduce this. This is not a count of unique users.
- A single object active continuously for 24 hours at the documented 128 MB allocation uses approximately 11,059 GB-seconds. Only one shared object is created by this implementation. Other Durable Objects in the account consume the same allowance.
- Unchanged controls are sent less often (around 10 Hz), which can extend the request allowance during steady flight. The conservative capacity estimate above still assumes continuous 20 Hz changes.
- Workers/DOs have no separate data-transfer egress charge; this is not a Cloudflare Container. Mobile data and real network bandwidth still matter. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
- Active simulation timers prevent hibernation; no claim is made that WebSocket hibernation makes an active game free of duration usage.
- The Workers **Free** plan stops serving operations when its limits are exceeded rather than automatically upgrading. Confirm the account is actually on Free before deployment. Do not upgrade to Paid or add payment details as part of this setup.
- SQLite is selected because Free supports SQLite-backed Durable Objects. The implementation does not write game state to storage.

Sources: [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [location hints](https://developers.cloudflare.com/durable-objects/reference/data-location/).

## Run the Node tests

From the repository root:

```sh
npm ci --prefix server
npm test --prefix server
```

Tests cover strict packet validation, action consumption, stale controls, identity isolation, six-seat capacity, disconnect cleanup, actual local WebSocket snapshots, invalid builds, binary/oversized packets, region probing and the browser adapter. The Node service can be run with:

```sh
REGION=enam ALLOWED_ORIGINS=https://greenkeewi.github.io npm start --prefix server
```

For local browser testing, explicitly add the local browser origin to `ALLOWED_ORIGINS`. Do not use a wildcard for production.

## Build and test Cloudflare locally

```sh
npm ci --prefix server/cloudflare
npm run build --prefix server/cloudflare
npm run dev --prefix server/cloudflare
# In a second terminal:
node server/cloudflare/smoke.mjs
```

The build command is a dry run and does not deploy. A local-runtime alternative is available for environments where Wrangler's network-interface discovery fails:

```sh
bash server/cloudflare/test-local.sh
```

This helper rebuilds and starts both the runtime and smoke clients in one shell. It uses `dist/worker.js` and local Miniflare/workerd, not a Cloudflare account. `smoke.mjs` defaults to localhost; a verified public origin can be supplied explicitly for post-deployment testing. Run it only when six temporary test clients will not interrupt other players.

Local verification completed on 22 October: 10 Node/browser-adapter tests passed, staged controller/router/UI tests passed, Cloudflare bundle dry-run passed, and six actual WebSocket clients passed the local workerd smoke test (shared room, capacity rejection, simulation progress, finite state, CORS, spoofed-identity rejection and malformed-message closure). The local WebSocket handshake negotiated `permessage-deflate`; reported JSON snapshot sizes are uncompressed, not measured on-wire data. These local tests do not establish Canadian/mobile latency or production uptime. Rebuild and rerun against the final simulation after later game edits.

## Deployment access and steps

Do not put a Cloudflare API token in the browser, repository, chat, a URL or a public build. Use an approved secure connector or secret handoff. No domain/DNS changes are required: a dedicated `workers.dev` URL is sufficient.

Current Cloudflare roles distinguish creation from editing: creating a new Worker requires product-level Workers Admin; deploying an existing Worker needs only Editor for that Worker. The narrowest route is to create an empty `skybreak-jets` Worker first, then grant per-Worker Editor. Any broader creation access must be explicitly approved. No access to existing websites, DNS, R2, KV, D1 or unrelated applications is needed. [Workers permissions](https://developers.cloudflare.com/workers/authorization/workers/).

After access and the Free plan are verified:

1. Rebuild from the final game revision and run all backend tests.
2. Deploy `server/cloudflare/wrangler.jsonc` using the approved account. The migration creates only the `SkyRoom` SQLite Durable Object class. The binding name is `SKY`.
3. Verify the returned public `/health` response: protocol `SKYBREAK-SERVER-1`, build `skybreak2-1022`, region label `enam`, capacity six.
4. Run a short authorized public smoke test and inspect failures/quotas. Recheck empty-room cleanup afterward.
5. Add only that verified origin to `SERVER_ENDPOINTS` to activate the already-integrated game UI and transport. Do not advertise the button as available while the endpoint is absent.
6. Test two independent browser contexts through the deployed frontend and measure ping. Physical separate-network/mobile testing is a separate coverage item.

## Browser integration contract

```js
const server = createServerClient({
  onControl(message) { /* message.type === 'start': start(message.config, true) */ },
  onSnapshot(value, meta) { /* apply initial snapshot, then sampleSnapshot per frame */ },
  onState(state) { /* state.role is guest for an active server match */ },
  onDisconnect(id, reason) { /* return to menu and explain how to rejoin */ }
});
await server.connect({id:'enam', label:'Shared sky · Eastern North America', url:verifiedOrigin},
  {pool:'global', arenaId:'coast'});
server.submitInput(controls);
const frame = server.sampleSnapshot();
server.requestRespawn();
server.disconnect();
```

Do not locally step the simulation while connected. Send neutral controls while a menu is open or focus is lost. The server owns match starts and cannot be paused/restarted by an individual guest. Respawn uses `requestRespawn()` rather than offline `respawnPilot`. If the server is full or unavailable, retain solo and friend-room play. Route-assist `autopilot:false` is accepted for compatibility; `true` is rejected in shared dogfights.

The optional endpoint-probing functions remain independently tested for a future multi-host configuration, but the selected Cloudflare deployment is one shared server, not multiple regional deployments.
