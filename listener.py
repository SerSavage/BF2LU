# listener.py
from discord.ext import commands
import discord
import requests
import os

# Load .env if running locally (safe for development)
from dotenv import load_dotenv
load_dotenv()

TOKEN = os.environ.get("USER_TOKEN")

if not TOKEN:
    raise ValueError("USER_TOKEN is not set in environment variables")

intents = discord.Intents.default()
intents.message_content = True
intents.messages = True
intents.guilds = True

bot = commands.Bot(command_prefix="?", self_bot=True, intents=intents)

MONITOR_CHANNELS = [
    922533223274250260,
    1022900235409821786,
    1316112442954350622,
    1316114620301312052
]

WEBHOOK_ENDPOINT = "http://localhost:5001/relay"  # change if needed

@bot.event
async def on_ready():
    print(f"[SELF-BOT] Logged in as {bot.user}")

@bot.event
async def on_message(message):
    if message.channel.id in MONITOR_CHANNELS and message.author != bot.user:
        payload = {
            "channel_name": message.channel.name,
            "content": message.content,
            "attachments": [a.url for a in message.attachments]
        }
        try:
            requests.post(WEBHOOK_ENDPOINT, json=payload)
            print(f"🔄 Relayed message from {message.channel.name}")
        except Exception as e:
            print(f"Failed to send data to bot relay: {e}")

bot.run(TOKEN, bot=False)
