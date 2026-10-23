# v1.0.14 respawn timing correction

- Full game regression suite: 268 tests passed, zero failures. Includes legacy minute config/API migration to 30 seconds and Off preservation, synchronized host/guest settings, locked settings, late join/rejoin, human exclusion, runway queues, and timer boundaries at 20/30/60/144 fps.
- Backend regression: 15 tests passed, zero failures. No deployment/configuration changes to backend.
- Browser: `tests/enemy-respawn-browser.cjs` passed with two rendered game documents, host selecting the default 30 seconds, guest read-only state, controlled crashes through real kill logic, synchronized countdown, accelerated 30-second deadline, grounded Northpoint respawns and fresh-sortie reset. No page errors.
- Inspected desktop/narrow host settings and countdown screenshots in `browser/`; 30-second selection and countdown are readable.
- The first regression run found one stale test expectation of 300 seconds after choosing 60; corrected the expectation and reran the full suite successfully.

Limits: native WebRTC still returns NoLocalCandidatesError under managed policy. Browser tests use deterministic RTC fixture and accelerated simulation time, not a public network or full sortie playtest. No security bypass or new credentials. The prior setting was session-only, not browser-persisted; legacy numeric values normalize at host-setting/config entry points. Public release verified separately by Pages commit and file hashes.
