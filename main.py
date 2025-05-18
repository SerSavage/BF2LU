import discord
from discord.ext import commands, tasks
from datetime import datetime, timedelta
from flask import Flask, send_file
from threading import Thread
import os
import asyncio
import aiohttp

from dotenv import load_dotenv
print(f"DEBUG: Loading .env file from {os.getcwd()}")  # Debug current directory
load_dotenv()  # Load environment variables from .env file
print(f"DEBUG: .env loaded, DISCORD_BOT_TOKEN is {os.environ.get('DISCORD_BOT_TOKEN')}")  # Debug token value
try:
    with open('.env', 'r') as f:
        env_content = f.read()
        print(f"DEBUG: .env content: {env_content.strip()}")  # Debug raw .env content
except FileNotFoundError:
    print("DEBUG: .env file not found")
except Exception as e:
    print(f"DEBUG: Error reading .env file: {e}")

# Flask setup
app = Flask('')
@app.route('/')
def home():
    return "Bot is alive!"
@app.route('/favicon.ico')
def favicon():
    return send_file('static/favicon.ico', mimetype='image/x-icon') if os.path.exists('static/favicon.ico') else ('', 204)
def run_flask():
    app.run(host='0.0.0.0', port=5000, threaded=True, debug=False)
def keep_alive():
    t = Thread(target=run_flask, daemon=True)
    t.start()

# Bot setup
intents = discord.Intents.default()
intents.messages = True
intents.guilds = True
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

# Configuration
SOURCE_CHANNELS = {
    "KYBER Announcements": 922533223274250260,
    "KYBER Patreon": 1022900235409821786,
    "KYBER Playtest Announcements": 1316112442954350622,
    "KYBER Playtest Updates": 1316114620301312052,
}
DESTINATION_CHANNEL_ID = 1363367257010606231  # #kyber-announcements

# Track posts
last_posts = {}

@bot.event
async def on_ready():
    print(f"🛰️ {bot.user.name} online and scanning for transmissions at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} EDT")
    for name in SOURCE_CHANNELS:
        last_posts[name] = {"time": None, "content": None, "image": None, "message_id": None}
    print("Guilds:", [guild.name for guild in bot.guilds])
    keep_alive()
    check_announcements.start()

@bot.event
async def on_message(message):
    for name, channel_id in SOURCE_CHANNELS.items():
        if message.channel.id == channel_id and not message.author.bot:
            destination = bot.get_channel(DESTINATION_CHANNEL_ID)
            if destination:
                if last_posts[name]["message_id"]:
                    try:
                        old_message = await destination.fetch_message(last_posts[name]["message_id"])
                        await old_message.delete()
                        print(f"🗑️ Deleted repost for {name}")
                    except discord.NotFound:
                        print(f"⚠️ Repost for {name} not found")
                    except discord.Forbidden:
                        print(f"⚠️ Missing permissions to delete repost for {name}")
                    last_posts[name]["message_id"] = None
                image_url = message.attachments[0].url if message.attachments else None
                last_posts[name] = {
                    "time": datetime.utcnow(),
                    "content": message.content,
                    "image": image_url,
                    "message_id": None
                }
                print(f"✅ {name} updated at {last_posts[name]['time'].strftime('%Y-%m-%d %H:%M:%S')} UTC")
            else:
                print(f"⚠️ Destination channel {DESTINATION_CHANNEL_ID} not found")
    await bot.process_commands(message)

@bot.command()
async def check(ctx):
    """Manually trigger announcement check."""
    print(f"DEBUG: !check command received from {ctx.author} in channel {ctx.channel.id}")  # Debug log
    await check_announcements()
    await ctx.send("Checked announcements!")

@tasks.loop(hours=24)
async def check_announcements():
    now = datetime.utcnow()
    destination = bot.get_channel(DESTINATION_CHANNEL_ID)
    if not destination:
        print(f"⚠️ Destination channel {DESTINATION_CHANNEL_ID} not found at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} EDT")
        return
    for name, post in last_posts.items():
        last_time = post["time"]
        if last_time and post["content"] and now - last_time > timedelta(hours=24):
            embed = discord.Embed(
                title="KYBER: STAR WARS Battlefront II 🔸 No new post in 24h — relaying last transmission",
                color=0x1E90FF
            )
            embed.description = post["content"]
            if post["image"]:
                embed.set_image(url=post["image"])
            repost_message = await destination.send(embed=embed)
            last_posts[name]["message_id"] = repost_message.id
            print(f"📢 Repost sent for {name} with message ID {repost_message.id} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} EDT")

# DNS resolver
class CustomResolver(aiohttp.DefaultResolver):
    async def resolve(self, host, port=0, family=0):
        try:
            return await super().resolve(host, port, family)
        except aiohttp.client_exceptions.ClientConnectorDNSError:
            return await self._resolver.getaddrinfo(
                host, port, family=family, type=0, proto=0, flags=0
            )

# Bot startup
async def setup_bot():
    token = os.environ.get("DISCORD_BOT_TOKEN")
    print(f"DEBUG: DISCORD_BOT_TOKEN is {token}")  # Debug line
    if not token:
        raise ValueError("DISCORD_BOT_TOKEN environment variable not set")
    connector = aiohttp.TCPConnector(resolver=CustomResolver())
    bot.http._connector = connector
    try:
        await bot.start(token)
    finally:
        await bot.close()  # Ensure the bot session is closed on failure

if __name__ == "__main__":
    try:
        asyncio.run(setup_bot())
    except KeyboardInterrupt:
        print("Bot stopped by user")
    except Exception as e:
        print(f"Failed to run bot: {e}")