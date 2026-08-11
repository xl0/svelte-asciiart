# Changelog

## [Unreleased]

### Added

- MIT `LICENSE`, shipped in the npm package alongside the README.
- Package metadata: `description`, `license`, `author`.

## [0.0.5] - 2025-12-31

### Added

- Added SVG/PNG export utilities: `exportSvg`, `exportSvgToPng`, `svgStringToPng`.

### Changed

- Export `scale` defaults to 1.
- Better handling of SVG size: intrinsic `width`/`height` from `baseSize`, responsive via inline style.
