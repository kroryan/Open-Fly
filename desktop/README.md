# Desktop builds

Open Fly desktop apps use Tauri 2 and the same local catalogue as the web page.
Build assets before making either installer:

```sh
tools/build_desktop_assets.sh ../OpenDoctrines v1.3.0b
```

This fetches released packages, exports local-only larva and worm connectomes
from the pinned Open Animal Stage source, verifies their manifests, and builds
the Open Doctrines WebAssembly agent. Generated datasets stay in ignored
`web/species/` and are included in local desktop bundles. Python needs `numpy`,
`pandas` and `openpyxl`; set `PYTHON` to the interpreter that has them.

## Build prerequisites

- Node.js 22 and npm.
- Rust stable and Tauri system dependencies for the build host.
- Linux: `libwebkit2gtk-4.1-dev`, GTK and standard Tauri build packages.
- Cross-building Windows from Linux: `cargo-xwin`, the MSVC Rust target,
  LLVM/LLD and NSIS. Native Windows builds use Visual Studio Build Tools.
- Emscripten for the Open Doctrines WebAssembly agent.

The Tauri icon set is the project's fly favicon. Android icon variants are kept
for the later Android build.

## Commands

```sh
cd desktop
npm ci
npm run build:linux
npm run build:windows
```

Linux produces a `.deb` and AppImage. Windows produces an NSIS installer and a
portable `open-fly.exe`. Before bundling, `tools/stage_desktop.mjs` checks every
roster resource and verifies packed data parts by size and SHA-256. The Windows
installer uses Microsoft's WebView2 bootstrapper if that runtime is missing.

The Linux artifact is x86_64. Windows cross-builds are unsigned; sign them on a
Windows release runner before public distribution.
