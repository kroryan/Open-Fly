# Vendored browser dependencies

These pinned copies let desktop builds run without fetching JavaScript or fonts
from a CDN. The web page uses the same files, so its appearance and runtime do
not depend on a network connection to Google Fonts, cdnjs, or jsDelivr.

- `three.min.js` and `GLTFLoader.js`: Three.js r128, MIT. License in
  `licenses/THREE-MIT.txt`.
- `fflate.js`: fflate 0.8.2, MIT. License in `licenses/FFLATE-MIT.txt`.
- `onnxruntime-web/`: ONNX Runtime Web 1.30.0 and pinned WASM payloads, MIT.
  License in `licenses/ONNXRUNTIME-MIT.txt`.
- `fonts/`: Big Shoulders Display, Figtree, and JetBrains Mono, SIL Open Font
  License 1.1. Licenses in `licenses/`.
- The Animal Stage runtime and 3D models are from
  Pr1nted/Open-Animal-Stage, Apache-2.0. Its license text is in
  `licenses/OPEN-ANIMAL-STAGE-APACHE-2.0.txt`.
