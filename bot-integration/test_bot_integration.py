"""
End-to-end integration test for T-730 Discord Bot Bridge with Left 730 Dead Engine
"""

import sys
import asyncio
import json
import urllib.request
import urllib.error

ENGINE_URL = "http://localhost:7300"

def post_json(endpoint: str, data: dict) -> dict:
    url = f"{ENGINE_URL}{endpoint}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        return json.loads(resp.read().decode("utf-8"))

def get_json(endpoint: str) -> dict:
    url = f"{ENGINE_URL}{endpoint}"
    with urllib.request.urlopen(url, timeout=5.0) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_tests():
    print("==================================================")
    print("🧪 RUNNING T-730 DISCORD BOT INTEGRATION TESTS")
    print("==================================================")

    # 1. Check Engine Status
    print("\n[Step 1] Checking Engine Health & Status...")
    status = get_json("/api/status")
    print(f"  -> Engine Status: {status['status']}, TPS: {status['tps']}, Survivors: {status['survivors']}")
    assert status["status"] == "ok"
    print("  ✅ Engine is online and responsive.")

    # 2. Simulate Discord User Voice Join
    print("\n[Step 2] Simulating Discord VoiceState Join for member 'Rudy_Discord' (ID: 9988776655)...")
    join_payload = {
        "action": "join",
        "discordId": "9988776655",
        "displayName": "Rudy_Discord",
        "avatarUrl": "https://cdn.discordapp.com/embed/avatars/0.png",
        "color": "#a855f7"
    }
    join_res = post_json("/api/bot/voice_update", join_payload)
    print(f"  -> Voice Join Result: {join_res}")
    assert join_res["success"] is True
    assert join_res["survivor"]["discordId"] == "9988776655"
    assert join_res["survivor"]["name"] == "Rudy_Discord"
    print("  ✅ Survivor successfully spawned from Discord voice event!")

    # 3. Simulate Discord Chat / Slash Commands
    print("\n[Step 3] Simulating Discord Chat Commands...")
    
    # 3a. Command !go Living Room
    cmd_1 = post_json("/api/bot/command", {
        "discordId": "9988776655",
        "command": "!go living room"
    })
    print(f"  -> Sent '!go living room': {cmd_1}")
    assert cmd_1["success"] is True

    # 3b. Command !fix North Window
    cmd_2 = post_json("/api/bot/command", {
        "discordId": "9988776655",
        "command": "!fix north window"
    })
    print(f"  -> Sent '!fix north window': {cmd_2}")
    assert cmd_2["success"] is True

    # 3c. Command !hold Armory
    cmd_3 = post_json("/api/bot/command", {
        "discordId": "9988776655",
        "command": "!hold armory"
    })
    print(f"  -> Sent '!hold armory': {cmd_3}")
    assert cmd_3["success"] is True
    print("  ✅ Discord commands successfully received and queued in engine!")

    # 4. Simulate Discord Voice Leave
    print("\n[Step 4] Simulating Discord VoiceState Leave for member (ID: 9988776655)...")
    leave_payload = {
        "action": "leave",
        "discordId": "9988776655"
    }
    leave_res = post_json("/api/bot/voice_update", leave_payload)
    print(f"  -> Voice Leave Result: {leave_res}")
    assert leave_res["success"] is True
    print("  ✅ Survivor successfully despawned upon voice channel disconnect!")

    print("\n==================================================")
    print("🎉 ALL PHASE 2 DISCORD BOT INTEGRATION TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
