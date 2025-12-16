# ng-rpg-maker-mv-save-editor

> A high-performance, browser-based save editor for RPG Maker MV games, built with **Angular 20+**, **Signals**, and a modular **Multi-Game Architecture**.

![Angular](https://img.shields.io/badge/Angular-20.0+-dd0031.svg?style=flat&logo=angular)
![License](https://img.shields.io/badge/license-Unlicense-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

## 🚀 Overview

This project is a modern implementation of an RPG Save Editor and Patcher. It runs entirely in the browser, parsing `.rpgsave` files (LZ-String compressed JSON), allowing users to modify game state, and re-compressing them for use.

Originally built for specific RPG titles, it has been refactored into a **"Core + Plugin" architecture**. It features a robust Generic Editor for standard RPG Maker MV data (Gold, Items, Variables) and a Game Registry system to load custom UI panels for specific games (e.g., *Wormskull*).

## ✨ Features

### 🛠 Universal Editor (Works for any RPG Maker MV Game)
*   **Browser-Based:** No installation required. All parsing happens locally via JavaScript.
*   **Save & Patch:** Decompresses `.rpgsave`, allows edits, and recompresses to the exact format.
*   **Economy:** Edit Party Gold and Step count.
*   **Inventory:** Add, remove, or modify quantities for Items, Weapons, and Armors.
*   **Metadata Import:** Drag and drop your `www/data` folder to automatically map IDs to Item/Skill names.
*   **Variables:** View and edit global game variables.
*   **Raw JSON Editor:** A recursive tree viewer for power users to modify any specific data point manually.

### 🎮 Game-Specific Profiles
*   **Plugin Architecture:** Dynamically loads UI components based on the selected game profile.
*   **Wormskull Support:** Includes a custom "Mastery System" editor specifically for the game *Wormskull*, handling complex nested arrays for skill leveling.

## ⚡ Tech Stack

This project serves as a reference architecture for **Modern Angular (v20+)**:

*   **Signals:** Used exclusively for state management. No `BehaviorSubjects` or manual subscriptions.
    *   `signal()`, `computed()`, `input()`, `output()`
*   **Zoneless Change Detection:** Configured with `provideZonelessChangeDetection()` for maximum performance.
*   **Control Flow:** Utilizes the new `@if`, `@for`, and `@switch` syntax.
*   **Standalone Components:** No `NgModules`. Highly tree-shakable and modular.
*   **CSS variables & Scoped Styles:** Clean, native styling without heavy UI frameworks.

## 📂 Project Structure

```text
src/
├── app/
│   ├── components/
│   │   ├── generic/          # Reusable components (Inventory, Economy, RawEditor)
│   │   └── games/            # Game-specific logic
│   │       └── wormskull/    # Custom components for Wormskull
│   ├── config/
│   │   └── game-registry.ts  # Registry of supported games
│   ├── pages/
│   │   └── save-editor/      # Orchestrator component
│   └── services/
│       ├── save-file.service.ts  # Generic Source of Truth
│       └── lz-string.ts          # Custom lightweight compression
```

## 🛠 Development

### Prerequisites
*   Node.js v18+
*   npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/ng-rpg-maker-mv-save-editor.git

# Navigate to the directory
cd ng-rpg-maker-mv-save-editor

# Install dependencies
npm install
```

### Running Locally

```bash
# Start the dev server
npm start
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## 🔌 How to Add a New Game

The project is designed to be extensible. To add support for a new game with custom features:

1.  **Create your component:**
    Add a new folder in `src/app/components/games/my-new-game/`. Create a component that injects `SaveFileService` and uses `updateByPath()` to modify specific data.

2.  **Register the Game:**
    Open `src/app/config/game-registry.ts` and add a new entry:
    ```typescript
    export const GAMES: GameProfile[] = [
      { id: 'generic', label: 'Generic RPG Maker MV' },
      { id: 'wormskull', label: 'Wormskull' },
      { id: 'my-new-game', label: 'My Cool RPG' }, // Add this
    ];
    ```

3.  **Update the Orchestrator:**
    In `save-editor.component.html`, add a case to the switch block:
    ```html
    @switch (selectedGame()) {
      @case ('my-new-game') {
        <app-my-new-game-panel />
      }
    }
    ```

## 📄 License

This project is dedicated to the public domain under the [Unlicense](LICENSE).

---

**Disclaimer:** This software is an unofficial save editor. It is not affiliated with Enterbrain, Kadokawa, or the developers of any supported games. Always backup your save files before editing.
