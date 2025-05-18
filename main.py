import discord
from discord.ext import commands, tasks
from datetime import datetime, timedelta
from flask import Flask
from threading import Thread
import os
import asyncio
import aiohttp
import json
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
if not DISCORD_BOT_TOKEN:
    raise ValueError("DISCORD_BOT_TOKEN is not set in environment variables")

# Flask setup for uptime monitoring
app = Flask('')
@app.route('/')
def home():
    return "Bot is alive!"
def run_flask():
    port = int(os.environ.get("PORT", 5000))  # Use Render-assigned port
    app.run(host='0.0.0.0', port=port, threaded=True, debug=False)
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
MOD_CHANNEL_ID = '1362988156546449598'
TARGET_CHANNELS = [
    '1361838672818995312',
    '1366888045164499097',
    '1362441078908784793',
    '1366886810885689456',
    '1366887040498663634',
    '1364277004198875278'
]
TRIGGERS = [
    'bad joke', 'cringe', 'bro why', 'this is cursed', 'forbidden word',
    'not funny', 'who asked', 'kill me now', 'this ain\'t it', 'try harder',
    'that didn\'t land', 'dark humor', 'edgy much', 'cancelled', 'too soon',
    'yeesh', 'ouch', 'bruh moment', 'your humor is broken', 'dude wtf',
    'wtf did i just read', 'how is this a joke', 'zero chill', 'this belongs in the trash',
    'yikes', 'gross', 'tone deaf', 'read the room', 'problematic',
    'racist joke', 'sexist joke', 'offensive joke', 'abusive joke', 'inappropriate joke',
    'harmful joke', 'ableist joke', 'homophobic joke', 'misogynistic joke', 'distasteful joke'
]
EXTREME_TRIGGERS = [
    'nigger', 'chink', 'gook', 'spic', 'kike', 'sand nigger', 'porch monkey',
    'slant eye', 'wetback', 'beaner', 'camel jockey', 'raghead', 'towelhead',
    'monkey', 'jungle bunny', 'zipperhead', 'yellow peril', 'coon', 'pickaninny',
    'gas the jews', 'heil hitler', 'sieg heil', 'zionist pig', 'oven dodger',
    'hook nose', 'dirty jew', 'ashkenazi scum', 'faggot', 'dyke', 'tranny',
    'no homo', 'fudge packer', 'shemale', 'drag freak', 'queer', 'retard',
    'spastic', 'mongoloid', 'window licker', 'cripple', 'vegetable',
    'bitch', 'cunt', 'slut', 'whore', 'hoe', 'dumb broad', 'make me a sandwich',
    'women can’t drive', 'she asked for it', 'rape her', 'kill her', 'rape',
    'rape you', 'raping', 'kill yourself', 'kms', 'kys', 'go hang yourself',
    'slit your wrists', 'choke and die', 'beat her', 'abuse her', 'molest',
    'pedophile', 'pedo', 'groomer', 'build the wall', 'go back to your country',
    'illegal alien', 'white power', 'white pride', 'blood and soil',
    'ethnic cleansing', 'great replacement', 'kkk', 'white lives matter',
    '14 words', '1488', 'six million wasn’t enough', 'going ER', 'ellen page is a man',
    'beta uprising', 'soy boy', 'femoid', 'roastie', 'chad', 'stacy', 'rape fuel',
    'gymcel', 'kill all women', 'mass shooter vibes', 'school shooter',
    'fuck you', 'die', 'i hope you die', 'you should die', 'kill all', 'useless piece of shit',
    'waste of air', 'why are you alive', 'die in a fire'
]

# Track posts
last_posts = {}
users = {}  # In-memory user language preferences (load from users.json if exists)
if os.path.exists('users.json'):
    with open('users.json', 'r') as f:
        users = json.load(f)

