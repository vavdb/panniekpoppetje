# decohere() — handover (vervolg)

Status van de scroll-storytelling site. Engine = `decohere.js` (Three.js `Points`, geen particle-lib), copy = `content/decohere.md`, shell/CSS = `index.html`. Serve over http (`python -m http.server`), test met `?v=N` om CSS-cache te omzeilen.

## Sessie 3 — OPEN PUNTEN (Vincent, nog te doen) — met mijn context/diagnose

Engine = `decohere.js`. Test: `python -m http.server 8731`, open over http. Verifieer altijd in browser (playwright of zelf), beats via `#beat-<id>`. Beats-volgorde: start, boot(00), syntax_error(01), core_dump(02), bootstrap(03), daemon(04=honeycomb hexagon), attach(05), spawn_smurf(06a), spawn_boefje(06b), neurotype_export(07), kernel_panic(08), restart(09). `P=idx.kernel_panic`, `Re=idx.restart`, `A=idx.attach`, `Bo=idx.spawn_boefje`, `Ne=idx.neurotype_export`, `Bs=idx.bootstrap`.

1. **Tetris-blokken één-voor-één i.p.v. links→rechts.** Nu in de loop (`cdStagger`-tak, ~`p1 = smoothstep(0.05 + b*0.06, 0.46 + b*0.06, f)`): de per-piece stagger gebruikt `b` (piece-index). `tBlock[i]` komt uit `CELL_PIECE[col,row]` = ruimtelijke positie op het 7×4 bord → piece-index correleert met x → leest links→rechts. **Fix**: geef elk piece een eigen RANDOM volgorde-offset (bijv. een `pieceOrder[7]` shuffle, of stagger op afstand-tot-centrum) i.p.v. `b*0.06`. Dan vallen ze één voor één in willekeurige/centrum-uit volgorde, niet L→R.

2. **Bij kernel_panic→hydrogen vormt de helix al te vroeg (weird).** `helixFlow = smoothstep(Re - 0.32, Re - 0.02, bf)` (loop ~`restartFlow`-regel). De orbital vormt via de hoofd-morph `e` (panic→restart). Helix-deeltjes (`i/N>=0.66`) collapsen eerst in de orbital (`ccx=-74+...`) en stromen uit met `helixFlow`. Maar `Re-0.32` overlapt nog met de orbital-vorming → helix begint terwijl hydrogen nog vormt. **Fix**: helixFlow LATER (bijv. `smoothstep(Re-0.1, Re, bf)`), of TIJD-gebaseerd ná aankomst (zoals `sunRise`: een `let helixRise=0; helixRise += ((restTone>0.6?1:0)-helixRise)*0.01`) zodat de hydrogen eerst helemaal staat, dán pas de helix uitstroomt.

2b. **Helix moet LEEG beginnen en STROMEN (niet ineens gevuld verschijnen).** Nu verschijnt de helix als een al-gevulde spiraal (alle deeltjes tegelijk op hun helix-pos via `helixFlow`). Vincent wil: helix start LEEG, en zodra de scène (hydrogen) staat begint hij te STROMEN — de spiraal "tekent zichzelf" / deeltjes reizen langs het pad vanuit de orbital naar buiten. **Aanpak**: per-deeltje een flow-front op de helix-parameter `v` (de `v` heeft al `+ t*0.01` drift). Geef elk deeltje een `vStart` en laat een front `flowT` (tijd-gebaseerd, start zodra `restTone`/scene staat) bepalen tot welke `v` de helix "gevuld" is: deeltjes met `v <= flowT` zichtbaar/op-positie, daarvoor onzichtbaar (opacity 0) of nog in de orbital-collapse. Zo stroomt de spiraal vanuit het centrum naar buiten i.p.v. ineens vol. Combineer met punt 2 (pas starten als hydrogen volledig staat). Let op: de helix gebruikt de hoofd-`cloud` (vertex-opacity bestaat niet → "leeg" = collapsen in de orbital-kern `ccx/ccy/ccz` totdat het front ze vrijgeeft, of hun grootte/positie pas vrijgeven bij `v<=flowT`).

