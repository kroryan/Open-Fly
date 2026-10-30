# Add brain packages to the public desktop app

The public desktop build bundles only data with catalogued terms that permit
redistribution. It can load other species from a package on your own computer.
Imported files stay in the app's local browser storage and are not uploaded.

## Prepare the package folder

Download the [Open Fly source repository](https://github.com/kroryan/close-fly)
and install Git and Python 3. From its root folder, run:

```sh
python3 -m venv .venv
.venv/bin/pip install numpy pandas openpyxl
.venv/bin/python tools/fetch_stage_assets.py
```

The script fetches the available packaged datasets, exports the larval fly and
the two *C. elegans* datasets from the pinned Open Animal Stage source, and
checks each package's manifest. It writes the results under
`web/species/<species-id>/`. Some source datasets have access conditions or
unclear redistribution terms. Read the source/terms link shown for each species
in the app and make sure you are allowed to obtain and use the files.

You can also prepare a package yourself from an upstream dataset or exporter.
Keep the species folder structure and all files together. The app accepts either
the whole `web/species` folder or one species folder such as
`web/species/c_elegans_herm`.

| Species folder | Metadata | Data package |
| --- | --- | --- |
| `drosophila_female` | `brain.json` | `connectome.pack.json` and every listed part, or `connectome.bin` |
| `drosophila_male` | `brain.json` | `connectome.pack.json` and every listed part, or `connectome.bin` |
| `drosophila_larva` | `brain.json` | `connectome.pack.json` and every listed part, or `connectome.bin` |
| `c_elegans_herm` | `brain.json` | `connectome.pack.json` and every listed part, or `connectome.bin` |
| `c_elegans_male` | `brain.json` | `connectome.pack.json` and every listed part, or `connectome.bin` |
| `ciona_larva` | `brain.json` | `connectome.pack.json` and every listed part, or `connectome.bin` |
| `zebrafish_larva` | `brain.json` | `connectome.pack.json` and every listed part, or `connectome.bin` |

## Load it in the app

1. Start the public app and accept the terms for the included datasets.
2. Choose **Add local brain data…** in the left setup panel.
3. Check that you have the right to use the files and follow the source terms.
4. Choose `web/species`, or a single complete species folder.
5. The app checks the metadata and package parts, stores valid packages on the
   device, and reloads the roster. The newly available animals appear in the
   player selector.

