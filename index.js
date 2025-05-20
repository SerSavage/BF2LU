const { Client, GatewayIntentBits, AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const schedule = require('node-schedule');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildIntegrations
  ]
});

// Target channel IDs for moderation
const targetChannels = [
  '1361838672818995312',
  '1366888045164499097',
  '1362441078908784793',
  '1366886810885689456',
  '1366887040498663634',
  '1364277004198875278'
];

// Moderation and bump channel IDs
const MOD_CHANNEL_ID = '1362988156546449598';
const BUMP_CHANNEL_ID = '1361848627789828148';
const GOOGLE_DRIVE_CHANNEL_ID = process.env.GOOGLE_DRIVE_CHANNEL_ID;
const GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/u/2/folders/139urJMaf1NgqQb6CgrnPrqEDZT0DoE0b';

// Moderation triggers
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
  'gas the jews', 'heil hitler', 'sieg heil', 'kike', 'zionist pig',
  'oven dodger', 'hook nose', 'dirty jew', 'ashkenazi scum',
  'faggot', 'dyke', 'tranny', 'no homo', 'fudge packer', 'shemale',
  'drag freak', 'queer in a slur context', 'you’re not a real woman', 'man in a dress',
  'retard', 'spastic', 'mongoloid', 'window licker', 'cripple', 'vegetable',
  'dumbass in a targeted way', 'deaf and dumb',
  'bitch', 'cunt', 'slut', 'whore', 'hoe', 'dumb broad', 'make me a sandwich',
  'women can’t drive', 'she asked for it', 'rape her', 'kill her',
  'rape', 'rape you', 'raping', 'kill yourself', 'kms', 'kys',
  'go hang yourself', 'slit your wrists', 'choke and die',
  'beat her', 'abuse her', 'molest', 'pedophile', 'pedo', 'groomer',
  'build the wall', 'go back to your country', 'illegal alien', 'white power',
  'white pride', 'blood and soil', 'ethnic cleansing', 'great replacement',
  'kkk', 'white lives matter', '14 words', '1488', 'six million wasn’t enough',
  'going ER', 'ellen page is a man', 'beta uprising', 'soy boy', 'femoid',
  'roastie', 'chad', 'stacy', 'rape fuel', 'gymcel', 'kill all women',
  'mass shooter vibes', 'school shooter',
  'fuck you', 'die', 'i hope you die', 'you should die', 'kill all [group]',
  'useless piece of shit', 'waste of air', 'why are you alive', 'die in a fire'
];

// --- Translation Setup ---
const LANGUAGE_FILE = './languagePreferences.json';
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'ja': 'Japanese',
  'zh': 'Chinese',
  'ru': 'Russian',
  'pt': 'Portuguese',
  'it': 'Italian',
  'ko': 'Korean'
};

// Load or initialize language preferences
let languagePreferences = {};
if (fs.existsSync(LANGUAGE_FILE)) {
  languagePreferences = JSON.parse(fs.readFileSync(LANGUAGE_FILE));
} else {
  fs.writeFileSync(LANGUAGE_FILE, JSON.stringify({}));
}

// Save language preferences
function saveLanguagePreferences() {
  fs.writeFileSync(LANGUAGE_FILE, JSON.stringify(languagePreferences, null, 2));
}

// Translate text using LibreTranslate
async function translateText(text, targetLang, sourceLang = 'auto') {
  try {
    const response = await axios.post('https://translate.argosopentech.com/translate', {
      q: text,
      source: sourceLang,
      target: targetLang
    });
    return response.data.translatedText;
  } catch (error) {
    console.error('Translation error:', error.response?.data || error.message);
    throw new Error('Failed to translate text');
  }
}

