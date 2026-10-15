# Darkworld handoff: from the "Dark world" session

This picks up the "Dark world" session (Oct 12–15, 2026) in the main Darkworld thread. Everything below goes into **Darkworld** (`donnyloggins-bit/darkworld`). No new maps for now.

## Paste this into the Darkworld thread

> I worked on Darkworld in another session. Read `HANDOFF.md` on the branch `claude/live-show-and-rifts`. It's built on top of your PR #4 branch (`claude/new-session-mml60g`). Merge that work in, then build what's still open. Top priority: make mobs spawn much more densely, about every 50 feet, especially in Kensington and Fishtown. No new maps.

## Where everything is

| What | Where |
| --- | --- |
| The game | `donnyloggins-bit/darkworld`, single file `index.html` |
| Open pull request (online play, crews, warbands, turf wars, Season 0, native apps) | PR #4, branch `claude/new-session-mml60g` |
| This session's Darkworld work | Branch `claude/live-show-and-rifts`, one commit on top of PR #4 |
| Darkworld Roadmap (from the main thread) | https://claude.ai/code/artifact/752da68a-8770-43d9-bca2-63bc4c15b59d |
| Darkworld Art Brief (from the main thread) | https://claude.ai/code/artifact/36b186d5-1596-4303-b4aa-07a54704a470 |
| Dark World concept doc (this session: research, in-person play, season finale, safety, Philly rift spots, art direction) | https://claude.ai/code/artifact/12b2872b-82be-44f3-9bae-5dfe64e57436 |
| Motion test (how the art should move) | https://claude.ai/artifact/NeakTE6CgFsEdggtrzCWvn |
| Practice prototype (reference only, not part of Darkworld) | Six-Demon-Bag repo, `game/` on branch `ccr-bf2bc88a-vcsi0h` |

## Already built on `claude/live-show-and-rifts` (tested in a browser)

1. **Six Demon Bag play the Halloween finale.**
   - The season panel has a soundtrack box that plays *Dirty Old Town* (`six-demon-bag-dirty-old-town.m4a`).
   - Setting `SEASONS[0].liveShow.confirmed = true` turns on the full live show:
     - the finale cutscene sends hunters to the band's stage on Fairmount Avenue
     - each Warden phase is announced as a new set
     - the win ends with "The last chord rings out over Cherry Hill."
   - It's **off until the show is booked**, so the game never promises a show that isn't happening.
2. **Bosses tear the street open.** The boss reveal starts with a burning tear, rising embers and cold blue mist. The color rule for the whole game: **fire = hunters, cold blue = the dark.** It's skipped for players who turn on reduced motion.
3. The service worker leaves music files to the network, because phones stream audio in pieces and the cache can't store those.

## What Edward wants (from this session)

- **Big, big battles at the end of every season that everyone joins together.** Already in PR #4 as the city-wide finale siege.
- **Pickup parties with strangers to fight a mini boss.** If you're close by, you join the battle in person, like Pokémon GO raids. **Not built yet.** PR #4 shows how many hunters are nearby and has city-wide raids, but there's no quick drop-in group fight at smaller bosses for people standing at the same spot.
- **The finale with a live Six Demon Bag show.** Built (above). Turn it on once it's booked.
- **Kensington and Fishtown at the heart of the game.** Edward was born in Kensington and has lived in Philadelphia his whole life. He wants to rewrite much of the lore himself and keep adding to it. Ask him for his words; don't write his lore for him.
- **Art that flows and feels animated, in the tone of the existing paintings.** More fluid motion across the game, like the motion test.
- **Spawn density, the newest request:** random mobs **about every 50 feet**, especially in **Kensington and Fishtown**.
- **App Store and Google Play.** Already on the roadmap.

## Notes on the 50-foot spawn request

- **Today:** the living city uses cells of about 170 m (`CELL_LAT = 0.0015`, `CELL_LNG = 0.002`), with about 0.45 mobs per cell. That's roughly one mob every 250 m (about 800 ft), or more during the night surge and Blood Moons.
- **50 feet is about 15 m.** Spawning that densely across the whole 7×7 cell area would mean thousands of mobs on the map. Make it dense near the player instead:
  - fill a tight area around the hunter (roughly the closest 300–500 ft)
  - keep the farther cells sparse
  - stay deterministic per cell, so every hunter on the same block still sees the same monsters
- **Kensington and Fishtown** should get the highest density. Those neighborhoods are already in the game's district list ("The Rusting Mile", "The Kiln Streets", "The Ash Wharves").
- Spawns stay on public streets and sidewalks. Respect the existing safety rules: no homes, no private property, no closed sites.

## Still open, in order

1. Edward merges PR #4 and runs the Supabase setup, then plays an evening on a real phone. Per the roadmap, this is due by Oct 19.
2. Merge `claude/live-show-and-rifts` on top of it.
3. Dense spawns, Kensington and Fishtown first.
4. Pickup parties with strangers at mini bosses (needs the server).
5. More fluid motion across the game in the same art tone.
6. Kensington lore: in Edward's words, when he's ready.
