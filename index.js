const { Client, GatewayIntentBits, AttachmentBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
require('dotenv').config();

const dataDir = '/app/data';
try {
  if (!require('fs').existsSync(dataDir)) {
    require('fs').mkdirSync(dataDir, { recursive: true });
    console.log(`Created directory ${dataDir}`);
  }
} catch (err) {
  console.error(`❌ Failed to create/check directory ${dataDir}:`, err.message);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ]
});

const commands = require('./commands.json');

let users = {};
const usersFile = path.join(dataDir, 'users.json');
async function loadUsers() {
  try {
    const usersData = await fs.readFile(usersFile, 'utf8');
    users = JSON.parse(usersData);
    console.log(`📂 Loaded users from ${usersFile}`);
  } catch (err) {
    console.warn(`users.json not found or invalid, creating new: ${err.message}`);
    await fs.writeFile(usersFile, '{}', 'utf8');
  }
}

const MODS_CACHE_FILE = path.join(dataDir, 'mods.json');
let globalCache = { mods: [], lastChecked: new Date().toISOString() };
async function loadModCache() {
  try {
    const cacheData = await fs.readFile(MODS_CACHE_FILE, 'utf8');
    const cachedMods = JSON.parse(cacheData);
    if (Array.isArray(cachedMods)) {
      globalCache.mods = cachedMods.sort((a, b) => new Date(a.date) - new Date(b.date));
      console.log(`📂 Loaded ${globalCache.mods.length} mods from ${MODS_CACHE_FILE}`);
    } else {
      console.warn('mods.json content is not an array, initializing as empty.');
      globalCache.mods = [];
      await fs.writeFile(MODS_CACHE_FILE, JSON.stringify(globalCache.mods, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn(`Failed to load mods.json: ${err.message}. Initializing as empty.`);
    globalCache.mods = [];
    await fs.writeFile(MODS_CACHE_FILE, JSON.stringify(globalCache.mods, null, 2), 'utf8');
  }
}

const PERSONAL_MODS_CACHE_FILE = path.join(dataDir, 'personal_mods.json');
let personalCache = { mods: {}, lastResetDate: new Date().toISOString() };
async function loadPersonalModCache() {
  try {
    const cacheData = await fs.readFile(PERSONAL_MODS_CACHE_FILE, 'utf8');
    const parsedData = JSON.parse(cacheData);
    personalCache = {
      mods: parsedData.mods && typeof parsedData.mods === 'object' ? parsedData.mods : {},
      lastResetDate: parsedData.lastResetDate || new Date().toISOString(),
    };
    console.log(`📂 Loaded personal mods from ${PERSONAL_MODS_CACHE_FILE}`);
  } catch (err) {
    console.warn(`personal_mods.json not found or invalid, creating new: ${err.message}`);
    await fs.writeFile(PERSONAL_MODS_CACHE_FILE, JSON.stringify(personalCache, null, 2), 'utf8');
  }
}

async function saveModCache() {
  try {
    console.log(`Attempting to save ${globalCache.mods.length} mods to ${MODS_CACHE_FILE}`);
    await fs.writeFile(MODS_CACHE_FILE, JSON.stringify(globalCache.mods, null, 2), 'utf8');
    console.log('💾 Mod cache saved to mods.json');
  } catch (err) {
    console.error('❌ Failed to save mod cache:', err.message);
  }
}

async function savePersonalModCache() {
  try {
    console.log(`Attempting to save personal mods to ${PERSONAL_MODS_CACHE_FILE}`);
    await fs.writeFile(PERSONAL_MODS_CACHE_FILE, JSON.stringify(personalCache, null, 2), 'utf8');
    console.log('💾 Personal mod cache saved to personal_mods.json');
  } catch (err) {
    console.error('❌ Failed to save personal mod cache:', err.message);
  }
}

const PERSONAL_NEXUS_CHANNEL_ID = process.env.PERSONAL_NEXUS_CHANNEL_ID;
const MOD_UPDATER_CHANNEL_ID = process.env.MOD_UPDATER_CHANNEL_ID;
const NEXUS_AUTHOR_ID = process.env.NEXUS_AUTHOR_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DEBUG = process.env.DEBUG === 'true';
const GAME_DOMAIN = 'starwarsbattlefront22017';
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://translationlib.onrender.com';
const CLIENT_ID = process.env.CLIENT_ID;
const WELCOME_CHANNEL_ID = '1361849763611541584';
const MOD_CHANNEL_ID = '1362988156546449598';
const KYBER_ANNOUNCEMENTS_CHANNEL_ID = '1363367257010606231';
const MESSAGE_ID_KEY = 'REACTION_ROLE_MESSAGE_ID';
const commandsRegisteredFile = path.join(dataDir, 'commands_registered.txt');
const SW_CACHE_FILE = path.join(dataDir, 'sw_articles.json');
const NEWS_CATEGORY = 'star-wars';
const SW_URL = `https://www.starwarsnewsnet.com/category/${NEWS_CATEGORY}`;
const SW_CHANNEL_ID = process.env.DISCORD_SW_CHANNEL_ID;

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN is not set!');
  process.exit(1);
}
if (!PERSONAL_NEXUS_CHANNEL_ID) {
  console.error('❌ PERSONAL_NEXUS_CHANNEL_ID is not set!');
  process.exit(1);
}
if (!MOD_UPDATER_CHANNEL_ID) {
  console.error('❌ MOD_UPDATER_CHANNEL_ID is not set!');
  process.exit(1);
}
if (!NEXUS_AUTHOR_ID) {
  console.error('❌ NEXUS_AUTHOR_ID is not set!');
  process.exit(1);
}
if (!SW_CHANNEL_ID) {
  console.error('❌ DISCORD_SW_CHANNEL_ID is not set!');
  process.exit(1);
}
if (!process.env.KYBER_API_KEY) {
  console.error('❌ KYBER_API_KEY is not set!');
  process.exit(1);
}

const roleMapping = {
  [process.env.GUARDIAN_EMOJI_ID]: process.env.GUARDIAN_ROLEID,
  [process.env.CONSULAR_EMOJI_ID]: process.env.CONSULAR_ROLEID,
  [process.env.MARAUDER_EMOJI_ID]: process.env.MARAUDER_ROLEID,
  [process.env.SENTINEL_EMOJI_ID]: process.env.SENTINEL_ROLEID,
  [process.env.MANDALORIAN_EMOJI_ID]: process.env.MANDALORIAN_ROLEID,
  [process.env.BALANCED_EMOJI_ID]: process.env.BALANCED_ROLEID,
  [process.env.INQUISITOR_EMOJI_ID]: process.env.INQUISITOR_ROLEID,
  [process.env.SORCERER_EMOJI_ID]: process.env.SORCERER_ROLEID,
  [process.env.GREYWARDEN_EMOJI_ID]: process.env.GREYWARDEN_ROLEID
};

const supportedLanguages = [
  'ar', 'de', 'en', 'es', 'fr',
  'ja', 'ko', 'lt', 'pb', 'pl', 'pt',
  'ru', 'sv', 'tr', 'zt',
];

const targetChannels = [
  '1361838672818995312',
  '1366888045164499097',
  '1362441078908784793',
  '1366886810885689456',
  '1366887040498663634',
  '1364277004198875278'
];

const triggers = [
  'kill me now', 'ableist joke', 'homophobic joke', 'misogynistic joke', 'distasteful joke'
];

const extremeTriggers = [
  'nigger', 'chink', 'gook', 'spic', 'kike', 'sand nigger', 'porch monkey',
  'slant eye', 'wetback', 'beaner', 'camel jockey', 'raghead', 'towelhead',
  'monkey', 'jungle bunny', 'zipperhead', 'yellow peril', 'coon', 'pickaninny',
  'gas the jews', 'heil hitler', 'sieg heil', 'oven dodger', 'hook nose', 'dirty jew',
  'faggot', 'dyke', 'tranny', 'fudge packer', 'shemale', 'cripple',
  'drag freak', 'queer', 'retard', 'spastic', 'mongoloid', 'window licker',
  'bitch', 'cunt', 'slut', 'whore', 'hoe', 'dumb broad', 'she asked for it',
  'rape her', 'kill her', 'rape', 'rape you', 'raping', 'kill yourself', 'kms',
  'go hang yourself', 'slit your wrists', 'choke and die', 'kys',
  'beat her', 'abuse her', 'molest', 'pedophile', 'pedo', 'groomer',
  'go back to your country', 'illegal alien', 'white power',
  'white pride', 'ethnic cleansing', 'great replacement',
  'kkk', 'white lives matter', '14 words', '1488', 'six million wasn\'t enough',
  'soy boy', 'femoid', 'you should die', 'ashkenazi scum',
  'roastie', 'chad', 'stacy', 'rape fuel', 'gymcel', 'kill all women',
  'mass shooter vibes', 'fuck you', 'die', 'i hope you die',
  'useless piece of shit', 'waste of air', 'why are you alive',
];

async function registerCommands() {
  if (require('fs').existsSync(commandsRegisteredFile)) {
    console.log('Slash commands already registered, skipping...');
    return;
  }

  if (!CLIENT_ID) {
    console.error('CLIENT_ID environment variable is not set! Cannot register commands.');
    return;
  }

  try {
    console.log('🔧 Registering slash commands...');
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered successfully.');
    await fs.writeFile(commandsRegisteredFile, 'registered', 'utf8');
  } catch (err) {
    console.error('❌ Error registering commands:', err.message);
  }
}

async function fetchModsFromAPI() {
  const lastChecked = globalCache.lastChecked ? new Date(globalCache.lastChecked) : null;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cutoff = lastChecked && !isNaN(lastChecked) && lastChecked < oneDayAgo ? lastChecked : oneDayAgo;
  console.log('📅 Using cutoff date (mods newer than this will be included):', cutoff.toISOString());
  console.log(`ℹ️ NSFW Filter is: ${process.env.FILTER_NSFW}`);
  try {
    console.log('📡 Fetching mods from Nexus API...');
    const response = await axios.get(
      `https://api.nexusmods.com/v1/games/${GAME_DOMAIN}/mods/latest_updated.json`,
      {
        headers: {
          apikey: process.env.NEXUS_API_KEY,
          Accept: 'application/json',
        },
      }
    );
    console.log(`📡 Fetched ${response.data.length} mods from Nexus API`);
    if (DEBUG) {
      console.log('🗃️ Full API response:', JSON.stringify(response.data, null, 2));
    }
    const filteredMods = response.data
      .filter(mod => {
        if (mod.status !== 'published' || !mod.available) {
          console.log(`[SKIP] ${mod.name || 'Unnamed'} is not published or available`);
          return false;
        }
        if (process.env.FILTER_NSFW === 'true' && mod.contains_adult_content) {
          console.log(`[SKIP] ${mod.name || 'Unnamed'} is marked NSFW`);
          return false;
        }
        const timestamp = mod.updated_timestamp || mod.created_timestamp;
        if (!timestamp || isNaN(timestamp)) {
          console.error(`[SKIP] ${mod.name || 'Unnamed'} has invalid timestamp`);
          return false;
        }
        const modDate = new Date(timestamp * 1000);
        console.log(`🔍 Mod: ${mod.name}, Date: ${modDate.toISOString()}, Cutoff: ${cutoff.toISOString()}, Included: ${modDate > cutoff}`);
        return modDate > cutoff;
      })
      .map(mod => ({
        title: mod.name || 'Unnamed Mod',
        url: `https://www.nexusmods.com/${GAME_DOMAIN}/mods/${mod.mod_id}`,
        date: new Date((mod.updated_timestamp || mod.created_timestamp) * 1000).toISOString(),
        category: mod.category_name || 'Uncategorized',
        version: mod.version || 'Unknown',
        mod_id: mod.mod_id,
        image: mod.picture_url || null
      }));
    console.log(`📡 After filtering: ${filteredMods.length} mods remain`);
    return filteredMods;
  } catch (err) {
    console.error('❌ Error retrieving mods from API:', err.message);
    return [];
  }
}

async function fetchPersonalModsFromAPI() {
  const MOD_ID = 11814;
  const MAX_RETRIES = 3;
  let attempt = 1;

  while (attempt <= MAX_RETRIES) {
    try {
      console.log(`📡 Fetching personal mod_id ${MOD_ID} from Nexus API (Attempt ${attempt}/${MAX_RETRIES})...`);
      const response = await axios.get(
        `https://api.nexusmods.com/v1/games/${GAME_DOMAIN}/mods/${MOD_ID}.json`,
        {
          headers: {
            apikey: process.env.NEXUS_API_KEY,
            Accept: 'application/json',
          },
        }
      );
      console.log(`✅ Fetched personal mod: ${response.data.name || 'Unnamed'}`);
      if (DEBUG) {
        console.log('📜 Personal mod response:', JSON.stringify(response.data, null, 2));
      }
      const mod = response.data;
      if (mod.status !== 'published' || !mod.available) {
        console.log(`[SKIP] ${mod.name || 'Unnamed'} is not published or available`);
        return [];
      }
      if (process.env.FILTER_NSFW === 'true' && mod.contains_adult_content) {
        console.log(`[SKIP] ${mod.name || 'Unnamed'} is marked NSFW`);
        return [];
      }
      console.log(`✅ Including mod_id ${MOD_ID} (${mod.name})`);
      return [{
        title: mod.name || 'Unnamed Mod',
        url: `https://www.nexusmods.com/${GAME_DOMAIN}/mods/${mod.mod_id}`,
        date: new Date((mod.updated_timestamp || mod.created_timestamp) * 1000).toISOString(),
        category: mod.category_name || 'Uncategorized',
        version: mod.version || 'Unknown',
        mod_id: mod.mod_id,
        image: mod.picture_url || null
      }];
    } catch (err) {
      console.error(`❌ Error fetching mod_id ${MOD_ID} (Attempt ${attempt}/${MAX_RETRIES}):`, {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      if (attempt === MAX_RETRIES) {
        console.error(`❌ Max retries reached for mod_id ${MOD_ID}. Skipping.`);
        return [];
      }
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function sendDiscordNotification(mods, channelId) {
  if (!mods || !mods.length) {
    console.log('⚠️ No mods to post');
    return;
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.error(`❌ Channel ${channelId} not found or is not a text channel`);
      return;
    }
  } catch (err) {
    console.error(`❌ Error fetching channel ${channelId}:`, err.message);
    return;
  }

  const hasSendPermission = channel.permissionsFor(client.user)?.has('SEND_MESSAGES');
  if (!hasSendPermission) {
    console.error(`❌ Bot lacks SEND_MESSAGES permission in channel ${channelId}`);
    return;
  }

  for (const mod of mods) {
    const embed = new EmbedBuilder()
      .setTitle(`🛠️ New Mod Update: ${mod.title}`)
      .setDescription(`🎮 Version: ${mod.version}\n📅 Date: ${mod.date}\n📚 Category: ${mod.category}\n🔗 [Download](${mod.url})`)
      .setColor('#00FF00')
      .setFooter({ text: 'Star Wars: Battlefront II Mods' })
      .setTimestamp();
    if (mod.image) {
      embed.setImage(mod.image);
    }
    try {
      console.log(`📤 Sending to Discord channel ${channelId}: ${mod.title} (v${mod.version})`);
      await channel.send({ embeds: [embed] });
      console.log(`✅ Successfully sent: ${mod.title} to channel ${channelId}`);
    } catch (err) {
      console.error(`❌ Failed to send "${mod.title}" to Discord channel ${channelId}:`, err.message);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

async function checkForNewMods() {
  console.log('🔍 Checking for new mods...');
  try {
    const apiMods = await fetchModsFromAPI();
    const apiSeen = new Set(globalCache.mods.map(m => `${m.mod_id}:${m.version}`));
    const newApiMods = apiMods.filter(mod => {
      const isNew = !apiSeen.has(`${mod.mod_id}:${mod.version}`);
      console.log(`🔎 Cache check: ${mod.title} (mod_id:${mod.mod_id}, v${mod.version}) - New: ${isNew}`);
      return isNew;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (newApiMods.length) {
      console.log(`✅ Found ${newApiMods.length} new mods`);
      newApiMods.forEach(mod => console.log(`- ${mod.title} (v${mod.version}, ${mod.date})`));
      await sendDiscordNotification(newApiMods, MOD_UPDATER_CHANNEL_ID);
      newApiMods.forEach(newMod => {
        let inserted = false;
        for (let i = 0; i < globalCache.mods.length; i++) {
          if (new Date(newMod.date) < new Date(globalCache.mods[i].date)) {
            globalCache.mods.splice(i, 0, newMod);
            inserted = true;
            break;
          }
        }
        if (!inserted) globalCache.mods.push(newMod);
      });
      globalCache.mods = globalCache.mods.slice(0, 100000);
      globalCache.lastChecked = new Date().toISOString();
      await saveModCache();
    } else {
      console.log('ℹ️ No new mods found');
    }
    const personalMods = await fetchPersonalModsFromAPI();
    const newPersonalMods = [];
    for (const mod of personalMods) {
      const cachedMod = personalCache.mods[mod.mod_id] || {};
      const isNewVersion = !cachedMod.version || cachedMod.version !== mod.version;
      const isNewDate = !cachedMod.date || new Date(mod.date) > new Date(cachedMod.date);
      console.log(`🔎 Comparing ${mod.title}: isNewVersion=${isNewVersion}, isNewDate=${isNewDate}, cachedVersion=${cachedMod.version || 'none'}, cachedDate=${cachedMod.date || 'none'}`);
      if (isNewVersion || isNewDate) {
        console.log(`🆕 New update for ${mod.title}: v${mod.version}, date ${mod.date}`);
        newPersonalMods.push(mod);
        personalCache.mods[mod.mod_id] = mod;
      } else {
        console.log(`ℹ️ No update for ${mod.title}: v${mod.version}, date ${mod.date}`);
      }
    }
    if (newPersonalMods.length) {
      console.log(`✅ Found ${newPersonalMods.length} new personal mods`);
      newPersonalMods.forEach(mod => console.log(`- ${mod.title} (v${mod.version}, ${mod.date})`));
      await sendDiscordNotification(newPersonalMods, PERSONAL_NEXUS_CHANNEL_ID);
      personalCache.lastResetDate = new Date().toISOString();
      await savePersonalModCache();
    } else {
      console.log('ℹ️ No new personal mods found');
    }
  } catch (err) {
    console.error('❌ Error in mod check:', err.message);
    console.error(err.stack);
  }
}

let swCache = [];
async function loadSWCache() {
  try {
    const data = await fs.readFile(SW_CACHE_FILE, 'utf8');
    swCache = JSON.parse(data);
    console.log(`📰 Loaded Star Wars articles from cache (${swCache.length})`);
  } catch {
    swCache = [];
    await fs.writeFile(SW_CACHE_FILE, JSON.stringify(swCache), 'utf8');
    console.log('🗑️ Created new Star Wars cache file');
  }
}

async function saveSWCache() {
  await fs.writeFile(SW_CACHE_FILE, JSON.stringify(swCache.slice(0, 100), null, 2), 'utf8');
  console.log('💾 Saved Star Wars cache');
}

async function scrapeSWArticles() {
  const chromium = require('@sparticuz/chromium');
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  console.log(`🌐 Visiting ${SW_URL}...`);
  await page.goto(SW_URL, { waitUntil: 'domcontentloaded' });
  const articles = await page.evaluate(() => {
    const entries = [];
    const seen = new Set();
    const elements = document.querySelectorAll('article');
    for (const el of elements) {
      const titleEl = el.querySelector('h2.entry-title a');
      const timeEl = el.querySelector('time.entry-date');
      const title = titleEl?.textContent?.trim();
      let url = titleEl?.href?.trim();
      const date = timeEl?.getAttribute('datetime') || 'Unknown';
      if (title && url && !seen.has(url)) {
        seen.add(url);
        if (!url.startsWith('http')) {
          url = 'https://www.starwarsnewsnet.com' + (url.startsWith('/') ? url : '/' + url);
        }
        entries.push({ title, url, date });
      }
    }
    return entries;
  });
  await browser.close();
  console.log(`✅ Extracted ${articles.length} articles`);
  return articles;
}

async function checkSWUpdates() {
  console.log('🔍 Checking for new Star Wars NewsNet articles...');
  try {
    await loadSWCache();
    const fresh = await scrapeSWArticles();
    if (!Array.isArray(fresh)) {
      console.warn('⚠️ scrapeSWArticles() did not return an array. Skipping.');
      return;
    }
    const swChannel = await client.channels.fetch(SW_CHANNEL_ID).catch(err => {
      console.error('❌ Failed to fetch SW_CHANNEL_ID:', err.message);
      return null;
    });
    if (!swChannel || !swChannel.isTextBased()) {
      console.error('❌ Invalid SW Discord channel or not text-based');
      return;
    }
    const newArticles = fresh.filter(article => !swCache.some(cached => cached.url === article.url));
    newArticles.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!newArticles.length) {
      console.log('ℹ️ No new Star Wars articles found');
      return;
    }
    for (const article of newArticles) {
      const msg = `📰 **New Star Wars Article**\n**Title**: ${article.title}\n**Date**: ${article.date}\n**Link**: ${article.url}`;
      await swChannel.send({ content: msg }).catch(console.error);
      await new Promise(r => setTimeout(r, 1500));
    }
    swCache = [...newArticles, ...swCache];
    await saveSWCache();
    console.log(`✅ Posted ${newArticles.length} new articles to Discord`);
  } catch (err) {
    console.error('❌ Error during checkSWUpdates:', err.message);
  }
}

// KYBER server status checking
let kyberStatusCache = null;
async function sendKyberStatusUpdate(isOnline) {
  const kyberChannel = await client.channels.fetch(KYBER_ANNOUNCEMENTS_CHANNEL_ID).catch(err => {
    console.error(`❌ Failed to fetch KYBER_ANNOUNCEMENTS_CHANNEL_ID (${KYBER_ANNOUNCEMENTS_CHANNEL_ID}):`, err.message);
    return null;
  });
  if (!kyberChannel || !kyberChannel.isTextBased()) {
    console.error(`❌ Invalid KYBER announcements channel or not text-based`);
    return;
  }
  const hasSendPermission = kyberChannel.permissionsFor(client.user)?.has('SEND_MESSAGES');
  if (!hasSendPermission) {
    console.error(`❌ Bot lacks SEND_MESSAGES permission in channel ${KYBER_ANNOUNCEMENTS_CHANNEL_ID}`);
    return;
  }

  if (kyberStatusCache === null) {
    kyberStatusCache = isOnline;
    console.log(`ℹ️ Initial KYBER status set: ${isOnline ? 'Online' : 'Offline'}`);
    return;
  }

  if (kyberStatusCache !== isOnline) {
    const embed = new EmbedBuilder()
      .setTitle(`KYBER Server Status Update`)
      .setDescription(`The KYBER server is now **${isOnline ? 'Online' : 'Offline'}**.`)
      .setColor(isOnline ? '#00FF00' : '#FF0000')
      .setFooter({ text: 'KYBER Server Status' })
      .setTimestamp();
    try {
      await kyberChannel.send({ embeds: [embed] });
      console.log(`✅ Sent KYBER status update to channel ${KYBER_ANNOUNCEMENTS_CHANNEL_ID}: ${isOnline ? 'Online' : 'Offline'}`);
    } catch (err) {
      console.error(`❌ Failed to send KYBER status update to channel ${KYBER_ANNOUNCEMENTS_CHANNEL_ID}:`, err.message);
    }
    kyberStatusCache = isOnline;
  } else {
    console.log('ℹ️ No change in KYBER server status');
  }
}

async function checkKyberStatus() {
  console.log('🔍 Checking KYBER server status...');
  const KYBER_API_URL = process.env.KYBER_API_URL || 'https://kyber.gg/api/v2/status';
  const STATUSPAGE_URL = 'https://api.statuspage.io/v1/pages/[PAGE_ID]/components'; // Replace [PAGE_ID] with actual ID
  const MAX_RETRIES = 3;

  // Try KYBER API with retries
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const dns = require('dns').promises;
      const domain = new URL(KYBER_API_URL).hostname;
      try {
        const addresses = await dns.resolve(domain);
        console.log(`DNS Resolution for ${domain}:`, addresses);
      } catch (dnsErr) {
        console.error(`DNS Resolution Error for ${domain}:`, dnsErr.message);
      }

      const response = await axios.get(KYBER_API_URL, {
        headers: {
          Authorization: `Bearer ${process.env.KYBER_API_KEY}`,
          Accept: 'application/json',
        },
        timeout: 10000,
      });
      const isOnline = response.data.status === 'online';
      console.log(`📡 KYBER server status (API): ${isOnline ? 'Online' : 'Offline'}`);
      await sendKyberStatusUpdate(isOnline);
      return;
    } catch (err) {
      console.error(`❌ Error checking KYBER API (Attempt ${attempt}/${MAX_RETRIES}):`, {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Retrying KYBER API after ${2000 * attempt}ms...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  // Fallback to Statuspage API
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(STATUSPAGE_URL, {
        headers: { Authorization: `OAuth ${process.env.STATUSPAGE_API_KEY || 'placeholder'}` },
        timeout: 10000,
      });
      const apiComponent = response.data.find(comp => comp.name === 'API');
      const isOnline = apiComponent && apiComponent.status === 'operational';
      console.log(`📡 KYBER server status (Statuspage): ${isOnline ? 'Online' : 'Offline'}`);
      await sendKyberStatusUpdate(isOnline);
      return;
    } catch (err) {
      console.error(`❌ Error checking Statuspage API (Attempt ${attempt}/${MAX_RETRIES}):`, {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Retrying Statuspage API after ${2000 * attempt}ms...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  // Fallback to scraping (uncomment if needed)
  /*
  try {
    const isOnline = await scrapeKyberStatus();
    console.log(`📡 KYBER server status (scraped): ${isOnline ? 'Online' : 'Offline'}`);
    await sendKyberStatusUpdate(isOnline);
  } catch (scrapeErr) {
    console.error('❌ Error scraping KYBER status:', scrapeErr.message);
  }
  */
}

/*
// Fallback scraping function
async function scrapeKyberStatus() {
  console.log('🌐 Scraping KYBER server status from https://kyber.gg...');
  const chromium = require('@sparticuz/chromium');
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.goto('https://kyber.gg', { waitUntil: 'domcontentloaded' });
  const status = await page.evaluate(() => {
    const statusElement = document.querySelector('body');
    if (statusElement) {
      const text = statusElement.textContent.toLowerCase();
      return text.includes('online') && !text.includes('offline');
    }
    return false;
  });
  await browser.close();
  console.log(`✅ Scraped KYBER status: ${status ? 'Online' : 'Offline'}`);
  return status;
}
*/

const desiredRoleOrder = [
  '1362490083017625640', // Sorcerer
  '1362490015648579845', // Inquisitor
  '1362489042821972219', // Grey Warden
  '1362488725111705650', // Balanced
  '1362488684469026976', // Mandalorian
  '1362488521671311601', // Sentinel
  '1362488467757465981', // Marauder
  '1362488420299047024', // Consular
  '1362488297510797443', // Guardian
  '1362476681356509427', // Droids
  '1380201310711840949', // KYBER Team Manager
  '1363638233208062155', // KYBER Team
  '1364262718487531581', // LFG-VANILLA
  '1371897792695369778', // LFG-CLASSIC2005
  '1371895939786080297', // LFG-CLASSIC2004
  '1365936777176682547', // LFG-SWTOR
  '1364271161000591430'  // LFG-KYBER
];

// Cache for role positions
let rolePositionCache = null;

async function checkAndReorderRoles(force = false) {
  console.log('🔍 Checking role order...', force ? '(Forced)' : '');
  try {
    const guild = client.guilds.cache.first();
    if (!guild) {
      console.error('❌ No guild found for role reordering');
      return;
    }

    const botMember = guild.members.cache.get(client.user.id);
    if (!botMember) {
      console.error('❌ Bot member not found in guild');
      return;
    }
    console.log(`ℹ️ Bot: ${client.user.tag}, Role: ${botMember.roles.highest.name}, Position: ${botMember.roles.highest.position}`);
    if (!botMember.permissions.has('MANAGE_ROLES')) {
      console.error('❌ Bot lacks MANAGE_ROLES permission for role reordering');
      return;
    }

    await guild.roles.fetch(null, { force: true });
    const roles = guild.roles.cache;

    console.log('ℹ️ Available roles in guild:');
    roles.forEach(role => {
      console.log(`- ID: ${role.id}, Name: ${role.name}, Position: ${role.position}`);
    });

    const currentOrder = {};
    roles.forEach(role => {
      if (desiredRoleOrder.includes(role.id)) {
        currentOrder[role.id] = role.position;
      }
    });

    const isOutOfOrder = force || desiredRoleOrder.some((roleId, index) => {
      const currentPos = currentOrder[roleId];
      if (typeof currentPos === 'undefined') {
        console.log(`⚠️ Role ${roleId} not found in guild - check ID or role existence`);
        return false;
      }
      if (!rolePositionCache || currentPos !== rolePositionCache[roleId]) {
        console.log(`🔎 Role ${roleId} position: ${currentPos}, expected relative order check, cache: ${rolePositionCache ? rolePositionCache[roleId] : 'none'}`);
        return true;
      }
      return false;
    });

    if (!isOutOfOrder && rolePositionCache && !force) {
      console.log('ℹ️ Role order is correct, no changes needed');
      return;
    }

    const newPositions = [];
    let basePosition = botMember.roles.highest.position - 1;
    for (let i = 0; i < desiredRoleOrder.length; i++) {
      const roleId = desiredRoleOrder[i];
      const role = roles.get(roleId);
      if (role) {
        if (basePosition < 1) {
          console.error('❌ Position too low to assign roles; bot role position too low');
          return;
        }
        newPositions.push({ role: roleId, position: basePosition-- });
      } else {
        console.log(`⚠️ Role ${roleId} not found in guild - check ID or role existence`);
      }
    }

    console.log('ℹ️ Intended role positions:');
    newPositions.forEach(pos => {
      const role = roles.get(pos.role);
      console.log(`- ID: ${pos.role}, Name: ${role ? role.name : 'Unknown'}, New Position: ${pos.position}`);
    });

    try {
      if (newPositions.length > 0) {
        await guild.roles.setPositions(newPositions);
        console.log('✅ Role positions updated successfully');
        rolePositionCache = {};
        roles.forEach(role => {
          if (desiredRoleOrder.includes(role.id)) {
            rolePositionCache[role.id] = role.position;
          }
        });
      } else {
        console.log('⚠️ No valid roles to reorder');
      }
    } catch (err) {
      console.error('❌ Error updating role positions:', err.message);
    }
  } catch (err) {
    console.error('❌ Error in checkAndReorderRoles:', err.message);
  }
}

client.once('ready', async () => {
  console.log(`🚀 Logged in as ${client.user.tag}`);
  await loadUsers();
  await loadModCache();
  await loadPersonalModCache();
  await registerCommands();

  const channel = client.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) {
    console.error('❌ Welcome channel not found:', WELCOME_CHANNEL_ID);
    return;
  }
  const embed = new EmbedBuilder()
    .setTitle('The strongest stars have hearts of kyber.')
    .setDescription(
      'Across the galaxy, every warrior channels the Force through a crystal attuned to their essence.\n\n' +
      Object.keys(roleMapping)
        .map(emojiId => {
          const emoji = client.emojis.cache.get(emojiId);
          return emoji ? `<:${emoji.name}:${emojiId}> ${emoji.name}` : '';
        })
        .filter(line => line)
        .join('\n')
    )
    .setFooter({ text: 'React to claim your role (only one role allowed at a time)!' })
    .setColor('#FFD700');
  let message;
  const messageId = process.env[MESSAGE_ID_KEY];
  if (messageId) {
    try {
      message = await channel.messages.fetch(messageId);
      console.log('📧 Found existing message:', messageId);
      if (message.embeds.length === 0 || message.embeds[0].title !== embed.data.title) {
        console.log('⚠️ Existing message is not the expected embed, creating new one');
        message = null;
      }
    } catch (err) {
      console.error('❌ Error fetching message:', err.message);
    }
  } else {
    console.log('ℹ️ No message ID provided in environment variables');
  }
  if (!message) {
    try {
      message = await channel.send({ embeds: [embed] });
      console.log(`📩 New message posted with ID: ${message.id}`);
      console.log('Please update REACTION_ROLE_MESSAGE_ID in Render environment variables with:', message.id);
      for (const emojiId of Object.keys(roleMapping)) {
        await message.react(emojiId).catch(console.error);
      }
    } catch (err) {
      console.error('❌ Error posting new embed:', err.message);
    }
  }

  const initialModId = 11814;
  const initialDate = new Date('2025-04-20T00:00:00Z');
  if (!personalCache.mods[initialModId]) {
    console.log(`📢 Simulating initial post for BF Poofies (mod_id ${initialModId}) on ${initialDate.toISOString()}`);
    const initialMod = {
      title: 'BF Poofies',
      url: `https://www.nexusmods.com/${GAME_DOMAIN}/mods/${initialModId}`,
      date: initialDate.toISOString(),
      category: 'Customization',
      version: '1.0.0',
      mod_id: initialModId
    };
    personalCache.mods[initialModId] = initialMod;
    personalCache.lastResetDate = initialDate.toISOString();
    await savePersonalModCache();
    const personalChannel = await client.channels.fetch(PERSONAL_NEXUS_CHANNEL_ID);
    if (personalChannel && personalChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle(`🛠️ Initial Post: ${initialMod.title}`)
        .setDescription(`🎮 Version: ${initialMod.version}\n📅 Date: ${initialDate.toISOString()}\n📚 Category: ${initialMod.category}\n🔗 [Download](${initialMod.url})`)
        .setColor('#00FF00')
        .setFooter({ text: 'Star Wars: Battlefront II Mods' })
        .setTimestamp();
      await personalChannel.send({ embeds: [embed] });
      console.log(`✅ Sent initial post for ${initialMod.title} to ${PERSONAL_NEXUS_CHANNEL_ID}`);
    }
  } else {
    console.log(`ℹ️ Initial post for BF Poofies (mod_id: ${initialModId}) already exists, skipping`);
  }

  const lastChecked = new Date(globalCache.lastChecked);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (isNaN(lastChecked) || lastChecked < oneDayAgo) {
    console.log('🔍 Performing initial mod check and sort since cache is empty or outdated');
    try {
      const initialApiMods = await fetchModsFromAPI().then(mods => mods.sort((a, b) => new Date(a.date) - new Date(b.date)));
      const apiSeen = new Set(globalCache.mods.map(m => `${m.mod_id}:${m.version}`));
      const newInitialApiMods = initialApiMods.filter(mod => !apiSeen.has(`${mod.mod_id}:${mod.version}`));
      if (newInitialApiMods.length) {
        console.log(`✅ Found ${newInitialApiMods.length} new initial API mods`);
        newInitialApiMods.forEach(mod => console.log(`- ${mod.title} (v${mod.version}, ${mod.date})`));
        await sendDiscordNotification(newInitialApiMods, MOD_UPDATER_CHANNEL_ID);
        newInitialApiMods.forEach(newMod => {
          let inserted = false;
          for (let i = 0; i < globalCache.mods.length; i++) {
            if (new Date(newMod.date) < new Date(globalCache.mods[i].date)) {
              globalCache.mods.splice(i, 0, newMod);
              inserted = true;
              break;
            }
          }
          if (!inserted) globalCache.mods.push(newMod);
        });
        globalCache.mods = globalCache.mods.slice(0, 100000);
        globalCache.lastChecked = new Date().toISOString();
        await saveModCache();
      } else {
        console.log('ℹ️ No new initial API mods found');
      }

      const initialPersonalMods = await fetchPersonalModsFromAPI().then(mods => mods.sort((a, b) => new Date(a.date) - new Date(b.date)));
      const newInitialPersonalMods = [];
      for (const mod of initialPersonalMods) {
        const cachedMod = personalCache.mods[mod.mod_id] || {};
        const isNewVersion = !cachedMod.version || cachedMod.version !== mod.version;
        const isNewDate = !cachedMod.date || new Date(mod.date) > new Date(cachedMod.date);
        if (isNewVersion || isNewDate) {
          newInitialPersonalMods.push(mod);
          personalCache.mods[mod.mod_id] = mod;
        }
      }
      if (newInitialPersonalMods.length) {
        console.log(`✅ Found ${newInitialPersonalMods.length} new initial personal mods`);
        newInitialPersonalMods.forEach(mod => console.log(`- ${mod.title} (v${mod.version}, ${mod.date})`));
        await sendDiscordNotification(newInitialPersonalMods, PERSONAL_NEXUS_CHANNEL_ID);
        personalCache.lastResetDate = new Date().toISOString();
        await savePersonalModCache();
      } else {
        console.log('ℹ️ No new initial personal mods found');
      }
    } catch (err) {
      console.error('❌ Error during initial mod check:', err.message);
    }
  } else {
    console.log(`ℹ️ Skipped initial mod check: Cache is recent (last checked: ${globalCache.lastChecked})`);
  }

  setInterval(checkForNewMods, 12 * 60 * 60 * 1000); // Every 12 hours
  setInterval(checkSWUpdates, 12 * 60 * 60 * 1000); // Every 12 hours
  setInterval(checkKyberStatus, 5 * 60 * 1000); // Every 5 minutes
  setInterval(() => checkAndReorderRoles(), 24 * 60 * 60 * 1000); // Every 24 hours
  await checkAndReorderRoles(true); // Initial check
});

client.login(DISCORD_TOKEN);
