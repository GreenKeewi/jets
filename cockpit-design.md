# Seated cockpit

The cockpit is original low-poly geometry: two flight-suit legs, boots on rudder pedals, a central stick and left throttle inside side consoles. Actual control inputs drive the stick and feet; actual engine lever state drives the throttle. Input smoothing has the same response at different frame rates. It does not add head shake, flashing or camera movement.

Visual research: Eagle Dynamics' [official DCS F-16C manual](https://www.digitalcombatsimulator.com/en/downloads/documentation/dcs-viper_early_access_manual_en/), page 43, cockpit overview (viewed 23 October 2026). Its recessed instrument cluster, side-console enclosure and left-side throttle informed the composition. Our central stick and simplified geometry deliberately describe a fictional aircraft; this is not an F-16 replica or simulator-fidelity cockpit. No DCS images, textures or models are distributed with the game.

The near interior is drawn with a stable eye-space perspective after the outside scene. This avoids clipping cockpit geometry against the world's long-range depth buffer and keeps outside speed-FOV changes from stretching the pilot's legs. The existing readable instrument canvas remains above the lap. The aiming center and horizon remain clear. Keyboard controls remain the primary interaction; decorative switches do not imply clickable simulated systems.