3. **kernel_panic flitst alleen WIT, geen ROOD.** Kleur-tak (`else if (pp > 0.05)`, ~regel 651): cmat wordt wit geforceerd (`smoothstep(0.08,0.4,pp)` in de white-lerp ~regel 612), cCol = wit-flash `1.6`, errored=rood `(1.0,0.16,0.16)`, nog-niet=groen `(0.12,0.5,0.3)`. `redden = smoothstep(P-0.55, P+0.25, bf)`. **Vermoeden**: (a) bloom (~0.6 op panic) blaast het rood naar wit/roze, en/of (b) op het zichtbare moment heeft `redden` nog niet genoeg punten ge-errord (de meeste groen/wit, weinig rood), en/of (c) additive blending op `(1,0.16,0.16)` leest licht. **Fix-ideeën**: bloom verlagen tijdens panic (`- 0.3*pp` in `bloom.strength`), rood donkerder/verzadigder maken, `redden` venster checken zodat het écht volrood wordt vóór restart, en de wit-flash korter/zeldzamer (`<0.03`). Volgende sessie frame-voor-frame bij `P-0.2 … P+0.2` verifiëren.

4. **Regen valt weer te vroeg (vóór de witte scène gevormd is).** `fallPhase = smoothstep(sx + 0.55, sx + 0.78, bf)` (sx=idx.syntax_error). De "witte scène" = het WITTE HUIS (grijs/wit `VINCENT_TINT.syntax_error=0x9a9aa2`), eerst vastgehouden (`sxHold`/`sxEase = smoothstep(0.34,1.0,f)`) en dán gemorpht naar de straat. Spanning: te laat (`sx+0.82`) → "decohereert al naar make"; te vroeg (`sx+0.55`) → regen vóór huis af. **Aanpak volgende sessie**: visueel bepalen bij welke `f` het witte huis volledig leest (waarschijnlijk f≈0.45–0.6, tijdens/na de `sxEase` morph) en `fallPhase` net daarna laten starten met een SMAL/snel venster (`smoothstep(sx+0.62, sx+0.8)`), `started`-stagger klein houden (nu `(fallPhase - hash*0.12)*5` = bijna allemaal tegelijk = goed). Per frame checken tussen `sx+0.3 … sx+1.0`.

5. **Zon: nog kleiner + blijven bewegen?** `sunHalo`/`sunStar` (mkSun, scale 220/145). Maak kleiner (bijv. 160/110). Beweegt nu: boogt omhoog via `sunRise` (tijd-eased) en blíjft daarna staan; `sunStar.material.rotation += 0.0011` (stralen draaien al). **Wens**: blijven bewegen — laat de zon ná aankomst zacht verder driften/boben (bijv. `sun.position.y += sin(t*0.2)*klein`, of `sunRise` net voorbij 1 laten ademen).

6. **Vincents vraag (nog niet beantwoord): "die versie waar de lattice een organische wavey links→rechts flow werd".** → Dat is de **node-sweep** (`sweepTone`-tak, ~regel 617): per horizontale rij een bewegende band (`band = -56 + ((t*speed + row*0.17)%1)*112`, elke rij eigen `speed`), kleurt groen→paars→groen die als een golf links→rechts over het honeycomb-hexagon loopt (daemon→neuro). Dát is het "organische wavey L→R flow"-patroon — zit er nóg in (zichtbaar op daemon/attach/neuro). Optie: prominenter maken, of als een apart "moment" inzetten, of het idee hergebruiken op de panic-lattice (i.p.v. de random rood-flash) als Vincent dat bedoelde.

7. **Groene lattice mag weg uit het einde.** De `backdrop` ent (`hexLatticeTarget(NB, 42, -74)`, z−48, groene node-sweep, `opacity = restTone*0.42`) — de "daemon/nest draait nog achter pure me" achtergrond bij restart. Vincent wil 'm WEG uit het einde. **Fix**: `backdrop` verwijderen of `backdrop.m.opacity = 0` (en evt. de hele ent + per-frame update strippen). Check dat niets anders ervan afhangt (niet).

