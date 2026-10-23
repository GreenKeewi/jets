# v1.0.11 combined validation

Co-op teams and rapid finite countermeasures integrated on published v1.0.10, preserving terrain radar and bomber balance.

- 247 game tests passed, including radar transforms/cache, bomber lock/altitude, team validation/ownership, friendly targeting, finite inventories, rapid press queues, diminishing burst chances, exhaustion, restock, variable frame rates and existing flight/mission regressions.
- 15 backend tests passed, including two real local WebSocket clients in one co-op room, synchronized controlled victory, validated join/team limits, and exact replicated inventory after rapid countermeasure input.
- Local Cloudflare Durable Object smoke test passed six-client/capacity/authority/security checks. No public deployment or credentials were configured.

Browser artifacts in `combined-coop/` and `combined-counters/` document final-build UI/input checks. Co-op uses two actual rendered game documents and a disclosed deterministic RTC data-channel fixture; native WebRTC offer creation failed with `NoLocalCandidatesError` under the managed `disable_non_proxied_udp` policy, which was not changed. Controlled terminal fixtures verify synchronized victory, not a full combat sortie. Real local WebSocket tests cover dedicated transport; cross-network internet play remains unverified.

Earlier isolated module evidence is retained in `coop/` and `countermeasures/`. Sound is not human-listened. Public Pages browser certificate restrictions were not bypassed; deployment and downloaded artifact hashes are verified separately.

Final browser checks passed with zero page errors; screenshots inspected. Native guest presses reduced replicated stocks from60/60 to57/58 on both host and guest. Standalone rapid/held/rebind tests also passed, retaining camera V.
