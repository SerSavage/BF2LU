const { Client, GatewayIntentBits, AttachmentBuilder, REST, Routes, EmbedBuilder, WebhookClient } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
require('dotenv').config();

// Add stealth plugin for puppeteer
puppeteer.use(StealthPlugin());

const dataDir = '/app/data';
if (!require('fs').existsSync(dataDir)) {
  require('fs').mkdirSync(dataDir, { recursive: true });
}

// Initialize cache files if missing
if (!require('fs').existsSync(path.join(dataDir, 'mods.json'))) {
  require('fs').writeFileSync(path.join(dataDir, 'mods.json'), JSON.stringify([], null, 2));
  console.log('Created mods.json');
}
if (!require('fs').existsSync(path.join(dataDir, 'personal_mods.json'))) {
  require('fs').writeFileSync(path.join(dataDir, 'personal_mods.json'), JSON.stringify({ mods: [], lastResetDate: new Date().toISOString() }, null, 2));
  console.log('Created personal_mods.json');
}
if (!require('fs').existsSync(path.join(dataDir, 'lastest.json'))) {
  require('fs').writeFileSync(path.join(dataDir, 'lastest.json'), JSON.stringify({ categories: {}, lastResetDate: new Date().toISOString() }, null, 2));
  console.log('Created lastest.json');
}

const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ]
});

// Initialize webhook client
const webhookClient = process.env.DISCORD_WEBHOOK_URL ? new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL }) : null;

const commands = require('./commands.json');

