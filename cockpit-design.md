# Seated cockpit

The cockpit is original low-poly geometry: two flight-suit legs, boots on rudder pedals, a central stick and left throttle inside side consoles. Actual control inputs drive the stick and feet; actual engine lever state drives the throttle. Input smoothing has the same response at different frame rates. It does not add head shake, flashing or camera movement.

Visual research: Eagle Dynamics' [official DCS F-16C manual](https://www.digitalcombatsimulator.com/en/downloads/documentation/dcs-viper_early_access_manual_en/), page 43, cockpit overview (viewed 23 October 2026). Its recessed instrument cluster, side-console enclosure and left-side throttle informed the composition. Our central stick and simplified geometry deliberately describe a fictional aircraft; this is not an F-16 replica or simulator-fidelity cockpit. No DCS images, textures or models are distributed with the game.

The near interior is drawn with a stable eye-space perspective after the outside scene. This avoids clipping cockpit geometry against the world's long-range depth buffer and keeps outside speed-FOV changes from stretching the pilot's legs. The existing readable instrument canvas remains above the lap. The aiming center and horizon remain clear. Keyboard controls remain the primary interaction; decorative switches do not imply clickable simulated systems.

## B-2-inspired bomber flight deck (v1.0.9)

The bomber now selects its own geometry and instrument panel instead of reusing the fighter tub. The viewpoint is the left seat, with an off-center windshield post, a wide two-station display panel, center pedestal, right seat, two sticks and grouped throttle banks beside each station. Legs and pedals remain visible. Both sticks and the throttle groups animate from actual pilot input and engine command. The game still has one throttle axis; eight lever meshes move together as an explicit arcade simplification, not an independent-engine simulation.

Public references inspected on 23 October 2026:

- [Official White House photograph by David Bohrer, 27 October 2006](https://georgewbush-whitehouse.archives.gov/news/releases/2006/10/images/20061027-6_b2cockpit-1-515h.html), preserved in the National Archives: broad instrument panel, split front windows, center console and two seats. This is a historical photograph, not a claim about every current cockpit modification.
- [National Museum of the USAF B-2 fact sheet](https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/195832/northrop-b-2-spirit/): pilot on the left, mission commander on the right. Its displayed airframe was a structural test article without instruments, so it was not used as a cockpit reference.
- [Jeff Bolton / Defense News publicly released in-flight cockpit footage](https://www.youtube.com/watch?v=RndAqOJUa5g): central control stick and left-of-pilot engine controls, inspected through a publicly reproduced still from that footage. The official USAF/Northrop gallery search did not yield a clearer accessible interior view.

All geometry and display art are original. Display contents show only actual arcade-game telemetry: knots, altitude, attitude, signed G, fuel, power command, gear/airbrake and stores. They do not reproduce authentic B-2 avionics pages, classified functions, procedures or independently simulated engine readings. The fighter cockpit is unchanged. Below 560 CSS pixels the secondary station is omitted from the instrument canvas to keep essential telemetry readable; the broad physical flight deck remains. The fixed interior adds no shake or flashing and respects the existing keyboard interface and reduced-motion behavior.
