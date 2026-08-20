# GitHub Pages web releases

Set the same GitHub Pages base URL in `www/update-config.js` and publish this directory with GitHub Pages.

Each release lives in `releases/<semver>/` and must contain the complete production web output plus a `manifest.json`. The manifest lists every local HTML, CSS, JavaScript, image, font, and other asset with its SHA-256 hash and byte size. `version.json` points to the newest release.

Example `manifest.json`:

```json
{
  "version": "1.1.0",
  "files": [
    { "path": "index.html", "size": 1234, "sha256": "64-character-lowercase-sha256" }
  ]
}
```

Do not include `..`, absolute paths, or external URLs in file paths. Generate the manifest from the exact files being published; do not hand-edit hashes.
