# decohere() — build notes

Single-page scroll-storytelling site: Vincent's life as an OS / quantum-cloud.
One persistent Three.js particle system (Vincent = hexagon/orange) that morphs shape→shape per
scroll "beat", plus separate entity systems. Dark→navy luminance arc. md-driven copy.

## Files
- `index.html` — shell: importmap (three + lenis via CDN), fonts (Clash Display / JetBrains Mono / Satoshi),
  CSS (beat layout, text-shadow legibility, sticky uptime HUD), `<canvas>`, DOM built from md.
- `decohere.js` — engine (ES module): md parse + DOM build, particle systems, scroll mapping, render loop.
- `content/decohere.md` — all copy (RTFM/docstring voice). Edit text here; engine reads it. `::sig` + `::doc` per beat.
- `teddybeer.html` — old index (image-blend page) preserved via `git mv`.

## Beats (scroll order)
start (static field) · boot (hex baby) · syntax_error parse(child) Ø · core_dump @13 grey street ·
recompile→bootstrap (cube) · daemon (lattice) · daemon.attach(lieverd) (hexagon+heart, Venn) ·
spawn_child smurf (red ECG) · spawn_child boefje (blue ECG) · neurotype_export @44 (hexagon + 3 forward lobes) ·
kernel_panic :: daemon (stripe glitch + tear; heart turns blue, dilates, explodes) · restart→standalone (helix flow).

## Entities / colours
- Vincent = hexagon sprite, orange `#e67e22` (the morphing cloud).
- Leydi = heart→snowflake sprite, pink `#ff7ac1` → cold blue `#3a7bff`. Flies in from off-screen,
  fills a heart (Venn with Vincent hexagon), colour-shifts + dilates + disintegrates, then explodes at panic.
- Josefina ('smurf') = circle, red `#ff5147`. Benjamin ('boefje') = square, blue `#2e7bff`.
  Children spawn in their own beats, emerge from heart/cloud elements, render as broad ECG heartbeat lanes,
  survive the kernel panic (child processes STILL RUNNING), orbit inside the final helix.
- No real names on the public page (ex never named/negative; kids are codenames).

## Key mechanics
- Particles morph shape→shape directly (no nebula between scenes).
- **Scroll dwell**: `beatFrom()` eases the fraction between section centres → scrolling has less effect the
  nearer a chapter is to screen centre (chapters anchor/feel weighty).
- **start step**: only roaming grey "static" particles (no centre point). Scrolling toward decohere starts the
  infall; boot coalesces FROM the infall (birth from the quantum infall).
- **infall**: ~760 grey dots; roam on `start`, then continually fall in and feed the *actual* live cloud shape
  (each dot targets a random live cloud point). Bright on start+boot, dim through later stages.
- Sticky **uptime HUD**: real time since 1980-02-18, ticking.
- Tron-modern: bloom + RGB-shift glitch, neon on dark, green terminal accent.

## Run / verify
Serve over http (fetch needs it): `python -m http.server 8000` → open `localhost:8000`.
No build step; pure static, deploys via GitHub Pages on `main`.

## Open / possible next
- Deploy to paniekpoppetje.nl.
- Tune: neurotype brightness, panic readability, helix density, mobile pass.
