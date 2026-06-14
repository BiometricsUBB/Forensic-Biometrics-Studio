# Developer Guide

## Tech Stack

- **Desktop application:** Tauri 2
- **Backend / system layer:** Rust, edition 2021
- **Frontend:** React 18, TypeScript, Vite 5
- **Package manager:** pnpm 8.15.5
- **UI and styling:** Tailwind CSS, shadcn/ui, Radix UI, lucide-react
- **Canvas / image processing:** PixiJS, @pixi/react, pixi-viewport, fft.js
- **Application state:** Zustand, Immer
- **Internationalization:** i18next, react-i18next
- **Reports:** pdf-lib, html2canvas
- **Biometric tools:** SourceAFIS CLI as a Tauri sidecar
- **Testing and code quality:** Jest, Testing Library, Selenium WebDriver,
  ESLint, Prettier, Husky, lint-staged

## Environment Setup

Before running the project, install the Tauri 2 prerequisites: Node.js, pnpm,
Rust, and the required system dependencies for your operating system. On
Windows, you can use the setup script included in the repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

On macOS, the development commands are the same as below after installing the
Tauri prerequisites. If you install a built app manually, it is not signed, so
you may need to remove the quarantine flag after moving it to Applications:

```bash
xattr -d com.apple.quarantine /Applications/biometrics-studio.app
```

Use the actual app path if it is different.

Clone the repository and run the development version:

```bash
git clone https://github.com/BiometricsUBB/Forensic-Biometrics-Studio.git
cd Forensic-Biometrics-Studio
corepack enable
pnpm install
pnpm tauri dev
```

For frontend-only work, run Vite:

```bash
pnpm dev
```

The default Vite server port is `1420`.

## Coding Style

- Frontend code is written in TypeScript with `strict` mode enabled.
- We follow the ESLint configuration from the repository, including `airbnb`,
  `@typescript-eslint`, `jsx-a11y`, `sonarjs`, `security`, `react-hooks`, and
  `prettier`.
- Formatting is handled by Prettier: 4-space indentation, 80-character line
  width, semicolons, double quotes, and no tabs.
- Do not use `any`; `@typescript-eslint/no-explicit-any` is treated as an error.
- Do not leave unused variables or parameters; TypeScript and ESLint treat them
  as errors.
- Imports from `src` should use the `@/` alias.
- React components and UI files usually use `kebab-case.tsx`, domain classes
  use `PascalCase.ts`, and hooks use `useName.tsx`.
- Before committing, it is recommended to run:

```bash
pnpm tsc:check
pnpm eslint:check
pnpm prettier:write
pnpm test:unit
```