@bot.event
async def on_ready():
    print(f"🛰️ {bot.user.name} online at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    for name in SOURCE_CHANNELS:
        last_posts[name] = {"time": None, "content": None, "image": None, "message_id": None}
    keep_alive()
    check_announcements.start()

@bot.event
async def on_message(message):
    if message.author.bot:
        return

    content = message.content.lower()

    # Moderation: Extreme content
    if any(trigger in content for trigger in EXTREME_TRIGGERS):
        try:
            channel = message.channel
            await message.delete()
            mod_channel = bot.get_channel(MOD_CHANNEL_ID)
            if mod_channel:
                await mod_channel.send(
                    f"🚨 **EXTREME CONTENT DETECTED**\n"
                    f"**User:** <@{message.author.id}>\n"
                    f"**Message Deleted**\n"
                    f"**Channel:** <#{channel.id}>"
                )
            gif_path = './media/ashamed.gif'
            if os.path.exists(gif_path):
                await channel.send(
                    content="⚠️ Inappropriate content detected. A moderator has been notified.",
                    file=discord.File(gif_path)
                )
        except Exception as e:
            print(f"Failed to handle extreme content: {e}")
        return

    # Moderation: Trigger words in target channels
    if str(message.channel.id) in TARGET_CHANNELS and any(trigger in content for trigger in TRIGGERS):
        file_path = './audio/cringe.mp3'
        if os.path.exists(file_path):
            await message.channel.send(
                content="🔊 Cringe detected!",
                file=discord.File(file_path)
            )
            mod_channel = bot.get_channel(MOD_CHANNEL_ID)
            if mod_channel:
                await mod_channel.send(
                    f"⚠️ **Trigger detected in <#{message.channel.id}>**\n"
                    f"**User:** <@{message.author.id}>\n"
                    f"**Message:** \"{message.content}\""
                )
        else:
            print(f"Audio file missing at: {file_path}")

    # Announcement relaying
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
                embed = discord.Embed(
                    title=f"KYBER: {name}",
                    description=message.content,
                    color=0x1E90FF
                )
                if image_url:
                    embed.set_image(url=image_url)
                repost_message = await destination.send(embed=embed)
                last_posts[name]["message_id"] = repost_message.id
                print(f"📢 Posted {name} to destination at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC")
            else:
                print(f"⚠️ Destination channel {DESTINATION_CHANNEL_ID} not found")

    # Set language command
    if message.content.startswith('!setlang '):
        parts = message.content.strip().split(' ')
        lang = parts[1].lower() if len(parts) > 1 else None
        allowed_langs = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ar', 'hi', 'ru', 'ja']
        if lang not in allowed_langs:
            await message.reply(f"❗ Invalid language code. Allowed: {', '.join(allowed_langs)}")
            return
        users[message.author.id] = lang
        with open('users.json', 'w') as f:
            json.dump(users, f, indent=2)
        await message.reply(f"✅ Your preferred translation language is now set to **{lang}**.")
        return

    # Auto-translate messages
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post('https://libretranslate.de/detect', json={"q": message.content}) as resp:
                detect_res = await resp.json()
                detected_lang = detect_res[0]["language"] if detect_res else 'unknown'
                user_lang = users.get(str(message.author.id), 'en')
                if detected_lang != user_lang:
                    async with session.post('https://libretranslate.de/translate', json={
                        "q": message.content,
                        "source": detected_lang,
                        "target": user_lang,
                        "format": "text"
                    }) as trans_resp:
                        trans_res = await trans_resp.json()
                        translated = trans_res.get("translatedText")
                        if translated and translated.lower().strip() != message.content.lower().strip():
                            await message.reply(
                                f"🌍 **Translated from `{detected_lang}` to `{user_lang}`:**\n> {translated}"
                            )
    except Exception as e:
        print(f"Translation error: {e}")

    await bot.process_commands(message)

@tasks.loop(hours=24)
async def check_announcements():
    now = datetime.utcnow()
    destination = bot.get_channel(DESTINATION_CHANNEL_ID)
    if not destination:
        print(f"⚠️ Destination channel {DESTINATION_CHANNEL_ID} not found")
        return
    for name, post in last_posts.items():
        last_time = post["time"]
        if last_time and post["content"] and now - last_time > timedelta(hours=24):
            embed = discord.Embed(
                title=f"KYBER: {name} 🔸 No new post in 24h",
                color=0x1E90FF,
                description=post["content"]
            )
            if post["image"]:
                embed.set_image(url=post["image"])
            repost_message = await destination.send(embed=embed)
            last_posts[name]["message_id"] = repost_message.id
            print(f"📢 Repost sent for {name} with message ID {repost_message.id}")

async def setup_bot():
    try:
        await bot.start(DISCORD_BOT_TOKEN)
    finally:
        await bot.close()

if __name__ == "__main__":
    try:
        asyncio.run(setup_bot())
    except KeyboardInterrupt:
        print("Bot stopped by user")
    except Exception as e:
        print(f"Failed to run bot: {e}")
