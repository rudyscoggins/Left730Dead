# Left 730 Dead 🧟

A real-time, streamable top-down zombie horde survival game engine designed for interactive stream overlays and Discord voice channel integration.

---

## 🎮 Accessing from Your Laptop / Streaming PC

1. **Start the Engine on this Mini PC:**
   ```bash
   npm start
   # or with Docker:
   docker compose up -d
   ```

2. **Open the Game on Your Laptop Browser:**
   - **Local Network URL:** `http://192.168.86.48:7300`
   - **Local Host (Mini PC):** `http://localhost:7300`

3. **OBS Studio Stream Integration:**
   - Add a new **Browser Source** in OBS.
   - URL: `http://192.168.86.48:7300`
   - Width: `1280` or `1920`, Height: `720` or `1080`.
   - Click the **"OBS Stream Mode"** toggle in the top-right corner to hide host debug panels and display the clean, full-screen stream view.

---

## 🧱 Phase 1 Deliverables Overview

* **Tick Engine:** 25 TPS authoritative game loop on port `7300`.
* **Map & Grid:** Fixed 20x20 grid with defensive house, 4 outer rooms (Living Room, Armory, Kitchen, Workshop), 4 perimeter windows, and 1 main door.
* **Autonomous AI & Pathfinding:**
  * Auto-attacks zombies within 3.5 tiles.
  * Cooperatively repairs damaged windows/doors.
  * Holds defensive room positions.
* **Barricade Fortification:** Dynamic health tracking (100 HP max), repair speed scaling, breach mechanics allowing zombie intrusions.
* **Progression & Rogue-lite Perks:** Shared House XP curve, Level ups, Autopilot 1.5s rolls, and Driven host selection modal.
* **Discord Chat Command Simulator:** Built-in UI to test `!go [room]`, `!fix [target]`, `!hold [room]`, `!grab`, and `!help` with 5-second automatic reversion.
* **REST & Webhook Ingress:** `/api/bot/voice_update` and `/api/bot/command` ready for Phase 2 Raspberry Pi bot forwarding.