// --- Google Drive Setup ---
const auth = new google.auth.GoogleAuth({
  credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : undefined,
  keyFile: process.env.GOOGLE_CREDENTIALS ? undefined : './credentials.json',
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// Function to watch a Google Drive folder
async function watchFolder(folderId) {
  try {
    if (!process.env.WEBHOOK_URL || !process.env.WEBHOOK_URL.startsWith('https://')) {
      throw new Error('WEBHOOK_URL must be a valid HTTPS URL');
    }
    const res = await drive.files.watch({
      fileId: folderId,
      requestBody: {
        kind: 'api#channel',
        id: `channel-${Date.now()}`,
        type: 'web_hook',
        address: process.env.WEBHOOK_URL,
      },
    });
    console.log('Watching folder:', res.data);
    return res.data;
  } catch (error) {
    console.error('Error setting up watch:', error);
    throw error;
  }
}

// Schedule watch renewal every 6 days
schedule.scheduleJob('0 0 */6 * *', async () => {
  console.log('Renewing Google Drive watch subscription');
  try {
    await watchFolder(process.env.GOOGLE_DRIVE_FOLDER_ID);
    console.log(`Successfully renewed watch for folder ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);
  } catch (error) {
    console.error('Failed to renew watch:', error);
  }
});

// Webhook endpoint for Google Drive notifications
app.post('/notify', async (req, res) => {
  try {
    const fileId = req.body.resourceId?.id;
    if (!fileId) return res.status(400).send('Invalid notification');

    const file = await drive.files.get({
      fileId,
      fields: 'id,name,webViewLink,permissions',
    });

    if (file.data.webViewLink) {
      const channel = client.channels.cache.get(GOOGLE_DRIVE_CHANNEL_ID);
      if (channel && channel.isTextBased()) {
        await channel.send(
          `📢 **New Update for WIP has arrived - Check it out!**\n` +
          `**File:** ${file.data.name}\n` +
          `**Link:** ${file.data.webViewLink}`
        );
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error');
  }
});

// Start Express server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});

// --- Bot Logic ---
client.on('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  console.log('Guilds the bot is in:', client.guilds.cache.map(guild => `${guild.name} (${guild.id})`));
  const guild = client.guilds.cache.get('1361838672265089225');
  if (!guild) {
    console.error('Guild not found. Ensure the bot is in the server and the GUILD_ID is correct.');
    return;
  }

  // Slash commands
  const echoCommand = new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Echo a message to a specified channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send the message to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to echo')
        .setRequired(true)
    );

  const translateCommand = new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate a message to a target language')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('The text to translate')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('language')
        .setDescription('Target language code (e.g., es for Spanish)')
        .setRequired(true)
        .addChoices(
          { name: 'English', value: 'en' },
          { name: 'Spanish', value: 'es' },
          { name: 'French', value: 'fr' },
          { name: 'German', value: 'de' },
          { name: 'Japanese', value: 'ja' },
          { name: 'Chinese', value: 'zh' },
          { name: 'Russian', value: 'ru' },
          { name: 'Portuguese', value: 'pt' },
          { name: 'Italian', value: 'it' },
          { name: 'Korean', value: 'ko' }
        )
    );

  const setLanguageCommand = new SlashCommandBuilder()
    .setName('setlanguage')
    .setDescription('Set your preferred language')
    .addStringOption(option =>
      option.setName('language')
        .setDescription('Preferred language code (e.g., es for Spanish)')
        .setRequired(true)
        .addChoices(
          { name: 'English', value: 'en' },
          { name: 'Spanish', value: 'es' },
          { name: 'French', value: 'fr' },
          { name: 'German', value: 'de' },
          { name: 'Japanese', value: 'ja' },
          { name: 'Chinese', value: 'zh' },
          { name: 'Russian', value: 'ru' },
          { name: 'Portuguese', value: 'pt' },
          { name: 'Italian', value: 'it' },
          { name: 'Korean', value: 'ko' }
        )
    );

  try {
    await guild.commands.set([]);
    console.log(`Cleared existing guild commands in guild ${guild.id}`);
    await client.application.commands.set([]);
    console.log('Cleared existing global commands');
    await guild.commands.create(echoCommand);
    await guild.commands.create(translateCommand);
    await guild.commands.create(setLanguageCommand);
    console.log(`Registered /echo, /translate, and /setlanguage slash commands in guild ${guild.id}`);
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }

  // Start bump reminder every 2 hours
  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
      if (channel && channel.isTextBased()) {
        await channel.send('Hey, it’s time to bump the server! Use /bump to keep us visible! 📣');
        console.log(`Sent bump reminder to channel ${BUMP_CHANNEL_ID} at ${new Date().toLocaleString()}`);
      } else {
        console.error(`Channel ${BUMP_CHANNEL_ID} not found or not text-based`);
      }
    } catch (err) {
      console.error('Failed to send bump reminder:', err);
    }
  }, 2 * 60 * 60 * 1000);

  // Start watching Google Drive folder
  try {
    await watchFolder(process.env.GOOGLE_DRIVE_FOLDER_ID);
    console.log(`Started watching Google Drive folder ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);
  } catch (error) {
    console.error('Failed to start watching Google Drive folder:', error);
  }
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'echo') {
    const channel = options.getChannel('channel');
    const message = options.getString('message');
    try {
      if (channel.isTextBased()) {
        await channel.send(message);
        await interaction.reply({ content: `Message sent to ${channel}!`, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Please select a text channel.', ephemeral: true });
      }
    } catch (error) {
      console.error('Error handling /echo:', error);
      await interaction.reply({ content: 'Failed to send message.', ephemeral: true });
    }
  } else if (commandName === 'translate') {
    const text = options.getString('text');
    const targetLang = options.getString('language');
    try {
      const translatedText = await translateText(text, targetLang);
      await interaction.reply(`**Original:** ${text}\n**Translated (${SUPPORTED_LANGUAGES[targetLang]}):** ${translatedText}`);
    } catch (error) {
      await interaction.reply({ content: 'Failed to translate text.', ephemeral: true });
    }
  } else if (commandName === 'setlanguage') {
    const language = options.getString('language');
    languagePreferences[interaction.user.id] = language;
    saveLanguagePreferences();
    await interaction.reply(`Preferred language set to ${SUPPORTED_LANGUAGES[language]}.`);
  }
});

// Auto-translate messages and handle moderation
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Moderation logic
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

      if (fs.existsSync(gifPath)) {
        const gifFile = new AttachmentBuilder(gifPath);
        await channel.send({
          content: `⚠️ Inappropriate content detected. A moderator has been notified.`,
          files: [gifFile]
        });
      } else {
        console.error("GIF file missing at:", gifPath);
      }
    } catch (err) {
      console.error('Failed to handle extreme content:', err);
    }
    return;
  }

  if (targetChannels.includes(message.channel.id)) {
    if (triggers.some(trigger => content.includes(trigger))) {
      const filePath = './audio/cringe.mp3';
      if (fs.existsSync(filePath)) {
        const audioFile = new AttachmentBuilder(filePath);
        await message.channel.send({
          content: `🔊 Cringe detected!`,
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
          console.error('Failed to send mod alert:', err);
        }
      } else {
        console.error("Audio file missing at:", filePath);
      }
    }
  }

  // Auto-translate for users with preferences
  const userLang = languagePreferences[message.author.id];
  if (userLang && userLang !== 'en') {
    try {
      const translatedText = await translateText(message.content, userLang);
      await message.reply(`**Translated (${SUPPORTED_LANGUAGES[userLang]}):** ${translatedText}`);
    } catch (error) {
      console.error('Auto-translation error:', error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