## Sessie 2 — toegevoegd (browser-geverifieerd)
- **btop-monitor** (`#mon` canvas, links-boven): faux `load`+`mem` sparklines. **Story-driven**: `mem` vult bij elk proces (partner @attach, 2 kids @smurf/boefje), valt bij `kernel_panic` (partner gekilld); `load` piekt bij stress (boot-infall, homeless straat, panic, scroll-velocity), kalm bij restart. Tune in `decohere.js` `drawMon()` + de monitor-update in `frame()`.
- **Tetris-rebuild** (`core_dump` → `bootstrap`): straat → 7 zwevende **tetromino-blokken** (1 = `PURPLE_BLOCK` anomalie) → kubus. Per-deeltje `tBlock`/`tetLocal`/`blockAnchor` (precompute na `cdOff`), 2-staps morph in de loop (`p1` gather, `p2` converge), paarse kleur-branch (`cdStagger`) in de cCol-sectie. Kubus-eindstand = onveranderde `targets.bootstrap` (zodat bootstrap→daemon correlatie intact blijft).
- **Persistente console** (`#compile`, links-onder): 1 stdout-regel per beat (`LOG` map) met knipperende cursor, getypt op `cen`; bootstrap toont nog steeds de volle `COMPILE` build-log. Regels staan nu hardcoded in `decohere.js` (`LOG`) — evt. naar `::log` in de md verplaatsen.
- **Dual klokken** (`#hud`): wall-time `uptime` + scroll-`sim-time` (zie eerdere sessie).
- Polish deze sessie: heart edge-only pulse + inside wobble; heart-decay start NA neurotype (`P-0.7`); donkere hexagon vanaf `attach` + bloom-cut matcht neurotype; groen→paars sweep loopt nu DOOR neurotype onder de gele lobes; flash bij neuro-entry weg (sweep cCol full-strength, cmat white near-binary); gezin onderaan + partner fade-in-place (`famGone` via nearest-`-3`); tekst-leesbaarheid (lichter `--muted` + sterke halo). Voorste-pop van de sweep is op verzoek verwijderd.

## Nog te doen (deferred)

> **Alle deferred items hieronder = ✅ AFGEROND deze sessie** (browser-geverifieerd, geen console-errors, niets gecommit). Detail per item hieronder. Daarnaast deze sessie gefixt:
> - **Daemon sweep las blauw i.p.v. groen-paars-groen** → oorzaak: `sweepAmt = smoothstep(daemon-0.1, daemon+0.4)` was ~0.1 op daemon-centrum → dimme paars leest blauw onder additive bloom. Fix: `smoothstep(daemon-0.5, daemon-0.05)` → volle sweep op daemon-centrum. (Hexagon-beats waren al goed want daar was `sweepAmt`=1.)

### 1. Compile-text rebuild (02 core_dump → 03 bootstrap)  — ✅ GEDAAN
- `<div id="compile">` in `index.html` (fixed, links-onder, Kode Mono, `var(--accent)`, `white-space:pre`, `opacity:0`, `body.lum-light` variant).
- `decohere.js` `main()`: `COMPILE[]` log-array + `compileEl`. `frame()`: `bp = smoothstep(Bs-0.55, Bs+0.4) * (1-smoothstep(Bs+0.5, Bs+0.9))`, regels progressief onthuld via `COMPILE.slice(0, floor(smoothstep(Bs-0.5,Bs+0.4)*len))`. Geverifieerd: log telt op tijdens bootstrap, fade in/out correct.
- (Niet gedaan / optioneel: straat-bouwstenen letterlijk laten opstijgen tot kubus.)

### 2. Neurotype: gele lobes "tether" terug naar de lattice — ✅ GEDAAN
- In `frame()` per-deeltje loop, na `z`-berekening: `if (nz>0.005 && isFwd[i] && hash[i]<0.6) { z = lerp(z, lerp(32, targets.spawn_smurf[k+2], 0.5+0.5*sin(t*1.6+i*0.7)), nz); }`. Subset van de gele lobe-deeltjes pulseert tussen forward (z=32) en hun platte hexLat-z, per-deeltje fase. Volledig gegate op `nz` → 0 effect buiten neurotype.

### 4. Leydi-hart (kernel_panic): kleur + "stekelige" fase — ✅ GEDAAN
- Eindkleur: `COL.leydiCold 0x3a7bff` → **`0xbfe9ff`** (ijzig cyaan-wit = de breuk, niet "warm blauw"). Geïsoleerd (alleen `cCold`/heart-decay-lerp gebruikt het).
- Spiky fase: in de leydi-loop vóór de `eP`-burst: `spike = smoothstep(0.55,0.95,decay)`, deeltjes radiaal naar buiten in scherpe `teeth = pow(|sin(sar*6+i*0.3)|, 6)` pieken (ijs/glas-shards). Zachte disintegrate-jitter wordt afgeschaald (`*(1-0.7*spike)`) zodat het kristallijn leest i.p.v. ruis. Snowflake-sprite swap (`leydiFrozen` op `decay>0.55`) was er al.

