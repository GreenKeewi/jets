# Strike & Escape update

Attack-role bombers depart Coastal and strike a depot just beyond Northpoint's far runway threshold; defend-role bombers depart Northpoint and strike a depot beyond Coastal's far threshold. Targets are more than 14 km from their attacking base, with a return escape leg greater than 10 km. The depot model, marker, HUD guidance and bomb collision use the same role-dependent objective.

The bomber's aim ring traces its boosted world-velocity ballistic path against actual terrain (45 m/s² arcade bomb gravity), rather than assuming sea-level impact. Bombers retain bombs and guns only: they cannot launch fighter missiles. AI bombers climb early for the ridge, hold their final bombing altitude while bombs fall, and level their wings during terrain recovery so banked turning does not consume their limited pitch authority.

Airfield SAMs are a deliberately cinematic arcade mechanic. An airborne bomber inside 4.2 km of the enemy depot may encounter up to two SAM launches per sortie, separated by at least 48 seconds plus a seeded 0–12 second delay. No overlapping active SAM is spawned. A bomber flare burst younger than 2.2 seconds always decoys these tagged SAMs, independent of throttle, range or random chance; this does not alter fighter missile countermeasure probabilities. Deploy flares after the missile warning, before impact. The existing warning audio/indicators see them as heat threats. Chaff alone does not defeat them. These values are gameplay balancing, not real air-defence modelling.

Automated coverage includes full AI departure/bombing/escape from all three bases at 30/60 Hz, both enemy-objective directions, 20 seeded flare encounters each at 30/60/120 Hz, launch spacing/cap, bomber loadout, and terrain-aware ballistic prediction.
