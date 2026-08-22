"""
Zombie Horde Bridge for T-730 Discord Bot
Hooks into discord.py to relay VoiceState updates and chat/slash commands
over the LAN to the Left 730 Dead game engine running on the Mini PC.
"""

import os
import logging
import asyncio
from typing import Optional

try:
    import aiohttp
except ImportError:
    aiohttp = None

try:
    import discord
    from discord import app_commands
except ImportError:
    discord = None
    app_commands = None

logger = logging.getLogger("zombie_bridge")

# Default Engine URL pointing to the Mini PC on LAN
DEFAULT_ENGINE_URL = os.getenv("ZOMBIE_ENGINE_URL", "http://192.168.86.48:7300")
# Target voice channel ID (None to listen to all voice channels)
TARGET_VOICE_CHANNEL_ID = os.getenv("ZOMBIE_VOICE_CHANNEL_ID")

class ZombieBridge:
    def __init__(self, engine_url: str = DEFAULT_ENGINE_URL, target_voice_id: Optional[int] = None):
        self.engine_url = engine_url.rstrip("/")
        self.target_voice_id = int(target_voice_id) if target_voice_id else None
        self._session: Optional[aiohttp.ClientSession] = None

    async def get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5.0)
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def send_voice_update(self, action: str, discord_id: str, display_name: str, avatar_url: Optional[str] = None, color: Optional[str] = None) -> bool:
        """Forward a voice channel join/leave event to the game engine."""
        payload = {
            "action": action,
            "discordId": str(discord_id),
            "displayName": display_name,
            "avatarUrl": avatar_url,
            "color": color
        }
        url = f"{self.engine_url}/api/bot/voice_update"
        try:
            session = await self.get_session()
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info("Zombie Bridge Voice Update Success: %s -> %s", action, data)
                    return True
                else:
                    text = await resp.text()
                    logger.warning("Zombie Bridge Voice Update Failed (%s): %s", resp.status, text)
                    return False
        except Exception as e:
            logger.error("Zombie Bridge Connection Error to %s: %s", url, e)
            return False

    async def send_command(self, discord_id: str, command: str) -> dict:
        """Forward a chat or slash command (!go, !fix, !hold, !grab, !help) to the engine."""
        payload = {
            "discordId": str(discord_id),
            "command": command.strip()
        }
        url = f"{self.engine_url}/api/bot/command"
        try:
            session = await self.get_session()
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info("Zombie Bridge Command Success: %s", data)
                    return {"success": True, "data": data}
                else:
                    text = await resp.text()
                    logger.warning("Zombie Bridge Command Failed (%s): %s", resp.status, text)
                    return {"success": False, "error": text, "status": resp.status}
        except Exception as e:
            logger.error("Zombie Bridge Connection Error to %s: %s", url, e)
            return {"success": False, "error": str(e)}

    async def on_voice_state_update(self, member, before, after):
        """Discord.py event handler for voice state changes."""
        # Check if joined a voice channel
        joined_channel = after.channel
        left_channel = before.channel

        if joined_channel and joined_channel != left_channel:
            if self.target_voice_id is None or joined_channel.id == self.target_voice_id:
                avatar = str(member.display_avatar.url) if getattr(member, 'display_avatar', None) else None
                await self.send_voice_update(
                    action="join",
                    discord_id=str(member.id),
                    displayName=member.display_name,
                    avatarUrl=avatar
                )

        # Check if left a voice channel
        if left_channel and left_channel != joined_channel:
            if self.target_voice_id is None or left_channel.id == self.target_voice_id:
                await self.send_voice_update(
                    action="leave",
                    discord_id=str(member.id),
                    displayName=member.display_name
                )

    async def on_message(self, message):
        """Discord.py event handler for chat commands."""
        if message.author.bot:
            return

        content = message.content.strip()
        cmd_prefix = ('!go', '!fix', '!hold', '!grab', '!help')
        if any(content.lower().startswith(p) for p in cmd_prefix):
            result = await self.send_command(str(message.author.id), content)
            if result.get("success"):
                try:
                    await message.add_reaction("🧟")
                except Exception:
                    pass

def setup_zombie_bridge(bot, tree=None, engine_url=DEFAULT_ENGINE_URL, target_voice_id=TARGET_VOICE_CHANNEL_ID):
    """
    Helper function to register Zombie Bridge hooks on the Discord bot.
    Can be called directly in T-730's bot/main.py.
    """
    bridge = ZombieBridge(engine_url=engine_url, target_voice_id=target_voice_id)

    @bot.event
    async def on_voice_state_update(member, before, after):
        await bridge.on_voice_state_update(member, before, after)

    # If message commands enabled
    existing_on_message = getattr(bot, "on_message", None)

    @bot.event
    async def on_message(message):
        await bridge.on_message(message)
        if existing_on_message and callable(existing_on_message):
            await existing_on_message(message)

    # Register Slash Commands if tree provided
    if tree and app_commands:
        @tree.command(name="zombie_go", description="Move your survivor to a specific room in Left 730 Dead")
        @app_commands.describe(room="Living Room, Armory, Kitchen, Workshop, Hallway")
        async def cmd_go(interaction: discord.Interaction, room: str):
            res = await bridge.send_command(str(interaction.user.id), f"!go {room}")
            if res.get("success"):
                await interaction.response.send_message(f"🏃 Moving survivor to **{room}**!", ephemeral=True)
            else:
                await interaction.response.send_message("❌ Failed to send command. Ensure you are in the game voice channel!", ephemeral=True)

        @tree.command(name="zombie_fix", description="Path to a barricade and repair it")
        @app_commands.describe(target="North Window, South Window, East Window, West Window, Main Door")
        async def cmd_fix(interaction: discord.Interaction, target: str):
            res = await bridge.send_command(str(interaction.user.id), f"!fix {target}")
            if res.get("success"):
                await interaction.response.send_message(f"🔨 Moving to repair **{target}**!", ephemeral=True)
            else:
                await interaction.response.send_message("❌ Failed to send command.", ephemeral=True)

        @tree.command(name="zombie_hold", description="Defend a specific room in the house")
        @app_commands.describe(room="Living Room, Armory, Kitchen, Workshop, Hallway")
        async def cmd_hold(interaction: discord.Interaction, room: str):
            res = await bridge.send_command(str(interaction.user.id), f"!hold {room}")
            if res.get("success"):
                await interaction.response.send_message(f"🛡️ Holding defensive position in **{room}**!", ephemeral=True)
            else:
                await interaction.response.send_message("❌ Failed to send command.", ephemeral=True)

        @tree.command(name="zombie_grab", description="Pathfind to the nearest dropped loot pickup")
        async def cmd_grab(interaction: discord.Interaction):
            res = await bridge.send_command(str(interaction.user.id), "!grab")
            if res.get("success"):
                await interaction.response.send_message("📦 Pathing to nearest loot!", ephemeral=True)
            else:
                await interaction.response.send_message("❌ Failed to send command.", ephemeral=True)

    logger.info("Left 730 Dead Zombie Bridge successfully initialized on T-730 bot.")
    return bridge
