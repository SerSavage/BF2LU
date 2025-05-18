import discord
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
USER_TOKEN = os.environ.get("USER_TOKEN")
RELAY_CHANNEL_ID = int(os.environ.get("RELAY_CHANNEL_ID", "0"))
if not USER_TOKEN:
    raise ValueError("USER_TOKEN is not set in environment variables")
if not RELAY_CHANNEL_ID:
    raise ValueError("RELAY_CHANNEL_ID is not set in environment variables")

intents = discord.Intents.default()
intents.message_content = True
intents.messages = True
intents.guilds = True

client = discord.Client(intents=intents)

MONITOR_CHANNELS = [
    922533223274250260,
    1022900235409821786,
    1316112442954350622,
    1316114620301312052
]

@client.event
async def on_ready():
    print(f"[SELF-BOT] Logged in as {client.user}")

@client.event
async def on_message(message):
    if message.channel.id in MONITOR_CHANNELS and message.author != client.user:
        relay_channel = client.get_channel(RELAY_CHANNEL_ID)
        if relay_channel:
            content = (
                f"Channel: {message.channel.name}\n"
                f"Content: {message.content}\n"
                f"Attachments: {message.attachments[0].url if message.attachments else ''}"
            )
            await relay_channel.send(content)
            print(f"🔄 Relayed message from {message.channel.name}")
        else:
            print(f"⚠️ Relay channel {RELAY_CHANNEL_ID} not found")

client.run(USER_TOKEN)