let users = {};
const usersFile = path.join(__dirname, 'users.json');
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
      await fs.writeFile(MODS_CACHE_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  } catch (err) {
    console.warn(`mods.json not found or invalid, creating new: ${err.message}`);
    await fs.writeFile(MODS_CACHE_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

const PERSONAL_MODS_CACHE_FILE = path.join(dataDir, 'personal_mods.json');
let personalCache = { mods: [], lastResetDate: new Date().toISOString() };
async function loadPersonalModCache() {
  try {
    const cacheData = await fs.readFile(PERSONAL_MODS_CACHE_FILE, 'utf8');
    const parsedData = JSON.parse(cacheData);
    personalCache = {
      mods: Array.isArray(parsedData.mods) ? parsedData.mods : [],
      lastResetDate: parsedData.lastResetDate || new Date().toISOString(),
    };
    console.log(`📂 Loaded ${personalCache.mods.length} personal mods from ${PERSONAL_MODS_CACHE_FILE}`);
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
    console.log(`Attempting to save ${personalCache.mods.length} personal mods to ${PERSONAL_MODS_CACHE_FILE}`);
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
const MESSAGE_ID_KEY = 'REACTION_ROLE_MESSAGE_ID';
const commandsRegisteredFile = path.join(__dirname, 'commands_registered.txt');

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
if (!process.env.DISCORD_CHANNEL_ID) {
  console.error('❌ DISCORD_CHANNEL_ID is not set!');
  process.exit(1);
}
if (!process.env.DISCORD_WEBHOOK_URL || !webhookClient) {
  console.error('❌ DISCORD_WEBHOOK_URL is not set or invalid!');
  process.exit(1);
}

const cutoff = new Date();
cutoff.setUTCHours(0, 0, 0, 0);
console.log('📅 Using cutoff date for mods:', cutoff.toISOString());

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
  'ar', 'bg', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fr',
  'ga', 'gl', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'ms', 'nb',
  'nl', 'pb', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sq', 'sv', 'th', 'tl', 'tr',
  'uk', 'zh', 'zt'
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
  'bad joke', 'cringe', 'bro why', 'this is cursed', 'forbidden word',
  'not funny', 'who asked', 'kill me now', 'this ain\'t it', 'try harder',
  'that didn\'t land', 'dark humor', 'edgy much', 'cancelled', 'too soon',
  'yeesh', 'ouch', 'bruh moment', 'your humor is broken', 'dude wtf',
  'wtf did i just read', 'how is this a joke', 'zero chill', 'this belongs in the trash',
  'yikes', 'gross', 'tone deaf', 'read the room', 'problematic',
  'racist joke', 'sexist joke', 'offensive joke', 'abusive joke', 'inappropriate joke',
  'harmful joke', 'ableist joke', 'homophobic joke', 'misogynistic joke', 'distasteful joke'
];

const extremeTriggers = [
  'nigger', 'chink', 'gook', 'spic', 'kike', 'sand nigger', 'porch monkey',
  'slant eye', 'wetback', 'beaner', 'camel jockey', 'raghead',
  'towelhead',
  'monkey', 'jungle bunny', 'zipperhead', 'yellow peril', 'coon', 'pickaninny',
  'gas the',
  'heil h',
  's h', 'oven dodger', 'hook nose', 'dirty jew',
  'ashkenazi',
  'faggot', 'dyke', 'tranny',
  'no homo',
  'fudge',
  'shemale',
  'drag ',
  'queer', 'retard',
  'spastic', 'mongoloid',
  'window l',
  'cripple', 'vegetable',
  'bitch',
  'cunt',
  'slut', 'whore',
  'ho',
  'dumb broad', 'make me a sandwich',
  'women can',
  'drive',
  'rape her', 'kill all',
  'rape',
  'rape you',
  'kill all',
  'kill',
  'beat',
  'abuse her',
  'pedophile',
  'pedo',
  'go back to your country',
  'illegal alien', 'white power',
  'white pride',
  'blood and soil',
  'ethnic cleansing',
  'kkk',
  'white lives matter',
  '14 words', '1488',
  'six million wasn’t enough',
  'beta uprising',
  'soy boy',
  'femoid',
  'roastie',
  'rape fuel',
  'gymcel',
  'kill all women',
  'mass shooter',
  'school shooter',

  'fuck you', 'die', 'i hope you die', 'you should die', 'kill all',
  'useless piece of shit', 'waste of air', 'why are you alive', 'die in a fire'
];

async function registerCommands() {
  if (require('fs').existsSync(commandsRegisteredFile)) {
    console.log('Slash commands already registered, skipping...');
    return;
  }

  if (!CLIENT_ID) {
    console.error('CLIENT_ID environment variable is not set. Cannot register commands.');
    return;
  }

  try {
    console.log('Registering slash commands...');
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully.');
    await fs.writeFile(commandsRegisteredFile, 'registered', 'utf8');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

async function fetchModsFromAPI() {
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

    if (DEBUG) {
      console.log('🧪 Full API response:', JSON.stringify(response.data, null, 2));
    }

    return response.data
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
          console.warn(`[SKIP] ${mod.name || 'Unnamed'} has invalid timestamp`);
          return false;
        }

        const modDate = new Date(timestamp * 1000);
        console.log(`🔍 Comparing mod date ${modDate.toISOString()} with cutoff ${cutoff.toISOString()}`);
        return modDate >= cutoff;
      })
      .map(mod => {
        const timestamp = mod.updated_timestamp || mod.created_timestamp;
        return {
          title: mod.name || 'Unnamed Mod',
          url: `https://www.nexusmods.com/${GAME_DOMAIN}/mods/${mod.mod_id}`,
          date: new Date(timestamp * 1000).toISOString(),
          category: mod.category_name || 'Uncategorized',
        };
      });
  } catch (err) {
    console.error('❌ Error fetching mods from API:', err.message);
    return [];
  }
}

async function fetchPersonalModsFromAPI() {
  let mods = [];
  try {
    console.log(`📡 Fetching personal mods for user ${NEXUS_AUTHOR_ID} from Nexus API...`);
    const response = await axios.get(
      `https://api.nexusmods.com/v1/users/${NEXUS_AUTHOR_ID}/mods.json`,
      {
        headers: {
          apikey: process.env.NEXUS_API_KEY,
          Accept: 'application/json',
        },
      }
    );

    if (DEBUG) {
      console.log('🧪 Full personal mods API response:', JSON.stringify(response.data, null, 2));
    }

    mods = Array.isArray(response.data) ? response.data : response.data.mods || [];
    console.log(`ℹ️ Fetched ${mods.length} mods from user endpoint.`);
  } catch (err) {
    console.error('❌ Error fetching personal mods from user endpoint:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });

    // Fallback: Try fetching specific mod (mod_id: 11814)
    try {
      console.log('📡 Attempting fallback: Fetching mod_id 11814...');
      const fallbackResponse = await axios.get(
        `https://api.nexusmods.com/v1/games/${GAME_DOMAIN}/mods/11814.json`,
        {
          headers: {
            apikey: process.env.NEXUS_API_KEY,
            Accept: 'application/json',
          },
        }
      );

      if (DEBUG) {
        console.log('🧪 Fallback mod API response:', JSON.stringify(fallbackResponse.data, null, 2));
      }

      mods = [fallbackResponse.data];
      console.log('✅ Fallback successful: Fetched mod_id 11814.');
    } catch (fallbackErr) {
      console.error('❌ Fallback fetch for mod_id 11814 failed:', {
        message: fallbackErr.message,
        status: fallbackErr.response?.status,
        data: fallbackErr.response?.data,
      });
      return [];
    }
  }

  return mods
    .filter(mod => {
      if (mod.status !== 'published' || !mod.available) {
        console.log(`[SKIP] ${mod.name || 'Unnamed'} is not published or available`);
        return false;
      }

      if (process.env.FILTER_NSFW === 'true' && mod.contains_adult_content) {
        console.log(`[SKIP] ${mod.name || 'Unnamed'} is marked NSFW`);
        return false;
      }

      // Bypass author check for mod_id 11814
      if (mod.mod_id === 11814) {
        console.log(`✅ Including mod_id 11814 (BF Poofies)`);
        return true;
      }

      // Check author using member_id
      const authorId = mod.user?.member_id || mod.user?.user_id;
      if (!authorId || authorId !== parseInt(NEXUS_AUTHOR_ID)) {
        console.log(`[SKIP] ${mod.name || 'Unnamed'} is not authored by user ${NEXUS_AUTHOR_ID} (found ${authorId})`);
        return false;
      }

      const timestamp = mod.updated_timestamp || mod.created_timestamp;
      if (!timestamp || isNaN(timestamp)) {
        console.warn(`[SKIP] ${mod.name || 'Unnamed'} has invalid timestamp`);
        return false;
      }

      const modDate = new Date(timestamp * 1000);
      console.log(`🔍 Comparing personal mod date ${modDate.toISOString()} with cutoff ${cutoff.toISOString()}`);
      return modDate >= cutoff;
    })
    .map(mod => {
      const timestamp = mod.updated_timestamp || mod.created_timestamp;
      return {
        title: mod.name || 'Unnamed Mod',
        url: `https://www.nexusmods.com/${GAME_DOMAIN}/mods/${mod.mod_id}`,
        date: new Date(timestamp * 1000).toISOString(),
        category: mod.category_name || 'Uncategorized',
      };
    });
}

async function sendDiscordNotification(mods, channelId) {
  if (!mods.length) {
    console.log('⚠️ No mods to send');
    return;
  }

  const channel = client.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) {
    console.error(`❌ Channel not found or not a text channel: ${channelId}`);
    return;
  }

  for (const mod of mods) {
    const message = `**🛠️ New Mod Update for Star Wars: Battlefront II**\n` +
                    `**Title**: ${mod.title}\n` +
                    `**Date**: ${mod.date}\n` +
                    `**Category**: ${mod.category}\n` +
                    `**Link**: ${mod.url}`;

    try {
      console.log(`📤 Sending to Discord channel ${channelId}: ${mod.title}`);
      await channel.send({ content: message });
      console.log(`✅ Successfully sent: ${mod.title}`);
    } catch (err) {
      console.error(`❌ Failed to send "${mod.title}" to Discord channel ${channelId}:`, err.message);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

// News scraping functions
const ARTICLES_CACHE_FILE = path.join(dataDir, 'lastest.json');
let articlesCache = { categories: {}, lastResetDate: new Date().toISOString() };
const BASE_URL = 'https://www.starwarsnewsnet.com/category/';
const CATEGORIES = ['star-wars'];
const MAX_RETRIES = 2;
const NAVIGATION_TIMEOUT = 60000;
const PROTOCOL_TIMEOUT = 120000;

async function loadArticlesCache() {
  try {
    const data = await fs.readFile(ARTICLES_CACHE_FILE, 'utf8');
    const cache = JSON.parse(data);
    articlesCache = cache;
    console.log(`📂 Loaded ${ARTICLES_CACHE_FILE} from disk.`);
    return cache;
  } catch (error) {
    console.log(`No ${ARTICLES_CACHE_FILE} found or error loading, using in-memory cache:`, error.message);
    return articlesCache;
  }
}

async function saveArticlesCache(cache) {
  articlesCache = cache;
  try {
    await fs.writeFile(ARTICLES_CACHE_FILE, JSON.stringify(cache, null, 2));
    const stats = await fs.stat(ARTICLES_CACHE_FILE);
    console.log(`💾 Saved ${ARTICLES_CACHE_FILE} to disk (size: ${stats.size} bytes).`);
  } catch (error) {
    console.error(`❌ Error saving ${ARTICLES_CACHE_FILE}, continuing with in-memory cache:`, error.message);
  }
}

async function scrapeArticles(category) {
  let browser;
  let attempt = 1;
  const url = `${BASE_URL}${category}`;

  while (attempt <= MAX_RETRIES) {
    try {
      console.log(`🌐 Launching Puppeteer for ${category} (Attempt ${attempt}/${MAX_RETRIES})...`);
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-features=site-per-process',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--single-process',
        ],
        pipe: true,
        protocolTimeout: PROTOCOL_TIMEOUT,
      });
      console.log('Browser launched successfully.');

      const page = await browser.newPage();
      console.log(`Navigating to ${url}...`);

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36');
      await page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
      await page.setJavaScriptEnabled(false);

      await page.goto(url, { waitUntil: 'domcontentloaded' });
      console.log(`Page loaded successfully for ${category}.`);

      const selector = 'article';
      await page.waitForSelector(selector, { timeout: 20000 }).catch(() => console.log('No articles found, proceeding with available DOM.'));

      await page.screenshot({ path: path.join(dataDir, `debug-${category}.png`) }).catch(err => console.error(`Error saving screenshot for ${category}:`, err));
      const html = await page.content();
      await fs.writeFile(path.join(dataDir, `debug-${category}.html`), html).catch(err => console.error(`Error saving HTML for ${category}:`, err));

      const articles = await page.evaluate(() => {
        const articleElements = Array.from(document.querySelectorAll('article[class*="post"], article[class*="hentry"], article[class*="category"]'));
        const results = [];
        const seenUrls = new Set();

        for (const el of articleElements) {
          const titleElem = el.querySelector('h2.entry-title a');
          const dateElem = el.querySelector('time.entry-date, span.posted-on [datetime]');
          const categoryElems = el.querySelectorAll('a[rel="category tag"]');

          const title = titleElem ? titleElem.textContent.trim() : '';
          let url = titleElem ? titleElem.getAttribute('href') || '' : '';
          if (url && !url.startsWith('http')) {
            url = 'https://www.starwarsnewsnet.com' + (url.startsWith('/') ? url : '/' + url);
          }
          const date = dateElem ? dateElem.getAttribute('datetime') || dateElem.textContent.trim() : 'N/A';
          const categories = Array.from(categoryElems).map(cat => cat.textContent.trim()).filter(c => c);

          if (
            title &&
            url &&
            !seenUrls.has(url) &&
            !title.toLowerCase().includes('read more') &&
            !/^\d{4}-\d{2}-\d{2}$/.test(title) &&
            !/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/.test(title) &&
            url.includes('starwarsnewsnet.com')
          ) {
            seenUrls.add(url);
            results.push({
              title,
              url,
              date,
              categories: categories.length ? categories : ['Uncategorized']
            });
            console.log(`Extracted article: ${title} (${date})`);
          }
        }

        console.log(`Total articles extracted: ${results.length}`);
        return results;
      });

      console.log(`🌐 Scraped ${articles.length} articles from ${category}.`);
      return articles;
    } catch (error) {
      console.error(`❌ Error scraping ${category} (Attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt === MAX_RETRIES) {
        console.error(`Max retries reached for ${category}. Returning empty array.`);
        return [];
      }
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (err) {
          console.error(`Error closing browser for ${category}:`, err);
        }
      }
    }
  }
}

async function sendDiscordWebhookNotification(category, articles) {
  if (!articles.length) {
    console.log(`⚠️ No articles to send for ${category}`);
    return;
  }

  try {
    const sortedArticles = articles.sort((a, b) => {
      const dateA = a.date !== 'N/A' ? Date.parse(a.date) : Infinity;
      const dateB = b.date !== 'N/A' ? Date.parse(b.date) : Infinity;
      return dateA - dateB;
    });

    for (const article of sortedArticles) {
      const message = `**🌟 New Star Wars Article**\n` +
                      `**Title**: ${article.title}\n` +
                      `**Date**: ${article.date !== 'N/A' ? article.date : 'Unknown'}\n` +
                      `**Categories**: ${article.categories.join(', ')}\n` +
                      `**Link**: ${article.url}`;
      await webhookClient.send({
        content: message,
        username: 'Star Wars News Bot',
        avatarURL: 'https://www.starwarsnewsnet.com/wp-content/uploads/2020/01/cropped-swnn-favicon-1.png'
      });
      console.log(`📤 Sent webhook notification for ${category}: ${article.title} (${article.date})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error(`❌ Error sending webhook notification for ${category}:`, error.message);
  }
}

async function checkForNewArticles() {
  console.log('🔎 Checking for new Star Wars news updates...');
  const cache = await loadArticlesCache();
  if (!cache.categories) cache.categories = {};

  for (const category of CATEGORIES) {
    console.log(`🌐 Checking category: ${category}`);
    try {
      const cachedUrls = new Set((cache.categories[category] || []).map(article => article.url));
      const newArticles = await scrapeArticles(category);

      const updates = newArticles.filter(article => !cachedUrls.has(article.url));

      if (updates.length > 0) {
        console.log(`✅ Found ${updates.length} new articles in ${category}:`);
        updates.forEach(article => console.log(`→ ${article.title} (${article.date})`));

        await sendDiscordWebhookNotification(category, updates);

        cache.categories[category] = [...newArticles, ...(cache.categories[category] || [])].slice(0, 100);
        await saveArticlesCache(cache);
      } else {
        console.log(`ℹ️ No new articles found in ${category}.`);
      }
    } catch (error) {
      console.error(`❌ Error processing category ${category}:`, error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  cache.lastResetDate = new Date().toISOString();
  await saveArticlesCache(cache);
}

async function checkForNewMods() {
  console.log('🔎 Checking for new mods...');
  try {
    // General mods (API)
    const apiMods = await fetchModsFromAPI();
    const apiSeen = new Set(globalCache.mods.map(m => m.url));
    const newApiMods = apiMods.filter(mod => !apiSeen.has(mod.url)).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (newApiMods.length) {
      console.log(`✅ Found ${newApiMods.length} new API mods.`);
      newApiMods.forEach(mod => console.log(`→ ${mod.title} (${mod.date})`));
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
      console.log('ℹ️ No new API mods found.');
    }

    // Personal mods (API)
    const personalMods = await fetchPersonalModsFromAPI();
    const personalSeen = new Set(personalCache.mods.map(m => m.url));
    const allSeen = new Set([...globalCache.mods.map(m => m.url), ...personalCache.mods.map(m => m.url)]);
    const newPersonalMods = personalMods.filter(mod => !allSeen.has(mod.url)).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (newPersonalMods.length) {
      console.log(`✅ Found ${newPersonalMods.length} new personal mods.`);
      newPersonalMods.forEach(mod => console.log(`→ ${mod.title} (${mod.date})`));
      await sendDiscordNotification(newPersonalMods, PERSONAL_NEXUS_CHANNEL_ID);
      newPersonalMods.forEach(newMod => {
        let inserted = false;
        for (let i = 0; i < personalCache.mods.length; i++) {
          if (new Date(newMod.date) < new Date(personalCache.mods[i].date)) {
            personalCache.mods.splice(i, 0, newMod);
            inserted = true;
            break;
          }
        }
        if (!inserted) personalCache.mods.push(newMod);
      });
      personalCache.mods = personalCache.mods.slice(0, 1000);
      personalCache.lastResetDate = new Date().toISOString();
      await savePersonalModCache();
    } else {
      console.log('ℹ️ No new personal mods found.');
    }
  } catch (err) {
    console.error('❌ Error in mod check:', err.message);
  }
}

client.once('ready', async () => {
  try {
    console.log(`✅ Bot logged in as ${client.user.tag}`);

    await loadUsers();
    await loadModCache();
    await loadPersonalModCache();
    await loadArticlesCache();

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
        console.log('✅ Found existing message:', messageId);
        if (message.embeds.length === 0 || message.embeds[0].title !== embed.data.title) {
          console.log('Existing message is not the expected embed, creating new one');
          message = null;
        }
      } catch (error) {
        console.error('❌ Error fetching message:', error.message);
      }
    } else {
      console.log('No message ID provided in environment variables');
    }

    if (!message) {
      try {
        message = await channel.send({ embeds: [embed] });
        console.log(`✅ New message posted with ID: ${message.id}`);
        console.log('Please update REACTION_ROLE_MESSAGE_ID in Render environment variables with:', message.id);
        for (const emojiId of Object.keys(roleMapping)) {
          await message.react(emojiId).catch(console.error);
        }
      } catch (error) {
        console.error('❌ Error posting new embed:', error.message);
      }
    }

    console.log('🔎 Performing initial checks...');
    try {
      // Initial mod check
      const initialApiMods = await fetchModsFromAPI().then(mods => mods.sort((a, b) => new Date(a.date) - new Date(b.date)));
      const apiSeen = new Set(globalCache.mods.map(m => m.url));
      const newInitialApiMods = initialApiMods.filter(mod => !apiSeen.has(mod.url));
      console.log(`✅ Found ${newInitialApiMods.length} new initial API mods to process.`);
      if (newInitialApiMods.length) {
        console.log(`✅ Found ${newInitialApiMods.length} new initial API mods.`);
        newInitialApiMods.forEach(mod => console.log(`→ ${mod.title} (${mod.date})`));
        try {
          await sendDiscordNotification(newInitialApiMods, MOD_UPDATER_CHANNEL_ID);
        } catch (err) {
          console.error('❌ Error sending initial API mod notifications:', err.message);
        }
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
        console.log('ℹ️ No new initial API mods found.');
      }

      const initialPersonalMods = await fetchPersonalModsFromAPI().then(mods => mods.sort((a, b) => new Date(a.date) - new Date(b.date)));
      const personalSeen = new Set(personalCache.mods.map(m => m.url));
      const allSeen = new Set([...globalCache.mods.map(m => m.url), ...personalCache.mods.map(m => m.url)]);
      const newInitialPersonalMods = initialPersonalMods.filter(mod => !allSeen.has(mod.url));
      console.log(`✅ Found ${newInitialPersonalMods.length} new initial personal mods to process.`);
      if (newInitialPersonalMods.length) {
        console.log(`✅ Found ${newInitialPersonalMods.length} new initial personal mods.`);
        newInitialPersonalMods.forEach(mod => console.log(`→ ${mod.title} (${mod.date})`));
        try {
          await sendDiscordNotification(newInitialPersonalMods, PERSONAL_NEXUS_CHANNEL_ID);
        } catch (err) {
          console.error('❌ Error sending initial personal mod notifications:', err.message);
        }
        newInitialPersonalMods.forEach(newMod => {
          let inserted = false;
          for (let i = 0; i < personalCache.mods.length; i++) {
            if (new Date(newMod.date) < new Date(personalCache.mods[i].date)) {
              personalCache.mods.splice(i, 0, newMod);
              inserted = true;
            }
          }
          if (!inserted) personalCache.mods.push(newMod);
        });
        personalCache.mods = personalCache.mods.slice(0, 1000);
        personalCache.lastResetDate = new Date().toISOString();
        await savePersonalModCache();
      } else {
        console.log('ℹ️ No new initial personal mods found.');
      }

      // Initial articles check
      await checkForNewArticles();
    } catch (err) {
      console.error('❌ Error during initial checks:', err.message);
    }

    // Start polling loops
    setInterval(checkForNewMods, 10 * 60 * 1000); // Every 10 minutes
    setInterval(checkForNewArticles, 30 * 60 * 1000); // Every 30 minutes
  } catch (err) {
    console.error('❌ Fatal error in ready event:', err);
    process.exit(1);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  if (extremeTriggers.some(trigger => content.includes(trigger))) {
    try {
      const channel = message.channel;
      const gifPath = './media/ashamed.gif';

      await message.delete();

      const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
      if (modChannel && modChannel.isTextBased()) {
        await modChannel.send({
          content: `🚨 **EXTREME CONTENT DETECTED**\n` +
                   `**User:** <@${message.author.id}>\n` +
                   `**Message Deleted**\n` +
                   `**Channel:** <#${channel.id}>`
        });
      }

      if (require('fs').existsSync(gifPath)) {
        const gifFile = new AttachmentBuilder(gifPath);
        await channel.send({
          content: `⚠️ Inappropriate content detected. A moderator has been notified.`,
          files: [gifFile]
        });
      } else {
        console.error('❌ GIF file missing at:', gifPath);
      }
    } catch (err) {
      console.error('❌ Failed to handle extreme content:', err);
    }
    return;
  }

  if (targetChannels.includes(message.channel.id)) {
    if (triggers.some(trigger => content.includes(trigger))) {
      const filePath = './audio/cringe.mp3';

      if (require('fs').existsSync(filePath)) {
        const audioFile = new AttachmentBuilder(filePath);
        await message.channel.send({
          content: '🔊 Cringe detected!',
          files: [audioFile]
        });

        try {
          const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
          if (modChannel && modChannel.isTextBased()) {
            await modChannel.send({
              content: `⚠️ **Trigger detected in <#${message.channel.id}>**\n` +
                       `**User:** <@${message.author.id}>\n` +
                       `**Message:** "${message.content}"`
            });
          }
        } catch (err) {
          console.error('❌ Failed to send mod alert:', err);
        }
      } else {
        console.error('❌ Audio file missing at:', filePath);
      }
    }
  }

  if (message.content.startsWith('!setlang ')) {
    const parts = message.content.trim().split(' ');
    const lang = parts[1]?.toLowerCase();

    if (!supportedLanguages.includes(lang)) {
      return message.reply('❗ Invalid language code. Allowed: ' + supportedLanguages.join(', '));
    }

    users[message.author.id] = lang;
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf8');
    return message.reply(`✅ Your preferred translation language is now set to **${lang}**.`);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setlanguage') {
      await interaction.deferReply();
      const lang = interaction.options.getString('language').toLowerCase();

      if (!supportedLanguages.includes(lang)) {
        await interaction.editReply('❗ Invalid language code. Allowed: ' + supportedLanguages.join(', '));
        return;
      }

      users[interaction.user.id] = lang;
      await fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf8');
      await interaction.editReply(`✅ Your preferred translation language is now set to **${lang}**.`);
    }

    if (interaction.commandName === 'translate') {
      await interaction.deferReply();
      const text = interaction.options.getString('text');
      let targetLang = (interaction.options.getString('language') || users[interaction.user.id] || 'en').toLowerCase();

      if (!supportedLanguages.includes(targetLang)) {
        await interaction.editReply('❗ Invalid target language code. Allowed: ' + supportedLanguages.join(', '));
        return;
      }

      try {
        console.log(`🔍 Detecting language for text: ${text}`);
        const detectRes = await axios.post(`${LIBRETRANSLATE_URL}/detect`, { q: text });
        const detectedLang = detectRes.data?.[0]?.language || 'unknown';

        if (!supportedLanguages.includes(detectedLang)) {
          await interaction.editReply('❗ Detected language not supported: ' + detectedLang);
          return;
        }

        console.log(`🌍 Translating from ${detectedLang} to ${targetLang}`);
        const transRes = await axios.post(`${LIBRETRANSLATE_URL}/translate`, {
          q: text,
          source: detectedLang,
          target: targetLang,
          format: 'text'
        });

        const translated = transRes.data.translatedText;
        await interaction.editReply({
          content: `🌍 **Translated from \`${detectedLang}\` to \`${targetLang}\`:**\n> ${translated}`
        });
      } catch (err) {
        console.error('Translation error details:', {
          message: err.message,
          response: err.response ? {
            status: err.response.status,
            data: err.response.data
          } : 'No response',
          request: err.request ? err.request : 'No request'
        });
        await interaction.editReply('❌ Error translating text. Please try again later.');
      }
    }
  }

  if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate_message') {
    await interaction.deferReply();
    const message = interaction.targetMessage;
    const targetLang = users[interaction.user.id] || 'en';

    if (!supportedLanguages.includes(targetLang)) {
      await interaction.editReply('❗ Invalid target language code. Allowed: ' + supportedLanguages.join(', '));
      return;
    }

    try {
      const detectRes = await axios.post(`${LIBRETRANSLATE_URL}/detect`, { q: message.content });
      const detectedLang = detectRes.data?.[0]?.language;

      if (!detectedLang) {
        await interaction.editReply('❗ No language detected for the message.');
        return;
      }

      if (!supportedLanguages.includes(detectedLang)) {
        console.error(`❗ Detected language not supported: ${detectedLang}`);
        await interaction.editReply(`❗ Detected language not supported: ${detectedLang}`);
        return;
      }

      if (detectedLang === targetLang) {
        await interaction.editReply({
          content: `🌍 This message is already in \`${targetLang}\`.`,
          ephemeral: true
        });
        return;
      }

      const transRes = await axios.post(`${LIBRETRANSLATE_URL}/translate`, {
        q: message.content,
        source: detectedLang,
        target: targetLang,
        format: 'text'
      });

      const translated = transRes.data.translatedText;
      await interaction.editReply({
        content: `🌍 **Translated from \`${detectedLang}\` to \`${targetLang}\`:**\n> ${translated}`
      });
    } catch (err) {
      console.error('Translation error details:', {
        message: err.message,
        response: err.response ? {
          status: err.response.status,
          data: err.response.data
        } : 'No response',
        request: err.request ? err.request : 'No request'
      });
      await interaction.editReply('❌ Error translating message. Please try again later.');
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.message.partial) await reaction.message.fetch();
  if (reaction.partial) await reaction.fetch();

  if (user.bot || reaction.message.channel.id !== WELCOME_CHANNEL_ID) {
    console.log(`ℹ️ Ignoring reaction: Bot=${user.bot}, Channel=${reaction.message.channel.id}`);
    return;
  }

  const messageId = process.env[MESSAGE_ID_KEY];
  if (!messageId || reaction.message.id !== messageId) {
    console.log(`ℹ️ Ignoring reaction: Message ID ${reaction.message.id} does not match expected ${messageId}`);
    return;
  }

  const emojiId = reaction.emoji.id;
  console.log(`✅ Reaction added by ${user.tag}: Emoji ID ${emojiId}`);
  if (!emojiId || !Object.keys(roleMapping).includes(emojiId)) {
    console.log(`⚠️ No role found for emoji ID ${emojiId}`);
    return;
  }

  const roleId = roleMapping[emojiId];
  let member;
  try {
    member = await reaction.message.guild.members.fetch(user.id);
  } catch (error) {
    console.error(`❌ Error fetching member ${user.id}:`, error.message);
    return;
  }
  if (!member) {
    console.error(`⚠️ Member ${user.id} not found`);
    return;
  }

  try {
    for (const eId of Object.keys(roleMapping)) {
      if (roleMapping[eId] !== roleId && member.roles.cache.has(roleMapping[eId])) {
        await member.roles.remove(roleMapping[eId]);
        console.log(`✅ Removed role ${roleMapping[eId]} from ${user.tag}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error removing other roles from ${user.tag}:`, error.message);
    return;
  }

  try {
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId);
      console.log(`✅ Added role ${roleId} to ${user.tag}`);
    } else {
      console.log(`${user.tag} already has role ${roleId}`);
    }
  } catch (error) {
    console.error(`❌ Error adding role ${roleId} to ${user.tag}:`, error.message);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (reaction.message.partial) await reaction.message.fetch();
  if (reaction.partial) await reaction.fetch();

  if (user.bot || reaction.message.channel.id !== WELCOME_CHANNEL_ID) {
    console.log(`ℹ️ Ignoring reaction removal: Bot=${user.bot}, Channel=${reaction.message.channel.id}`);
    return;
  }

  const messageId = process.env[MESSAGE_ID_KEY];
  if (!messageId || reaction.message.id !== messageId) {
    console.log(`ℹ️ Ignoring reaction removal: Message ID ${reaction.message.id} does not match expected ${messageId}`);
    return;
  }

  const emojiId = reaction.emoji.id;
  console.log(`✅ Reaction removed by ${user.tag}: Emoji ID ${emojiId}`);
  if (!emojiId || !Object.keys(roleMapping).includes(emojiId)) {
    console.log(`⚠️ No role found for emoji ID ${emojiId}`);
    return;
  }

  const roleId = roleMapping[emojiId];
  let member;
  try {
    member = await reaction.message.guild.members.fetch(user.id);
  } catch (error) {
    console.error(`❌ Error fetching member ${user.id}:`, error.message);
    return;
  }
  if (!member) {
    console.error(`⚠️ Member ${user.id} not found`);
    return;
  }

  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      console.log(`✅ Removed role ${roleId} from ${user.tag}`);
    } else {
      console.log(`${user.tag} does not have role ${roleId}`);
    }
  } catch (error) {
    console.error(`❌ Error removing role ${roleId} from ${user.tag}:`, error.message);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

client.login(DISCORD_TOKEN);
