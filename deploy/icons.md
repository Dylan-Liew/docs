# Public icon files

The application stays behind Cloudflare Access. These exact static paths are public so browser icon discovery can work without a login session:

- `/favicon.ico`
- `/favicon.png`
- `/apple-touch-icon.png`
- `/apple-touch-icon-precomposed.png`
- `/assets/icon-180x180.png`
- `/assets/icon-dark.svg`
- `/assets/icon-light.svg`
- `/docs.ico`
- `/docs.png`
- `/docs-touch.png`
- `/docs-light.svg`
- `/docs-dark.svg`
- `/icon.ico`
- `/icon.png`
- `/icon-dark.png`
- `/icon-dark.ico`
- `/touch.png`
- `/icon-light.svg`
- `/icon-dark.svg`

The Docs Access application's public destination has one `behavior: public` override per path, without wildcards. All existing login policies are retained. The tunnel's first Docs ingress rule matches only these files and disables origin Access validation for that rule. The subsequent Docs rule still requires a valid Access token.

Root fallbacks are copied explicitly into the production image by the Dockerfile. All artwork has a transparent background. The page selects dark ink in light mode and white ink in dark mode for SVG, PNG and multi-size ICO, following the resolved app theme on first load and menu changes, even when it differs from OS appearance. Touch icons retain the approved 20% scale reduction.

The page and source files use `icon.ico`, `icon.png`, `touch.png`, `icon-light.svg`
and `icon-dark.svg`, with `icon-dark.png` and `icon-dark.ico` fallbacks. Docker copies the same artwork to the old `/docs*`, discovery
and asset paths for cached pages. Built JS/CSS retain their generated hashed names.
`deploy/docker/performance.conf` gives only these exact icons a five-minute cache
lifetime, retaining immutable caching for built JS/CSS. A scoped Cloudflare Cache
Rule respects origin browser TTL for the same paths (the zone default is four
hours). After deployment, purge only these URLs and the previous `docs14` icon query URLs. Purging Cloudflare cannot clear a browser's saved site
icon. Check the live path with `node tests/e2e/icons.mjs https://docs.x44ylan.com`;
the repeatable report is `artifacts/e2e/icons.json`.

After changes, verify each icon URL returns an image with HTTP 200 without cookies. Check `/`, `/vaults`, `/api`, `/assets/`, and `/favicon.ico/extra` still require login. Never exempt the whole `/assets/` directory.

The active tunnel is remotely managed by Cloudflare (`57767109-c4a6-4e05-8e01-537fc177cda7`). Its ingress must be updated through the tunnel configurations API; editing only the local `/home/dylan/.cloudflared/opencook.yml` mirror is insufficient. Remote updates are applied live. Its `cloudflared-opencook.service` also carries OpenCook, so preserve all other ingress rules and verify both hostnames afterward. Cloudflare application overrides and the remote tunnel configuration are managed separately from the source checkout.
