# Desktop builds

Run the build scripts from any directory:

```sh
tools/build-desktop-private.sh [linux|windows|all]
tools/build-desktop-public.sh [linux|windows|all]
```

Private builds embed every local brain package and work offline. Public desktop builds embed only brain datasets whose catalogued terms allow redistribution; before using them they show the source and terms for every roster entry and require the user to accept. The app works offline after acceptance. Set `OPEN_FLY_BRAIN_ROOT` when building to use a revisioned remote download host instead.

The public inventory includes only Drosophila adult male and Ciona larva, whose catalogued data terms permit redistribution with attribution. FlyWire is restricted to non-commercial use; Fish1's policy does not explicitly grant redistribution of its files; the larval fly and both C. elegans packages have no clear redistribution licence recorded. Those data packages are omitted from public builds. The public desktop app has an **Add local brain data** flow for complete packages a user has obtained and is allowed to use. It gives the source/terms links, explains the package layout, checks manifests and stores the selected files locally.

The public script stages a site in `dist/public-site/` with a revisioned CORS-enabled brain host for web deployments. The script does not publish or deploy the site.

Artifacts are copied to `dist/desktop/private/{linux,windows}` or `dist/desktop/public/{linux,windows}`. On Linux, `all` uses `cargo-xwin` and NSIS for the Windows installer; set `NSISDIR` if NSIS is installed outside the standard location.
