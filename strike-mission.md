# Strike & Escape update

Attack-role bombers depart Coastal and strike a depot just beyond Northpoint's far runway threshold; defend-role bombers depart Northpoint and strike a depot beyond Coastal's far threshold. Targets are more than 14 km from their attacking base, with a return escape leg greater than 10 km. The depot model, marker, HUD guidance and bomb collision use the same role-dependent objective.

The bomber's aim ring traces its boosted world-velocity ballistic path against actual terrain (45 m/s² arcade bomb gravity), rather than assuming sea-level impact. Bombers retain bombs and guns only: they cannot launch fighter missiles. AI bombers climb early for the ridge, hold their final bombing altitude while bombs fall, and level their wings during terrain recovery so banked turning does not consume their limited pitch authority.

Airfield SAMs are a deliberately cinematic arcade mechanic. An airborne bomber inside 4.2 km of the enemy depot may encounter up to two SAM launches per sortie, separated by at least 48 seconds plus a seeded 0–12 second delay. No overlapping active SAM is spawned. A bomber flare burst younger than 2.2 seconds always decoys these tagged SAMs, independent of throttle, range or random chance; this does not alter fighter missile countermeasure probabilities. Deploy flares after the missile warning, before impact. The existing warning audio/indicators see them as heat threats. Chaff alone does not defeat them. These values are gameplay balancing, not real air-defence modelling.

Automated coverage includes full AI departure/bombing/escape from all three bases at 30/60 Hz, both enemy-objective directions, 20 seeded flare encounters each at 30/60/120 Hz, launch spacing/cap, bomber loadout, and terrain-aware ballistic prediction.

## Offshore Northpoint revision

Northpoint's airfield is now at `(10500, 11000)`, with its island, ridge terrain, village, vegetation and roads translated together. Coastal-to-Northpoint runway distance is 17.897 km (formerly 13.685 km), about 31% farther. The direct route crosses 3.90 km of continuous open water; 120-sample perimeter comparisons show approximately 3.02 km between the nearest sampled home/enemy shores. The scenic Northpoint tour follows the moved island and still returns to Coastal. Defender escape is derived from the new Northpoint airfield location.

The shoreline finder now stops at the first ocean crossing, preventing a ray from jumping a channel and accidentally using a neighboring island's shoreline. Geography evidence in `evidence/v1.0.9/northpoint-overhead.png` uses actual WebGL game terrain with a diagnostic overhead camera and fog disabled; it is a geography inspection, not a normal flight screenshot. `map-metrics.json` records the sampled measurements and zero browser page errors.
