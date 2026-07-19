# Manufacturing Flow Designer

Manufacturing Flow Designer is a professional engineering application for modelling manufacturing processes, factory layouts, standard work, resource allocation, and future simulation and digital-twin workflows.

## Sprint 1.1 scope

This foundation sprint supplies the PWA repository bootstrap and a responsive, accessible engineering application shell. Commands are deliberately safe placeholders; process editing, persistence, layout design, routing, simulation, and analytics are not implemented yet.

## Technology

- Vite and strict TypeScript
- Native semantic HTML and CSS
- SVG-ready engineering workspace
- Standards-based web app manifest

## Prerequisites and setup

Install a current Node.js LTS release (Node.js 20 or newer is recommended), then run:

```shell
npm install
npm run dev
```

Open the local address shown by Vite.

## Development commands

```shell
npm run typecheck
npm run build
npm run preview
```

`npm run build` creates the production output in `dist/`.

## Folder structure

- `src/app` — application composition and shell orchestration
- `src/components` — title bar, ribbon, sidebars, workspace, and status bar
- `src/core` — shared constants and UI events
- `src/models` — domain-facing types
- `src/services` — future application services
- `src/styles` — reset, theme, layout, and component styling
- `src/ui` — small reusable DOM helpers
- `src/utilities` — framework-free utility functions
- `public` — manifest and icon assets

## Current limitations

This sprint contains no project persistence, resource placement, process connections, canvas pan/zoom, factory-layout tooling, standard-work charts, simulation, analytics, or offline service worker.

## Planned next sprint

Define the shared manufacturing domain vocabulary and introduce the first tested process-flow editing capability while keeping rendering, simulation, and persistence boundaries separate.

Development for this sprint is performed on `feature/sprint-1.1-bootstrap`. Do not push or merge without explicit approval.

