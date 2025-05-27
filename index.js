const { Client, GatewayIntentBits, AttachmentBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Initialize users from users.json
let users = {};
try {
  const usersData = fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8');
  users = JSON.parse(usersData);
} catch (err) {
  console.warn('users.json not found or invalid, starting with empty users object:', err.message);
  fs.writeFileSync(path.join(__dirname, 'users.json'), '{}', 'utf8');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://translationlib.onrender.com';
const CLIENT_ID = process.env.CLIENT_ID;

// Supported languages
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

const MOD_CHANNEL_ID = '1362988156546449598';

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

// Register slash commands
const commands = require('./commands.json');
const commandsRegisteredFile = path.join(__dirname, 'commands_registered.txt');

async function registerCommands() {
  if (fs.existsSync(commandsRegisteredFile)) {
    console.log('Slash commands already registered, skipping...');
    return;
  }

  if (!CLIENT_ID) {
    console.error('CLIENT_ID environment variable is not set. Cannot register commands.');
    return;
  }

  try {
    console.log('Registering slash commands...');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully.');
    fs.writeFileSync(commandsRegisteredFile, 'registered', 'utf8');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Check for extreme content
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

  // Moderation logic
  if (targetChannels.includes(message.channel.id)) {
    if (triggers.some(trigger => content.includes(trigger))) {
      const filePath = './audio/cringe.mp3';

      if (fs.existsSync(filePath)) {
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
          console.error('Failed to send mod alert:', err);
        }
      } else {
        console.error('Audio file missing at:', filePath);
      }
    }
  }

  // Set language command
  if (message.content.startsWith('!setlang ')) {
    const parts = message.content.trim().split(' ');
    const lang = parts[1]?.toLowerCase();

    if (!supportedLanguages.includes(lang)) {
      return message.reply('❗ Invalid language code. Allowed: ' + supportedLanguages.join(', '));
    }

    users[message.author.id] = lang;
    fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(users, null, 2), 'utf8');
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
      fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(users, null, 2), 'utf8');
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
        console.log(`Detecting language for text: ${text}`);
        const detectRes = await axios.post(`${LIBRETRANSLATE_URL}/detect`, { q: text });
        const detectedLang = detectRes.data?.[0]?.language || 'unknown';

        if (!supportedLanguages.includes(detectedLang)) {
          await interaction.editReply('❗ Detected language not supported: ' + detectedLang);
          return;
        }

        console.log(`Translating from ${detectedLang} to ${targetLang}`);
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
      const detectedLang = detectRes.data?.[0]?.language || 'unknown';

      if (!supportedLanguages.includes(detectedLang)) {
        await interaction.editReply('❗ Detected language not supported: ' + detectedLang);
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

client.login(process.env.DISCORD_TOKEN);