### 5. BUG/perf: kernel_panic → restart hapert — ✅ GEDIAGNOSEERD + GEFIXT
- **Root cause**: orbital-swirl `a = (t*0.32 + y*0.016) * restartFlow`. `t` = wandklok-seconden (groeit onbegrensd); de hele hoek × `restartFlow` betekent dat tijdens het inscrollen de orbital door `t*0.32` rad (tientallen rotaties) heen veegt → de "heel veel rotaties". Erger naarmate pagina langer open staat.
- **Fix**: rotatie op constante snelheid (`a = t*0.32 + y*0.016`, géén `restartFlow`), en alleen de *verplaatsing* infaden via `lerp(dx, rx, restartFlow)`. Bij `restartFlow=1` algebraïsch identiek aan voorheen → look ongewijzigd; bij de overgang easet de swirl in i.p.v. door te tollen.
- **Secundair**: panic-shatter throws geschaald met `(1-restartFlow)` zodat panic-math + restart-math niet beide vol draaien in de overlap. Sprite-swaps waren al boolean-guarded (geen per-frame thrash).

### 3. Groene lattice-backdrop achter de hydrogen (restart, 09) — ✅ GEDAAN
- Aparte `backdrop = ent(NB, texHex, 0x218b42)` overlay, `hexLatticeTarget(NB, 42, -74)` met `z -= 48` (achter de orbital; camera op z=+130 → negatiever z = verder). Eigen vertex-color node-sweep (groen→paars→groen, per rij eigen snelheid), `opacity = restTone*0.42`. Alleen zichtbaar tijdens `restTone`. Leest nu als faint nest-haze links achter "pure me" — evt. nog iets meer presence geven indien gewenst.

### 8. Gezinstekening (vandenbraken-4.png) als infall-reveal — ✅ GEDAAN (clarity = open vraag)
- `sampleImagePoints()` helper: PNG → offscreen canvas → `getImageData` → rejection-sample N punten waar `alpha>40 && brightness<165` (houdt de paarse lijnen, dropt witte bg). Aspect behouden, `scale=92`. PNG = 649×384 (5 figuren).
- Overlay-laag `family = ent(NFam, texDot, 0x7a52c0)` (GEEN nieuwe beat → geen reindex). Per-deeltje infall vanuit ring-origin (r=120–200) naar de silhouet-punten, staggered (`famOff`). Window: `famIn = smoothstep(Bo+0.12, Bo+0.5)`, fade vóór neurotype (`1-smoothstep(Ne-0.4, Ne-0.02)`), `opacity = famVis*0.5`.
- ⚠ **Open vraag (Vincent)**: de tekening vormt correct maar valt nu deels weg tegen de heldere groene hexagon + hart + heartbeats (additive, 0.5 opacity → paarse lijnen wassen uit). Mogelijke vervolg: tijdens de reveal de hoofd-cloud/kids dimmen, óf de family helderder/groter/meer naar voren, óf eigen rustiger moment. Vraagt jouw oog.

