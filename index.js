const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const users = require('./users.json');
const path = require('path');
const axios = require('axios');
require('dotenv').config();


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Target channel IDs where the bot will watch for trigger messages
const targetChannels = [
  '1361838672818995312',
  '1366888045164499097',
  '1362441078908784793',
  '1366886810885689456',
  '1366887040498663634',
  '1364277004198875278'
];

// Channel where moderation alerts should be sent
const MOD_CHANNEL_ID = '1362988156546449598';

// Keywords to trigger the bot
const triggers = [
  // Basic bad joke tags
  'bad joke',
  'cringe',
  'bro why',
  'this is cursed',
  'forbidden word',

  // Common "cringe" or inappropriate phrases
  'not funny',
  'who asked',
  'kill me now',
  'this ain\'t it',
  'try harder',
  'that didn\'t land',
  'dark humor',
  'edgy much',
  'cancelled',
  'too soon',
  'yeesh',
  'ouch',
  'bruh moment',
  'your humor is broken',

  // Slang/mock callouts for distasteful posts
  'dude wtf',
  'wtf did i just read',
  'how is this a joke',
  'zero chill',
  'this belongs in the trash',
  'yikes',
  'gross',
  'tone deaf',
  'read the room',
  'problematic',

  // "Warning signs" of offensive jokes (caution advised)
  'racist joke',
  'sexist joke',
  'offensive joke',
  'abusive joke',
  'inappropriate joke',
  'harmful joke',
  'ableist joke',
  'homophobic joke',
  'misogynistic joke',
  'distasteful joke'
];

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

// 🚨 Extreme content triggers (racism, slurs, etc.)
const extremeTriggers = [

  // Racist slurs
  'nigger', 'chink', 'gook', 'spic', 'kike', 'sand nigger', 'porch monkey',
  'slant eye', 'wetback', 'beaner', 'camel jockey', 'raghead', 'towelhead',
  'monkey', 'jungle bunny', 'zipperhead', 'yellow peril', 'coon', 'pickaninny',

  // Anti-semitic
  'gas the jews', 'heil hitler', 'sieg heil', 'kike', 'zionist pig',
  'oven dodger', 'hook nose', 'dirty jew', 'ashkenazi scum',

  // Homophobic/Transphobic
  'faggot', 'dyke', 'tranny', 'no homo', 'fudge packer', 'shemale', 
  'drag freak', 'queer in a slur context', 'you’re not a real woman', 'man in a dress',

  // Ableist
  'retard', 'spastic', 'mongoloid', 'window licker', 'cripple', 'vegetable',
  'dumbass in a targeted way', 'deaf and dumb',

  // Sexist/Misogynistic
  'bitch', 'cunt', 'slut', 'whore', 'hoe', 'dumb broad', 'make me a sandwich',
  'women can’t drive', 'she asked for it', 'rape her', 'kill her',

  // Rape/abuse threats
  'rape', 'rape you', 'raping', 'kill yourself', 'kms', 'kys', 
  'go hang yourself', 'slit your wrists', 'choke and die', 
  'beat her', 'abuse her', 'molest', 'pedophile', 'pedo', 'groomer',

  // Xenophobic / Nationalist
  'build the wall', 'go back to your country', 'illegal alien', 'white power',
  'white pride', 'blood and soil', 'ethnic cleansing', 'great replacement',

  // Hate group references
  'kkk', 'white lives matter', '14 words', '1488', 'six million wasn’t enough',

  // Mass shooting / incel speech
  'going ER', 'ellen page is a man', 'beta uprising', 'soy boy', 'femoid',
  'roastie', 'chad', 'stacy', 'rape fuel', 'gymcel', 'kill all women',
  'mass shooter vibes', 'school shooter',

  // General toxicity
  'fuck you', 'die', 'i hope you die', 'you should die', 'kill all [group]',
  'useless piece of shit', 'waste of air', 'why are you alive', 'die in a fire'

];

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

// 🚨 Check for extreme/harmful content anywhere
if (extremeTriggers.some(trigger => content.includes(trigger))) {
  try {
    const channel = message.channel; // Store the channel before deleting
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
  
  // ----------------------------------
  // 🎯 Moderation Logic (targeted channels only)
  // ----------------------------------
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

  // ----------------------------------
  // 🌍 Set Language Command
  // ----------------------------------
  if (message.content.startsWith('!setlang ')) {
    const parts = message.content.trim().split(' ');
    const lang = parts[1]?.toLowerCase();

    const allowedLangs = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ar', 'hi', 'ru', 'ja'];

    if (!allowedLangs.includes(lang)) {
      return message.reply('❗ Invalid language code. Allowed: ' + allowedLangs.join(', '));
    }

    users[message.author.id] = lang;

    // Save to users.json
    fs.writeFileSync(
      path.join(__dirname, 'users.json'),
      JSON.stringify(users, null, 2),
      'utf8'
    );

    return message.reply(`✅ Your preferred translation language is now set to **${lang}**.`);
  }

  // ----------------------------------
  // 🌍 Auto-Translate Messages
  // ----------------------------------
  try {
    const detectRes = await axios.post('https://libretranslate.de/detect', {
      q: message.content
    });

    const detectedLang = detectRes.data?.[0]?.language || 'unknown';
    const userLang = users[message.author.id] || 'en'; // fallback to English

    if (detectedLang === userLang) return;

    const transRes = await axios.post('https://libretranslate.de/translate', {
      q: message.content,
      source: detectedLang,
      target: userLang,
      format: 'text'
    });

    const translated = transRes.data.translatedText;

    if (
      translated &&
      translated.toLowerCase().trim() !== message.content.toLowerCase().trim()
    ) {
      await message.reply({
        content: `🌍 **Translated from \`${detectedLang}\` to \`${userLang}\`:**\n> ${translated}`
      });
    }
  } catch (err) {
    console.error('Translation error:', err.message);
  }
});

// ✅ This goes LAST
client.login(process.env.DISCORD_TOKEN);