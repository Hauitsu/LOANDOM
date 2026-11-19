# Bundled class emblems

30 local SVG emblems, one for every canonical GLOBAL/WESTERN Lost Ark class.
They are served from this repository at runtime; the app makes no external image
request for a class badge.

## Source and mapping

- Emblems: `https://cdn-lostark.game.onstove.com/2018/obt/assets/images/common/class/<file>.svg`
- Official selector mapping: `information.pc.css` (`?20261109140012`) from the Korean class page.
- Korean class registry: `pc.js` (`?20261109140012`).
- GLOBAL names and release evidence:
  - <https://www.playlostark.com/en-us/game/classes>
  - <https://www.playlostark.com/en-us/game/releases/guardians-rage>
  - <https://www.playlostark.com/en-us/game/releases/dimensions-unbound>

The GLOBAL classes page listed 29 subclass cards on 2026-11-17. Guardianknight
is confirmed by its official *Guardians' Rage* release page. Dimensionalist is
confirmed by the official *Dimensions Unbound* release page (launch
2026-09-16), making 30 canonical GLOBAL classes. Display names keep the official
Western spellings: Arcanist, Glaivier, Soulfist, Souleater, Machinist,
Guardianknight and Dimensionalist.

The publisher's GLOBAL CMS exposed mostly one repeated placeholder
(`Subclass_destroyer.png`) rather than a per-class emblem set, so it was not
used. The official Korean `common/class` SVGs are the only consistent official
per-class vector set; each was mapped through the official CSS selectors and
saved under its GLOBAL display filename.

| GLOBAL class | Family | Local file | Official source file |
| --- | --- | --- | --- |
| Berserker | Warrior | `berserker.svg` | `berserker.svg` |
| Destroyer | Warrior | `destroyer.svg` | `destroyer.svg` |
| Gunlancer | Warrior | `gunlancer.svg` | `warlord.svg` |
| Paladin | Warrior | `paladin.svg` | `holyknight.svg` |
| Slayer | Warrior | `slayer.svg` | `slayer.svg` |
| Valkyrie | Warrior | `valkyrie.svg` | `valkyrie.svg` |
| Striker | Martial Artist | `striker.svg` | `striker.svg` |
| Wardancer | Martial Artist | `wardancer.svg` | `battlemaster.svg` |
| Scrapper | Martial Artist | `scrapper.svg` | `infighter.svg` |
| Soulfist | Martial Artist | `soulfist.svg` | `soulmaster.svg` |
| Glaivier | Martial Artist | `glaivier.svg` | `lancemaster.svg` |
| Breaker | Martial Artist | `breaker.svg` | `breaker.svg` |
| Gunslinger | Gunner | `gunslinger.svg` | `gunslinger.svg` |
| Artillerist | Gunner | `artillerist.svg` | `blaster.svg` |
| Deadeye | Gunner | `deadeye.svg` | `devilhunter.svg` |
| Sharpshooter | Gunner | `sharpshooter.svg` | `hawkeye.svg` |
| Machinist | Gunner | `machinist.svg` | `scouter.svg` |
| Bard | Mage | `bard.svg` | `bard.svg` |
| Sorceress | Mage | `sorceress.svg` | `elementalmaster.svg` |
| Arcanist | Mage | `arcanist.svg` | `arcana.svg` |
| Summoner | Mage | `summoner.svg` | `summoner.svg` |
| Shadowhunter | Assassin | `shadowhunter.svg` | `demonic.svg` |
| Deathblade | Assassin | `deathblade.svg` | `blade.svg` |
| Reaper | Assassin | `reaper.svg` | `reaper.svg` |
| Souleater | Assassin | `souleater.svg` | `souleater.svg` |
| Artist | Specialist | `artist.svg` | `artist.svg` |
| Aeromancer | Specialist | `aeromancer.svg` | `aeromancer.svg` |
| Wildsoul | Specialist | `wildsoul.svg` | `wildsoul.svg` |
| Dimensionalist | Specialist | `dimensionalist.svg` | `dimension_master.svg` |
| Guardianknight | Guardianknight | `guardianknight.svg` | `dragon_knight.svg` |

Legacy names are lookup aliases only, not extra classes: Scouter maps to
Machinist, Warlord to Gunlancer, Holy Knight to Paladin, Battlemaster to
Wardancer, Infighter to Scrapper, Soul Master to Soulfist, Lance Master to
Glaivier, Devil Hunter to Deadeye, Blaster to Artillerist, Hawkeye to
Sharpshooter, Elemental Master to Sorceress, Arcana to Arcanist, Demonic to
Shadowhunter, Blade to Deathblade, Guardian Knight to Guardianknight and
Dimension Master to Dimensionalist. Official Korean class names are aliases too.

## Retrieval and verification

All 30 files were retrieved on 2026-11-17. Each response was HTTP 200 with an
SVG content type and an `<svg>` root. Every file is path-only (no scripts,
styles, images, event handlers, external URLs or links), has a square viewBox,
and is stored byte-for-byte. SHA-256, byte size, source URL and viewBox for each
file are in [`manifest.json`](./manifest.json).

## Licensing

The emblem artwork is owned by Smilegate RPG / Amazon Games. This repository
claims no license for it and does not include it in the MIT license that covers
the app code. Reuse permission is unknown; the files are bundled for this
unofficial fan tool. The CC BY-NC-SA 4.0 terms advertised on the official
Artwork and Fankit pages cover only images/videos registered on those pages, not
the `/Class` pages or these `common/class` SVGs.
