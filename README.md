# Open Fly

**Connectome-based animals play [Open Doctrines](https://github.com/Pr1nted/Open-Doctrines), live in a 3D stage.**

![A fly at a desk playing Open Doctrines, its brain lit up beside it](docs/itch/thumbnail.png)

Open Fly combines Open Animal Stage's 3D room, animal models, animations and
species catalogue with Open Doctrines' own game engine compiled to WebAssembly.
Locally built desktop apps can include the available fly, larva, worm, sea
squirt, zebrafish and mouse brain packages. The mouse is visual cortex, so its
game actions use a labelled synthetic visual-to-action mapping, not biological
motor output.

Each turn:

1. Each animal receives the shared country signals through the sensory mapping
   in its brain package. The mouse instead sees a greyscale rendering of the
   world and its predicted visual response drives the synthetic action mapping.
2. The brain runs for its package's simulation window.
3. Activity in the package's action groups chooses the orders.

It is not a living fly, and nothing about it learned to play. How game events
reach the brain and how its output reaches the game is our design. It was written
down in [PREREGISTRATION.md](PREREGISTRATION.md) before the fly played.

**Watch it:** https://open-fly.pages.dev · https://pr1nted.itch.io/open-fly · [devlog](https://open-fly.pages.dev/devlog/)

## In short

- **One line:** Animal connectomes play Open Doctrines in a 3D stage.
- **One paragraph:** Choose the available species, map and country; their
  connectome-based packages receive inputs and select game actions. The brain
  mappings and sensory conventions are documented in the catalogue and shown
  beside the animals.

## What the page does

- A 3D room with animal models, animations, brain activity and game monitors.
- Any map that ships with the game, or an `.odmap` you import. Games have no
  turn cap; an animal is eliminated as soon as it has no territory, and a game
  ends when a player owns the whole map or all seats are eliminated.
- It follows the game. Every Open Doctrines release rebuilds the page, has the fly
  play it, and posts a devlog (see [docs/releasing.md](docs/releasing.md)).

## Run it locally

```bash
tools/build_desktop_assets.sh ../OpenDoctrines v1.3.0b  # local species packages + game module
python3 -m http.server 8767 --directory web
```

The asset script needs Emscripten and Python packages `numpy`, `pandas` and
`openpyxl`. It downloads the published packages and exports the local-only
larva and worm data from a pinned source checkout into ignored `web/species/`.

To deploy: `tools/pack_web.py` splits the two large files into gzip parts under
Cloudflare Pages' 25 MiB limit. `tools/stage_web.py --out dist` copies what the
site serves. The page reassembles the parts and checks their SHA-256 before use.

`node tools/fly_run.mjs` plays one whole game headless, with the page's own brain
and game, and prints what the fly did.

The Python version, which plays the native server through a FIFO, is in
`open_fly/`. The Colab notebook `notebooks/open_fly_colab.ipynb` runs it with no
setup.

## Desktop builds

Open Fly can be packaged as a Linux `.deb` installer and AppImage, and as a
Windows NSIS `.exe` installer using Tauri 2. See [desktop/README.md](desktop/README.md)
for build requirements and commands. Run `tools/build_desktop_assets.sh` first;
it fetches or exports the brain packages into ignored local data folders and
builds the pinned game module. Linux `.deb`/AppImage and Windows NSIS `.exe`
bundles then include those files locally and need no runtime data downloads.
Generated brain data and executables are not included in source pushes.

## The fly did not research until 2026-09-21

Open Doctrines progresses research for every country except the player's,
because a player sets theirs on the research screen. The fly **is** the player
seat, and it has no screen, so its country never researched at all while every
country around it did — and research is about 40% of what an AI country spends.
Every game the fly played before this date was played without it.

`patches/opendoctrines-agent-research.patch` fixes it: the browser build asks
the game to progress its seat's research, and `od_agent_position` now reports
`researched`, `researchShare` and `researching` so it can be seen rather than
inferred. `tools/build_web_agent.sh` applies the patch to a throwaway copy of
the game and skips it once the game carries it. The benchmark is deliberately
left alone — `runBenchAgent` does not set the flag — so past benchmark numbers
stay comparable.

The fly still has to *choose* to fund research and to pick a focus, exactly as
the policy does. Nothing about that is done for it.

## Credits

- Stage and models: [Pr1nted/Open-Animal-Stage](https://github.com/Pr1nted/Open-Animal-Stage), Apache-2.0.
- Species citations and resource terms: `web/roster.json` and the source links in each entry.
- Game: Open Doctrines by Pr1nted.

## Licences

- **Code:** Apache 2.0. See [NOTICE](NOTICE).
- **Brain data:** datasets are build inputs, not committed files. Their source,
  attribution and redistribution status are recorded in `web/roster.json`.
  Local desktop builds may contain packages that are not cleared for public
  redistribution; those binaries stay on the owner's machine.
- **Open Doctrines**, which the page runs, is under its own non-commercial licence.
