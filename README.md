# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering application for modelling manufacturing processes, factory layouts, standard work, resource allocation, and future simulation and digital-twin workflows.

## Sprint 1.2 scope

Sprint 1.2 adds the native SVG engineering-canvas foundation while preserving the Sprint 1.1 application shell. The canvas provides infinite world coordinates, adaptive CAD grid rendering, cursor-centred zoom, pan, accurate live coordinates, resize preservation, visibility controls, and Canvas Focus mode.

Manufacturing resources, operations, connections, routing, persistence, simulation, and analytics remain intentionally out of scope.

## Technology

- Vite and strict TypeScript
- Native semantic HTML and CSS
- Native SVG rendering and Pointer Events
- Standards-based web app manifest
- No UI framework or canvas library

## Prerequisites and setup

Install a current Node.js LTS release, then run:

```shell
npm install
npm run dev
```

Open the local address shown by Vite. In PowerShell environments that block `npm.ps1`, use `npm.cmd` in place of `npm`.

## Canvas controls

- **Select** — safe placeholder for future object selection
- **Pan** — toggles primary-button drag panning
- **+ / −** — zoom around the viewport centre
- **100%** — resets zoom while preserving the world point at the viewport centre
- **Fit** — centres the drawing origin at 100%
- **Grid** — shows or hides adaptive minor and major grid lines
- **Origin** — shows or hides the axes and origin marker
- **Canvas Focus** — hides both side panels without resetting the viewport

### Mouse and trackpad

- Wheel or trackpad scroll over the canvas: cursor-centred zoom
- Middle-button drag: pan
- Space plus primary-button drag: pan
- Primary-button drag while the Pan tool is active: pan

### Keyboard

- Hold `Space`: temporary pan mode
- `Escape`: cancel the active pointer interaction
- `+` / `-`: zoom in or out
- `0`: reset to 100%
- `F`: fit when the canvas has focus

Canvas shortcuts are ignored while typing in an input, textarea, select, or editable element.

### Touch and pen

- One-finger drag: pan
- Two-finger gesture: pan and pinch zoom
- Pen input uses the same pointer-safe interaction surface

## Canvas architecture

- `CanvasViewport` owns viewport state and coordinates rendering updates.
- `ViewportTransform` contains framework-free world/screen conversion and zoom invariance mathematics.
- `CanvasInteractionController` handles pointer, wheel, touch, keyboard, cancellation, and cleanup.
- `EngineeringGrid` owns efficient SVG patterns and named future rendering layers.
- `CanvasToolbar` exposes accessible navigation and visibility controls.
- `CanvasState` defines pan, zoom limits, visibility, and active navigation tool.

World coordinates are unbounded engineering units. Viewport/SVG coordinates are CSS pixels relative to the canvas top-left. Client coordinates come from browser pointer events and are converted to viewport coordinates before applying the inverse pan/zoom transform.

## Development commands

```shell
npm run typecheck
npm run test:coordinates
npm run build
npm run preview
```

`npm run build` creates production output in `dist/`.

## Folder structure

- `src/app` — application composition and shell orchestration
- `src/components/workspace/canvas` — canvas rendering, controls, interaction, and transform logic
- `src/components` — title bar, ribbon, sidebars, workspace, and status bar
- `src/core` — shared constants and typed UI events
- `src/models` — domain-facing and canvas state types
- `src/services` — future application services
- `src/styles` — reset, theme, layout, and component styling
- `src/ui` — small reusable DOM helpers
- `scripts` — lightweight engineering checks
- `public` — manifest and icon assets

## Current limitations

The canvas contains engineering reference content only. It has no object selection, resource placement, operations, process connections, selection rectangles, project persistence, undo/redo, factory-layout tooling, standard-work charts, simulation, analytics, or offline service worker.

## Planned Sprint 1.3

Define the first shared manufacturing-domain primitives and introduce a tested operation/resource rendering boundary without coupling the domain model to SVG interaction or future simulation logic.

Development for this sprint is performed on `feature/sprint-1.2-cad-canvas`. Do not push or merge without explicit approval.

