# Aircraft and loadout references

Reviewed 28 October 2026. Aircraft geometry is generated in code; no photographs, models, logos, or other copied assets are used.

The [US Air Force F-16 fact sheet](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104505/f-16-fighting-falcon/) identifies the F-16 as a compact multirole fighter and states that its external stations can carry up to six air-to-air missiles. It gives internal fuel as 3,175 kg. The official page and [138th Fighter Wing fact sheet](https://www.138fw.ang.af.mil/Portals/34/documents/F-16%20Fact%20Sheet%20Small.pdf) were available in indexed search text; direct retrieval returned HTTP 403 in this environment.

The [NAVAIR F/A-18E/F Super Hornet product page](https://www.navair.navy.mil/product/FA-18EF-Super-Hornet) identifies the E as the single-seat version of the twin-engine Super Hornet. Its specifications describe a ferry configuration with three external tanks. This supports including three tank positions for the F/A-18E game variant.

The game uses bounded station assignments rather than accepting missile or tank counts supplied by a client. F-16 wingtip stations accept heat missiles; four modeled underwing missile stations accept heat or radar missiles. Three separate modeled tank positions allow six missiles and three tanks together. The F/A-18E and Su-37 use limited air-to-air game layouts. These layouts do not claim to enumerate real aircraft weapon clearances, launcher arrangements, or all possible configurations. Heat and radar are gameplay weapon categories.

The Su-37 is labeled as a prototype. Its eight game missile positions do not imply a production or operational clearance. External fuel tanks are not offered for this variant.

All flight coefficients, dry masses, fuel burn rates, speed caps, and internal fuel values are simplified game tuning. The F-16 retains the existing rounded 3,200 kg internal capacity. Each selected F-16 or F/A-18E external tank adds exactly 20% of that aircraft's internal capacity by an explicit game balance rule, rather than using the physical volume of a real external tank. Starting fuel applies to internal fuel; external tanks begin full. Fuel mass includes the resulting combined fuel, and the HUD reports remaining fuel as a fraction of the combined capacity.

Canonical assignment format:

```json
{"stations":{"wingtip-l":"heat","wingtip-r":"heat","outerwing-l":"heat","outerwing-r":"heat","midwing-l":"radar","midwing-r":"radar","innerwing-l":"tank","innerwing-r":"tank","centerline":"tank"}}
```

Malformed station IDs, arbitrary counts, unsupported store types, and incompatible station assignments are never converted into extra stores. Remote validation rejects them; local preference normalization turns invalid station values into empty positions.

Visual/cockpit cross-checks also used the [183rd Wing F-16 fact sheet](https://www.183wg.ang.af.mil/RESOURCES/Fact-Sheets/Article/459577/f-16-fighting-falcon/), [NASA TP-2857 Figure 10](https://ntrs.nasa.gov/api/citations/19890014956/downloads/19890014956.pdf) for the right-hand controller, and [MAKS’ Su-37 retrospective](https://t.me/s/aviasalonmaks/3010) for prototype, canard and thrust-vectoring cues. The visible Su-37 nozzle movement is an animation, not a modeled thrust-vector control system. [War Thunder’s custom weapon setup article](https://warthunder.com/en/news/7620/current/) informed the aircraft-constrained station interaction; none of its assets were copied.