## Dit recent gedaan (context)
- **Boot**: hydrogen |ψ₄₃₀|² orbital, oranje→paars density-colormap (`bootCol`), per-deeltje staggered formatie (`formOff`), infall radiale colormap (`smoothstep(52,14,rd)` → ver=paars, kern=oranje/geel).
- **01 syntax**: huis vormt alleen → forbidden ⊘ eroverheen (held house, `sxHold`) → forbidden wordt **wolk boven straat** en **regent omlaag** (`cloud`/`fallPhase`, gestaggerd per drop).
- **04 daemon + hexagon-lattice**: tint→wit + per-deeltje **node-sweep groen→paars→groen**, nu **per rij eigen snelheid** (`sweepTone` branch in de cCol-sectie). Neuro heeft GEEN sweep (window faded voor Ne).
- **07 neurotype**: alleen gele lobes lichten op (fel geel, groen dim), lobes komen naar voren (z=32 target), bloom omlaag (`-0.22*nz`).
- **09 restart**: hydrogen "pure me" links (denser, N=13000), **twee gespiegelde helixes** (1 per heartbeat), geel+paars mix-strand, gap-model (net-niet-raken, kruisen alleen op 't eind voorbij de heartbeats), eerste loop breder, smal→breed.
- **Fonts**: sig = Asimovian, rest = Kode Mono (`index.html`). Tekstblokken breder (`.beat` 1500px, `.doc` 64ch).
- **Footer**: Vincability / OnlyVince.net / vincent.vandenbraken.com = hyperlinks (buildDOM in `decohere.js`).
- **Titels**: alle `::sig` herschreven (`content/decohere.md`), tags doorlopend `00`→`09`. ⚠ #08 kernel_panic sig = `kernel_panic::decohere.partner()` — overweeg `unbind_partner()`/`detach()` (breuk leest sterker).

### 6. Uptime = wall-time + simulation-time per chapter — ✅ GEDAAN
- **wall-time**: `#uptime` toont nog steeds de echte wandklok sinds 1980-02-18 (`uptime 46y 130d hh:mm:ss`). Ongewijzigd.
- **simulation-time**: NIEUW `#simtime` (2e HUD-regel onder uptime). `::date` per beat in `content/decohere.md` (al ingevuld), geparsed in `parseMD` (`cur.date`). In `main()`: `beatTimes[]` = 1 timestamp per beat via `parseDate()` (pakt 1e datum-token; ranges/jaar-only ok), gap-filled + geforceerd niet-dalend zodat de klok nooit terugloopt. In `frame()`: `lerp(beatTimes[i0], beatTimes[i1], f)` → `sim-time <mon> <jaar> · age <n>`.
- Geverifieerd in browser: sim feb 1980 (age 0) → jun 2026 (age 46), monotoon; geen boot-error.
- `parseDate` = eerste datum van een range (begin van het hoofdstuk). Wil je midpoint/eind i.p.v. begin, of dag-precisie i.p.v. `mon jaar`, pas `parseDate`/format-string aan.

### 7. Polish-fixes — ✅ GEDAAN (deze sessie)
- ✅ Forbidden-regen: per-deeltje `rate = 0.5 + hash2*1.7` + `driftX` → varierende valsnelheid, echte druppels i.p.v. vlak doek.
- ✅ Sweep groen→paars: `sweepAmt = smoothstep(daemon-0.1, daemon+0.4)` ramp-in (scene start groen, paars komt).
- ✅ Hexagon donkerder groen: sweep-base nu `(0.13, 0.54, 0.31)` = `0x218b42`.
- ✅ Tekst hardere shadow: extra tight dark halo + near-solid laag op `.beat .sig`/`.tag`/`.line` (+ lum-light).
- (Niet visueel geverifieerd deze sessie wegens context — checken bij volgende run.)

### 8. Idee: gezinstekening als "schaduw" (haalbaar bevestigd)
`content/vandenbraken-4.png` (649×384, paarse kinderlijke gezinstekening, 5 figuren) kan als particle-shape gerenderd worden — zelfde mechanisme als huis/hexagon/ECG.
- Build-time (1×): PNG op offscreen `<canvas>`, `getImageData()`, rejection-sample N punten waar `alpha>0 && brightness<drempel` (de lijnen).
- Pixel→wereld: `x=(px/649-.5)*scale`, `y=-(py/384-.5)*scale*(384/649)`, `z=rand(±klein)`. Aspect behouden.
- Als `targets[<beat>]` (cloud morpht ernaartoe) of aparte `ent()`-laag. Schaduw-gevoel = lage opacity, donker/grijs, `z` naar achteren, zachte jitter.
- Same-origin over http (geen `file://` → tainted canvas). Thematisch: het gezin (2 ouders + 3 kinderen) → sluit aan op spawn-beats + de hydrogen-helix-omhulling op het eind.
- **Gewenste plaatsing (Vincent)**: NÁ de 2e hartslag (`spawn_boefje`, beide kinderen er) → de `vandenbraken-4.png` tekening **projecteren via een infall-achtig mechanisme** (zoals de boot-infall: losse punten stromen van buiten in en vormen samen het silhouet van de tekening). Dus een nieuwe beat/sub-fase tussen `spawn_boefje` en `neurotype` (of als overlay-`ent()` met infall-seek naar de PNG-sample-punten). Hergebruik de infall-logica (`ifSpawn`/seek-naar-target) maar met de tekening-punten als targets.

## Architectuur-notes
- Per-beat kleur = `VINCENT_TINT`, bg = `BEAT_BG`. Per-deeltje kleur via vertex-colors `cCol` (cloud) — branches in de cСol-sectie: boot / restTone / sweepTone / nz(neuro) / reset. Tint gaat naar wit via `Math.max(bootTone, nz, restTone, sweepTone)` zodat de vertex-kleuren tonen.
- Beat-id's zijn engine-sleutels (`idx.*`, `targets.*`, `VINCENT_TINT`, `BEAT_BG`) — NIET hernoemen. Tags/sigs/docs zijn vrij.
- Niets is gecommit deze sessie.
