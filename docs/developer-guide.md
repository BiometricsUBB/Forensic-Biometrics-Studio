# Developer Guide

## Tech Stack

-   **Desktop application:** Tauri 2
-   **Backend / system layer:** Rust, edition 2021
-   **Frontend:** React 18, TypeScript, Vite 5
-   **Package manager and runtime:** Bun
-   **UI and styling:** Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react
-   **Canvas / image processing:** PixiJS, @pixi/react, pixi-viewport, fft.js
-   **Application state:** Zustand, Immer
-   **Internationalization:** i18next, react-i18next
-   **Reports:** pdf-lib, html2canvas
-   **Biometric tools:** SourceAFIS CLI and the pyfing enhancement sidecar as Tauri sidecars
-   **Type checking:** tsgo (the `@typescript/native-preview` TypeScript compiler)
-   **Testing and code quality:** Bun test runner, Testing Library, Selenium WebDriver,
    oxlint, Prettier, Husky, lint-staged

## Environment Setup

Before running the project, install the Tauri 2 prerequisites: Node.js, Bun, Rust, and the required system dependencies for your operating system.

On macOS, the development commands are the same as below after installing the Tauri prerequisites. If you install a built app manually, it is not signed, so you may need to remove the quarantine flag after moving it to Applications:

```bash
xattr -d com.apple.quarantine "/Applications/Forensic Biometrics Studio.app"
```

Use the actual app path if it is different for you.

Clone the repository and run the development version:

```bash
git clone https://github.com/BiometricsUBB/Forensic-Biometrics-Studio.git
cd Forensic-Biometrics-Studio
bun install
bun run tauri dev
```

## Coding Style

-   Frontend code is written in TypeScript with `strict` mode enabled.
-   We follow the oxlint configuration from the repository (`.oxlintrc.json`),
    which covers the `typescript`, `jsx-a11y`, `react`, `react-hooks`, and
    `import` plugins.
-   Formatting is handled by Prettier: 4-space indentation, 80-character line
    width, semicolons, double quotes, and no tabs.
-   Do not use `any`; the `no-explicit-any` rule is treated as an error.
-   Do not leave unused variables or parameters; TypeScript and oxlint treat them
    as errors.
-   Imports from `src` should use the `@/` alias.
-   React components and UI files usually use `kebab-case.tsx`, domain classes
    use `PascalCase.ts`, and hooks use `useName.tsx`.
-   Before committing, it is recommended to run:

```bash
bun run tsc:check
bun run lint
bun run prettier:write
bun run test:unit
```
