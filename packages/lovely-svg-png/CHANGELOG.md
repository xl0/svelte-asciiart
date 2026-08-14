# Changelog

## [Unreleased]

### Added

- Initial release: browser-side SVG-string → PNG rasterization, extracted from `svelte-asciiart`.
- `svgStringToPng(svg, { scale, output, fontCss })`: data URL or Blob at the SVG's intrinsic size times `scale`, with optional CSS injected before rasterizing.
- `collectFontCss(families)`: `@font-face` rules for the given font families with the font files inlined as `data:` URIs — cross-origin stylesheets re-fetched as text, `@import` chains followed to depth 3, results cached per page.
