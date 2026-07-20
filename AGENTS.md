# Manufacturing Flow Designer project rules

1. The application name is Manufacturing Flow Designer.
2. Never add references to NCMT unless explicitly instructed.
3. The PWA technology is Vite, TypeScript, native HTML, native CSS, and SVG.
4. Do not introduce a UI framework without explicit approval.
5. Use strict TypeScript.
6. Keep source files focused and maintainable.
7. Avoid monolithic classes and files.
8. Do not silently change the `.mflow` format once introduced.
9. The PWA and WPF versions must eventually share compatible behaviour and project data.
10. Do not claim a feature is complete unless it is implemented and tested.
11. Run the relevant checks before reporting completion.
12. Do not push or merge without explicit permission.
13. Preserve existing documentation.
14. Use the professional dark engineering visual style.
15. New functionality must not break existing working features.
16. Use accessible labels and keyboard-aware controls.
17. Record important architecture decisions in future ADR documents.
18. Keep future simulation logic separate from presentation code.
19. Keep future rendering logic separate from the manufacturing domain model.
20. Avoid unnecessary external packages.
21. Resource Templates are reusable definitions; Resource Instances are physical Factory Layout assets.
22. Operations exist in Process Flow and may reference only physical Factory Layout resource IDs.
23. Multiple sequential operations may share one physical resource; concurrency validation is deferred until timing or simulation exists.
24. Increase ordinary machinery capacity by adding physical Resource Instances rather than treating a numeric capacity as multiple machines.
25. Keep Process Flow and Factory Layout rendering, placement, selection, and viewport state separated.

