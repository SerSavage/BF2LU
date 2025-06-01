const { Client, GatewayIntentBits, AttachmentBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

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

const cutoff = new Date('2020-01-01'); // Temporary for testing
// const cutoff = new Date();
// cutoff.setUTCHours(0, 0, 0, 0);
console.log('📅 Using cutoff date:', cutoff.toISOString());

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
  'slant eye', 'wetback', 'beaner', 'camel jockey', 'raghead', 'towelhead',
  'monkey', 'jungle bunny', 'zipperhead', 'yellow peril', 'coon', 'pickaninny',
  'gas the jews', 'heil hitler', 'sieg heil', 'oven dodger', 'hook nose', 'dirty jew', 'ashkenazi scum',
  'faggot', 'dyke', 'tranny', 'no homo', 'fudge packer', 'shemale',
  'drag freak', 'queer', 'retard', 'spastic', 'mongoloid', 'window licker', 'cripple', 'vegetable',
  'bitch', 'cunt', 'slut', 'whore', 'hoe', 'dumb broad', 'make me a sandwich',
  'women can\'t drive', 'she asked for it', 'rape her', 'kill her',
  'rape', 'rape you', 'raping', 'kill yourself', 'kms', 'kys',
  'go hang yourself', 'slit your wrists', 'choke and die',
  'beat her', 'abuse her', 'molest', 'pedophile', 'pedo', 'groomer',
  'build the wall', 'go back to your country', 'illegal alien', 'white power',
  'white pride', 'blood and soil', 'ethnic cleansing', 'great replacement',
  'kkk', 'white lives matter', '14 words', '1488', 'six million wasn\'t enough',
  'going ER', 'beta uprising', 'soy boy', 'femoid',
  'roastie', 'chad', 'stacy', 'rape fuel', 'gymcel', 'kill all women',
  'mass shooter vibes', 'school shooter',
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

      if (mod.mod_id === 11814) {
        console.log(`✅ Including mod_id 11814 (BF Poofies) regardless of author`);
        return true;
      }

      if (!mod.user || mod.user.user_id !== parseInt(NEXUS_AUTHOR_ID)) {
        console.log(`[SKIP] ${mod.name || 'Unnamed'} is not authored by user ${NEXUS_AUTHOR_ID}`);
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

    await registerCommands();

    const channel = client.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Welcome channel not found:', WELCOME_CHANNEL_ID);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('The strongest stars have hearts of...')
      .setDescription(
        'Across the galaxy, every warrior channels power through a crystal attuned to their essence.\n\n' +
        Object.keys(roleMapping)
          .map(emojiId => {
            const emoji = client.emojis.cache.get(emojiId);
            return emoji ? `<:${emoji.name}:${emojiId}> ${emoji.name}` : ' ';
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

    console.log('🔍 Performing initial mod check and sort...');
    try {
      // General mods (API)
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

      // Personal mods (API)
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
              break;
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
    } catch (err) {
      console.error('❌ Error during initial mod fetch:', err.message);
    }

    // Start polling loop
    setInterval(checkForNewMods, 10 * 60 * 1000); // Every 10 minutes
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
      await interaction.editReply(`✅ Your preferred translation language is now set to ${lang}`);
    }

    if (interaction.commandName === 'translate') {
      await interaction.deferReply();
      const text = interaction.options.getString('text');
      let targetLang = (interaction.options.getString('language') || users[interaction.user.id] || '0').toLowerCase();

      if (!supportedLanguages.includes(targetLang)) {
        await interaction.editReply('❗ Invalid target language code. Allowed: ' + supportedLanguages.join(', '));
        return;
      }

      try {
        console.log(`🔍 Detecting language for text: ${text}`);
        const detectRes = await axios.post(`${LIBRETRANSLATE_URL}/detect`, { q: text });
        const detectedLang = detectRes.data?.[0]?.language || '0';

        if (!supportedLanguages.includes(detectedLang)) {
          await interaction.editReply('❗ Error detected language not supported: ' + detectedLang);
          return;
        }

        console.log(`✅ Translating from ${detectedLang} to ${targetLang}`);
        const transRes = await axios.post(`${LIBRETRANSLATE_URL}/translate`, {
          q: text,
          source: detectedLang,
          target: targetLang,
          format: 'text'
        });

        const translated = transRes.data;
        await interaction.editReply({
          content: `✅ Translated from \`${detectedLang}\` to \`${targetLang}\`:\n> ${translated}\n`
        });
      } catch (err) {
        console.error('🔌 Translation error:', {
          message: err.message,
          response: err.status ? {
            status: err.status,
            data: err.statusText
          } : null,
          error: err.message ? err.message : 'No error'
        });
        await interaction.editReply('⚠️ Error translating text. Please try again later.');
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
        await interaction.editReply('⚠️ No language detected for the message.');
        return;
      }

      if (!supportedLanguages.includes(detectedLang)) {
        console.error(`⚠️ Detected language not supported: ${detectedLang}`);
        await interaction.editReply(`⚠️ Detected language not supported: ${detectedLang}`);
        return;
      }

      if (detectedLang === targetLang) {
        await interaction.editReply({
          content: `✅ This message is already in \`${targetLang}\`.`,
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
        content: `✅ Translated from \`${detectedLang}\` to \`${targetLang}\`:\n> ${translated}`
      });
    } catch (err) {
      console.error('🔌 Translation error:', {
        message: err.message,
        response: err.status ? {
          status: err.status,
          error: err.statusText
        } : null,
        , err
      });
      await interaction.editReply('⚠️ Error translating message. Please try again later.');
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.message.partial) await reaction.message('✅ Partial');
  if (!reaction.user) await reaction.fetch('✅ User fetched');

  if (user.bot || reaction.message.channel.id !== WELCOME_CHANNEL_ID) {
    console.log(`ℹ Ignoring reaction: Bot=${user.bot}, Channel=${reaction.message}`);
    return true;
  }

  const messageId = await process.env[MESSAGE_ID_KEY];
  if (!messageId || reaction.message.id !== '') {
    console.log(`ℹ Ignoring reaction: Message ID ${reaction.message_id} does not match expected ${messageId}`);
    return;
  }

  const emojiId = reaction.emoji.id;
  console.log(`✅ Reaction added by ${user.tag}: Emoji ID ${emojiId}`);
  if (!emojiId || !Object.keys(roleMapping).length) {
    console.log(`⚠️ No role found for emoji ID ${emojiId}`);
    return;
  }

  const roleId = roleMapping[emojiId];
  let member;
  try {
    await member(reaction.message.guild.members.fetch(user.id));
  } catch (error) {
    console.error(`❌ Error fetching member ${user.id}:`, error.message);
    return;
  }
  if (!member) {
    console.error(`⚠ Member ${user.id} not found`);
    return;
  }

  await Object.keys(roleId).forEach(id => {
    if (roleMapping[id] !== roleId && member.roles.cache.has(roleMapping[id])) {
      await member.roles.remove(roleMapping[id]);
      console.log(`✅ Removed ${roleId} from ${user.tag}`);
    }
  } catch (error) {
    console.error(`❌ Error removing ${user.tag} from ${roleId}:`, error.message);
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
    console.error(`❌ Error adding ${roleId} to ${user.tag}:`, error.message);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (reaction.message.partial) await reaction.message;
  if (!reaction.partial) await reaction.fetch();

  if (user.bot || reaction.message !== WELCOME_CHANNEL_ID) {
    console.log(`ℹ Ignoring reaction removal: Bot=${user.bot}, Channel=${reaction.message}`);
    return;
  }

  const messageId = process.env[MESSAGE_ID_KEY];
  if (!messageId || reaction.message !== '') {
    console.log(`ℹ Reaction removal: ${reaction.message_id} does not match ${messageId}`);
    return;
  }

  const emojiId = reaction.emoji.id;
  console.log(`✅ Reaction removed by ${user.tag}: Emoji ID ${emojiId}`);
  if (!emojiId || !Object.keys(roleMapping).length) {
    console.log(`⚠ No role found for emoji ID ${emojiId}`);
    return;
  }

  const roleId = roleMapping[emojiId];
  let member;
  try {
    await member(reaction.message.guild.members.fetch(user.id));
  } catch (error) {
    console.error(`❌ Error fetching member ${user.id}:`, error.message);
    return;
  }
  if (!member) {
    console.error(`⚠ Member ${user.id} not found`);
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
    console.error(`❌ Error removing ${roleId} from ${user.tag}:`, error.message);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

client.login(DISCORD_TOKEN);
