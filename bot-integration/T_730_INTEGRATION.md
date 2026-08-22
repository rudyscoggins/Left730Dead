# T-730 Discord Bot Integration Guide

This guide explains how to hook the **T-730 Discord Bot** (running on your Raspberry Pi) into **Left 730 Dead** (running on this Mini PC at `http://192.168.86.48:7300`).

---

## 1. Copy `zombie_bridge.py` into T-730

Copy `bot-integration/zombie_bridge.py` from this repository into the `bot/` directory of your `T-730` repo:
```bash
# Example from Raspberry Pi or local clone:
cp /path/to/Left730Dead/bot-integration/zombie_bridge.py ~/docker/T-730/T-730-Prod/bot/
```

---

## 2. Environment Variables Configuration

In your `T-730` `.env` file (e.g. `~/docker/T-730/T-730-Prod/.env` or staging):
```env
# URL of Left 730 Dead game engine on the Intel Mini PC
ZOMBIE_ENGINE_URL=http://192.168.86.48:7300

# Optional: Restrict auto-joining to a specific Discord voice channel ID (leave unset for any voice channel)
# ZOMBIE_VOICE_CHANNEL_ID=123456789012345678
```

---

## 3. Hook into `bot/main.py`

In `T-730/bot/main.py`, simply import and call `setup_zombie_bridge`:

```python
from .zombie_bridge import setup_zombie_bridge

# After initializing bot and tree:
intents = discord.Intents.default()
intents.voice_states = True # Required for voice channel events
intents.message_content = True # Required if using !go, !fix chat prefix
bot = discord.Client(intents=intents)
tree = app_commands.CommandTree(bot)

# Setup Left 730 Dead bridge hooks:
zombie_bridge = setup_zombie_bridge(bot, tree=tree)
```

---

## 4. Supported In-Game Commands

When connected, members in the voice channel can control their survivor in real-time:

| Discord Command | Description |
| :--- | :--- |
| `!go [room]` or `/zombie_go room:[room]` | Paths directly to room center (`Living Room`, `Armory`, `Kitchen`, `Workshop`, `Hallway`) |
| `!fix [target]` or `/zombie_fix target:[target]` | Paths to window or door and begins repairs |
| `!hold [room]` or `/zombie_hold room:[room]` | Moves to room and auto-engages any entering zombies |
| `!grab` or `/zombie_grab` | Paths to nearest dropped health/weapon pickup |
| `!help [@user]` | Paths to assist a teammate |

---

## 5. Automated Testing

You can run the end-to-end integration test anytime with:
```bash
python3 bot-integration/test_bot_integration.py
```
