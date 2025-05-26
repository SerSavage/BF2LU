const { Client, GatewayIntentBits, AttachmentBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
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

// Initialize bump data
let bumpData = {};
const bumpDataFile = path.join(__dirname, 'bump.json');
try {
  const bumpDataRaw = fs.readFileSync(bumpDataFile, 'utf8');
  bumpData = JSON.parse(bumpDataRaw);
} catch (err) {
  console.warn('bump.json not found or invalid, starting with empty bump data:', err.message);
  fs.writeFileSync(bumpDataFile, '{}', 'utf8');
}

// Initialize reaction role message data
let reactionRoleData = {};
const reactionRoleFile = path.join(__dirname, 'reaction_roles.json');
try {
  const reactionRoleRaw = fs.readFileSync(reactionRoleFile, 'utf8');
  reactionRoleData = JSON.parse(reactionRoleRaw);
} catch (err) {
  console.warn('reaction_roles.json not found or invalid, starting with empty reaction role data:', err.message);
  fs.writeFileSync(reactionRoleFile, '{}', 'utf8');
}

// Initialize command cooldowns
let cooldowns = {};
const cooldownFile = path.join(__dirname, 'cooldowns.json');
try {
  const cooldownData = fs.readFileSync(cooldownFile, 'utf8');
  cooldowns = JSON.parse(cooldownData);
} catch (err) {
  console.warn('cooldowns.json not found or invalid, starting with empty cooldowns object:', err.message);
  fs.writeFileSync(cooldownFile, '{}', 'utf8');
}

const COOLDOWN_DURATION = 30 * 60 * 1000; // 30 minutes in ms

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildMembers
  ]
});

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://translationlib.onrender.com';
const CLIENT_ID = process.env.CLIENT_ID;
const BUMP_CHANNEL_ID = '1361848627789828148';
const WELCOME_CHANNEL_ID = '1361849763611541584';
const LFG_CHANNEL_ID = '1364996738808807474';
const BUMP_COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours in ms
const BUMP_USER_IDS = ['275603696036085760', '1128811453026156594'];

// Welcome channel reaction roles
const welcomeRoles = {
  'Guardian': { emoji: 'guardian_emoji', roleId: '1362488297510797443' },
  'Consular': { emoji: 'consular_emoji', roleId: '1362488420299047024' },
  'Marauder': { emoji: 'marauder_emoji', roleId: '1362488467757465981' },
  'Sentinel': { emoji: 'sentinel_emoji', roleId: '1362488521671311601' },
  'Mandalorian': { emoji: 'mandalorian_emoji', roleId: '1362488684469026976' },
  'Balanced': { emoji: 'balanced_emoji', roleId: '1362488725111705650' },
  'Grey Warden': { emoji: 'greywarden_emoji', roleId: '1362489042821972219' },
  'Inquisitor': { emoji: 'inquisitor_emoji', roleId: '1362490015648579845' },
  'Sorcerer': { emoji: 'sorcerer_emoji', roleId: '1362490083017625640' }
};

// LFG channel reaction roles (3 messages)
const lfgRoles = {
  'battlefront2': {
    title: 'Looking4Group - Battlefront 2 (2017)',
    description: 'React below to get pinged for LFG requests! Choose one or both:',
    roles: {
      'LFG-KYBER': { emoji: 'KYBER', roleId: '1364271161000591430' },
      'LFG-VANILLA': { emoji: 'VANILLA', roleId: '1364262718487531581' }
    }
  },
  'swtor': {
    title: 'The Galaxy Calls - Star Wars: The Old Republic',
    description: "Credits don't earn themselves. If you're looking for action, glory or a fat payday - Will you answer the call?",
    roles: {
      'LFG-SWTOR': { emoji: 'SWTOR', roleId: '365936777176682547' }
    }
  },
  'battlefrontClassic': {
    title: 'Battlefront Classic LFG (2004/2005)',
    description: 'Looking to squad up in the original Star Wars: Battlefront I & II? Whether you\'re storming the beaches of Kashyyyk or defending the Death Star, join this role to find players for classic online sessions, mods, or LAN-based games (via SWBFSpy, GameRanger, or Steam). The battlefront is never closed—only waiting.',
    roles: {
      'LFG-CLASSIC2004': { emoji: 'CLASSIC2004', roleId: '1371895939786080297' },
      'LFG-CLASSIC2005': { emoji: 'CLASSIC2005', roleId: '1371897792695369778' }
    }
  }
};

// LFG command mappings
const lfgCommands = {
  'classic2005squad-up': {
    roleId: '1371897792695369778', // LFG-CLASSIC2005
    slashCommand: 'looking4group-classic2005time',
    message: (user) => `📡 <@${user.id}> sounds the battle horn! The Clone Wars rage on in Battlefront Classic (2005)! <@&1371897792695369778>, assemble your squad—blasters hot, starfighters ready! Will you answer the call? 🔥`
  },
  'classic2004squad-up': {
    roleId: '1371895939786080297', // LFG-CLASSIC2004
    slashCommand: 'looking4group-classic2004time',
    message: (user) => `📡 <@${user.id}> ignites the signal flare! The Galactic Civil War erupts in Battlefront Classic (2004)! <@&1371895939786080297>, rally your troops—AT-ATs are marching, and the Rebellion needs you! Who’s ready to fight? 🚀`
  },
  'swtorsquad-up': {
    roleId: '365936777176682547', // LFG-SWTOR
    slashCommand: 'looking4group-swtortime',
    message: (user) => `📡 <@${user.id}> calls across the galaxy! The Old Republic needs heroes in SWTOR! <@&365936777176682547>, grab your lightsabers and blasters—Sith or Jedi, the battle awaits! Who’s joining the fight for glory? 🌌`
  },
  'vanillasquad-up': {
    roleId: '1364262718487531581', // LFG-VANILLA
    slashCommand: 'looking4group-vanillatime',
    message: (user) => `📡 <@${user.id}> sends out the distress signal! Battlefront 2 (2017) Vanilla servers are heating up! <@&1364262718487531581>, gear up for epic battles—no mods, just pure chaos! Who’s ready to dominate the battlefield? 💥`
  },
  'kybersquad-up': {
    roleId: '1364271161000591430', // LFG-KYBER
    slashCommand: 'looking4group-kybertime',
    message: (user) => `📡 <@${user.id}> channels the Force! The Kyber servers in Battlefront 2 (2017) are live! <@&1364271161000591430>, ignite your sabers and ready your blasters—heroes and villains clash tonight! Who’s in for the fight? ⚔️`
  }
};

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
    console.error('Error registering commands:', error.message);
  }
}

// Create custom emojis for reaction roles (only for welcome channel)
async function createCustomEmojis(guild, roles) {
  try {
    const existingEmojis = await guild.emojis.fetch();
    for (const [roleName, { emoji: emojiName }] of Object.entries(roles)) {
      if (!existingEmojis.some(emoji => emoji.name === emojiName)) {
        const emojiPath = path.join(__dirname, 'media', `${roleName.replace(/ /g, '')}.png`);
        if (fs.existsSync(emojiPath)) {
          const emojiData = fs.readFileSync(emojiPath);
          const stats = fs.statSync(emojiPath);
          if (stats.size > 256 * 1024) {
            console.warn(`Emoji file too large: ${emojiPath} (${stats.size} bytes, max 256KB)`);
            continue;
          }
          await guild.emojis.create({
            attachment: emojiData,
            name: emojiName
          });
          console.log(`Created emoji: ${emojiName}`);
        } else {
          console.warn(`Emoji file not found: ${emojiPath}`);
        }
      }
    }
  } catch (err) {
    console.error('Error creating custom emojis:', err.message);
  }
}

// Setup welcome channel reaction roles
async function setupWelcomeReactionRoles() {
  try {
    const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.error('Welcome channel not found or not text-based');
      return;
    }

    const guild = channel.guild;
    await createCustomEmojis(guild, welcomeRoles);

    const emojis = await guild.emojis.fetch();
    const emojiMap = {};
    for (const [roleName, { emoji: emojiName }] of Object.entries(welcomeRoles)) {
      const emoji = emojis.find(e => e.name === emojiName);
      if (emoji) {
        emojiMap[roleName] = emoji;
      } else {
        console.warn(`Emoji not found for role: ${roleName}`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('The strongest stars have hearts of kyber.')
      .setDescription(
        'Across the galaxy, every warrior channels the Force through a crystal attuned to their essence.\n' +
        'Now it’s your turn.\n\n' +
        '**Choose your path:**\n' +
        Object.keys(welcomeRoles)
          .map(role => `${emojiMap[role] || '❓'} - ${role}`)
          .join('\n')
      )
      .setColor('#00B7EB')
      .setFooter({ text: 'React to claim your role (disclaimer if your previous is messing up :D)!' });

    let message;
    const existingMessageId = reactionRoleData[WELCOME_CHANNEL_ID]?.messageId;
    if (existingMessageId) {
      try {
        message = await channel.messages.fetch(existingMessageId);
      } catch (err) {
        console.warn('Welcome reaction role message not found, creating new one:', err.message);
      }
    }

    if (!message) {
      message = await channel.send({ embeds: [embed] });
      reactionRoleData[WELCOME_CHANNEL_ID] = { messageId: message.id };
      fs.writeFileSync(reactionRoleFile, JSON.stringify(reactionRoleData, null, 2), 'utf8');
    }

    for (const roleName of Object.keys(welcomeRoles)) {
      const emoji = emojiMap[roleName];
      if (emoji) {
        await message.react(emoji);
      }
    }
  } catch (err) {
    console.error('Error setting up welcome reaction roles:', err.message);
  }
}

// Setup LFG channel reaction roles
async function setupLfgReactionRoles() {
  try {
    const channel = await client.channels.fetch(LFG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.error('LFG channel not found or not text-based');
      return;
    }

    const guild = channel.guild;
    const emojis = await guild.emojis.fetch();

    // Setup each LFG message
    for (const [messageKey, { title, description, roles }] of Object.entries(lfgRoles)) {
      const emojiMap = {};
      for (const [roleName, { emoji: emojiName }] of Object.entries(roles)) {
        const emoji = emojis.find(e => e.name === emojiName);
        if (emoji) {
          emojiMap[roleName] = emoji;
        } else {
          console.warn(`Emoji not found for role: ${roleName} in ${messageKey}`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#808080') // Grey border color
        .addFields(
          {
            name: title,
            value: '\u200b', // Non-breaking space to separate title
            inline: false
          },
          {
            name: '\u200b',
            value: description,
            inline: false
          },
          {
            name: '\u200b',
            value: `**Choose your role:**\n${Object.keys(roles)
              .map(role => `${emojiMap[role] || '❓'} - ${role}`)
              .join('\n')}`,
            inline: false
          },
          {
            name: '\u200b',
            value: 'React to join the LFG role!',
            inline: false
          }
        );

      let message;
      const existingMessageId = reactionRoleData[`${LFG_CHANNEL_ID}_${messageKey}`]?.messageId;
      if (existingMessageId) {
        try {
          message = await channel.messages.fetch(existingMessageId);
          await message.edit({ embeds: [embed] }); // Update existing message
        } catch (err) {
          console.warn(`LFG reaction role message (${messageKey}) not found, creating new one:`, err.message);
        }
      }

      if (!message) {
        message = await channel.send({ embeds: [embed] });
        reactionRoleData[`${LFG_CHANNEL_ID}_${messageKey}`] = { messageId: message.id };
        fs.writeFileSync(reactionRoleFile, JSON.stringify(reactionRoleData, null, 2), 'utf8');
      }

      for (const roleName of Object.keys(roles)) {
        const emoji = emojiMap[roleName];
        if (emoji) {
          try {
            await message.react(emoji);
          } catch (err) {
            console.error(`Failed to add reaction for ${roleName} (${emoji.name}):`, err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error setting up LFG reaction roles:', err.message);
  }
}

// Check and notify for bump
async function checkAndNotifyBump() {
  try {
    const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.error('Bump channel not found or not text-based');
      return;
    }

    const now = Date.now();
    const lastBump = bumpData[BUMP_CHANNEL_ID]?.timestamp || 0;
    const notified = bumpData[BUMP_CHANNEL_ID]?.notified || false;
    const lastBumperId = bumpData[BUMP_CHANNEL_ID]?.userId;
    let lastBumperTag = 'someone';

    if (lastBumperId) {
      try {
        const lastBumper = await client.users.fetch(lastBumperId);
        lastBumperTag = lastBumper.tag;
      } catch (err) {
        console.warn(`Failed to fetch user ${lastBumperId}:`, err.message);
      }
    }

    if (now - lastBump >= BUMP_COOLDOWN && !notified) {
      const userMentions = BUMP_USER_IDS.map(id => `<@${id}>`).join(' and ');
      await channel.send(
        `${userMentions}, the galaxy needs your spark! 🌌 ${lastBumperTag} gave us a /bump last time—now it’s your turn to keep our server shining bright! Use /bump to boost our vibe and bring more friends to the party! 🚀`
      );
      console.log(`Sent bump notification at ${new Date(now).toISOString()} for last bumper: ${lastBumperTag}`);
      bumpData[BUMP_CHANNEL_ID] = { ...bumpData[BUMP_CHANNEL_ID], notified: true };
      fs.writeFileSync(bumpDataFile, JSON.stringify(bumpData, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error in checkAndNotifyBump:', err.message);
  }
}

client.once('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  await registerCommands();
  await setupWelcomeReactionRoles();
  await setupLfgReactionRoles();
  setInterval(checkAndNotifyBump, 10 * 60 * 1000);
  await checkAndNotifyBump();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Handle LFG squad-up commands
  if (message.channel.id === '1364277004198875278' && content.startsWith('!')) {
    const command = content.slice(1); // Remove the '!' prefix
    const lfgCommand = Object.keys(lfgCommands).find(cmd => cmd === command);

    if (lfgCommand) {
      try {
        const guild = message.guild;
        const member = await guild.members.fetch(message.author.id);
        const roleId = lfgCommands[lfgCommand].roleId;
        const userId = message.author.id;
        const now = Date.now();

        // Check cooldown
        if (cooldowns[userId] && (now - cooldowns[userId]) < COOLDOWN_DURATION) {
          const timeLeft = Math.ceil((COOLDOWN_DURATION - (now - cooldowns[userId])) / 60000);
          await message.reply(`⏳ You're on cooldown! Please wait ${timeLeft} minute(s) before using this command again.`);
          return;
        }

        if (!member.roles.cache.has(roleId)) {
          await message.reply(`❌ You need the <@&${roleId}> role to use this command! Join the role in <#${LFG_CHANNEL_ID}>.`);
          return;
        }

        const callToArms = lfgCommands[lfgCommand].message(message.author.id);
        await message.channel.send(callToArms);
        cooldowns[userId] = now;
        fs.writeFileSync(cooldownFile, JSON.stringify(cooldowns, null, 2), 'utf8');
        console.log(`LFG command ${command} executed by ${message.author.tag}, role ID: ${roleId}`);
      } catch (err) {
        console.error(`Error handling LFG command ${command}:`, err.message);
        await message.reply('❌ An error occurred while processing your request.');
      }
      return;
    }
  }

  if (
    message.channel.id === BUMP_CHANNEL_ID &&
    content === '/bump' &&
    BUMP_USER_IDS.includes(message.author.id)
  ) {
    bumpData[BUMP_CHANNEL_ID] = {
      timestamp: Date.now(),
      userId: message.author.id,
      notified: false
    };
    fs.writeFileSync(bumpDataFile, JSON.stringify(bumpData, null, 2), 'utf8');
    console.log(`Detected /bump by ${message.author.tag}, updated timestamp`);
  }

  if (extremeTriggers.some(trigger => content.includes(trigger))) {
    try {
      const channel = message.channel;
      const gifPath = './media/ashamed.gif';

      await message.delete();

      const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
      if (modChannel && modChannel.isTextBased()) {
        await modChannel.send({
          content: `🚨 **EXTREME CONTENT DETECTED!** 🚨` +
                   `**User:** <@${message.author.id}>` +
                   `**Message Deleted** from <#${channel.id}>`
        });
      }

      if (fs.existsSync(gifPath)) {
        const gifFile = new AttachmentBuilder(gifPath);
        await channel.send({
          content: `⚠️ Inappropriate content detected. A moderator has been notified.`,
          files: [gifFile]
        });
      } else {
        console.error('GIF file not found:', gifPath);
      }
    } catch (err) {
      console.error('Failed to handle extreme content:', err.message);
    }
    return;
  }

  if (targetChannels.includes(message.channel.id)) {
    if (triggers.some(trigger => content.includes(trigger))) {
      const filePath = './audio/cringe.mp3';

      try {
        if (fs.existsSync(filePath)) {
          const audioFile = new AttachmentBuilder(filePath);
          await message.channel.send({
            content: '🔊 Cringe detected! 😬',
            files: [audioFile]
          });

          const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
          if (modChannel && modChannel.isTextBased()) {
            await modChannel.send({
              content: `⚠️ **Trigger detected in <#${message.channel.id}>** ⚠️` +
                       `**User:** <@${message.author.id}>` +
                       `**Message:** ${message.content}`
            });
          }
        } else {
          console.error('Audio file not found:', filePath);
        }
      } catch (err) {
        console.error('Failed to send mod alert:', err.message);
      }
    }
  }

  if (message.content.startsWith('!setlang ')) {
    const parts = message.content.trim().split(' ');
    const lang = parts[1]?.toLowerCase();

    if (!supportedLanguages.includes(lang)) {
      return message.reply(`❗ Invalid language code: ${lang}. Supported languages are: ${supportedLanguages.join(', ')}`);
    }

    users[message.author.id] = lang;
    fs.writeFileSync(
      path.join(__dirname, 'users.json'),
      JSON.stringify(users, null, 2),
      'utf8'
    );
    return message.reply(`✅ Your preferred translation language is now set to **${lang}**.`);
  }
});

client.on('interactionCreate', async interaction => {
  console.log(`Interaction received: type=${interaction.type}, command=${interaction.commandName || 'none'}`);

  if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) {
    console.log('Ignoring non-command interaction');
    return;
  }

  try {
    if (interaction.isChatInputCommand()) {
      console.log(`Processing command: ${interaction.commandName}`);

      // Handle LFG slash commands
      const lfgCommandEntry = Object.values(lfgCommands).find(
        cmd => cmd.slashCommand === interaction.commandName
      );
      if (lfgCommandEntry && interaction.channel.id === '1364277004198875278') {
        await interaction.deferReply();
        try {
          const guild = interaction.guild;
          const member = await guild.members.fetch(interaction.user.id);
          const roleId = lfgCommandEntry.roleId;
          const userId = interaction.user.id;
          const now = Date.now();

          // Check cooldown
          if (cooldowns[userId] && (now - cooldowns[userId]) < COOLDOWN_DURATION) {
            const timeLeft = Math.ceil((COOLDOWN_DURATION - (now - cooldowns[userId])) / 60000);
            await interaction.editReply(`⏳ You're on cooldown! Please wait ${timeLeft} minute(s) before using this command again.`);
            return;
          }

          if (!member.roles.cache.has(roleId)) {
            await interaction.editReply(`❌ You need the <@&${roleId}> role to use this command! Join the role in <#${LFG_CHANNEL_ID}>.`);
            return;
          }

          const callToArms = lfgCommandEntry.message(interaction.user.id);
          await interaction.editReply(callToArms);
          cooldowns[userId] = now;
          fs.writeFileSync(cooldownFile, JSON.stringify(cooldowns, null, 2), 'utf8');
          console.log(`LFG slash command ${interaction.commandName} executed by ${interaction.user.tag}, role ID: ${roleId}`);
        } catch (err) {
          console.error(`Error handling LFG slash command ${interaction.commandName}:`, err.message);
          await interaction.editReply('❌ An error occurred while processing your request.');
        }
        return;
      }

      if (interaction.commandName === 'setlanguage') {
        await interaction.deferReply();
        const lang = interaction.options.getString('language')?.toLowerCase();

        if (!supportedLanguages.includes(lang)) {
          await interaction.editReply(`❗ Invalid language code. Allowed: ${supportedLanguages.join(', ')}`);
          return;
        }

        users[interaction.user.id] = lang;
        fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(users, null, 2), 'utf8');
        await interaction.editReply(`✅ Your preferred translation language is now set to ${lang}.`);
      }

      if (interaction.commandName === 'translate') {
        await interaction.deferReply();
        const text = interaction.options.getString('text');
        let targetLang = (interaction.options.getString('language') || users[interaction.user.id] || 'en').toLowerCase();

        if (!supportedLanguages.includes(targetLang)) {
          await interaction.editReply(`❗ Invalid target language code. Allowed: ${supportedLanguages.join(', ')}`);
          return;
        }

        try {
          console.log(`Detecting language for text: ${text}`);
          const detectRes = await axios.post(`${LIBRETRANSLATE_URL}/detect`, { q: text });
          const detectedLang = detectRes.data?.[0]?.language || 'unknown';

          if (!supportedLanguages.includes(detectedLang)) {
            await interaction.editReply(`❗ Detected language not supported: ${detectedLang}`);
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
          console.error('Translation error:', {
            message: err.message,
            response: err.response ? {
              status: err.response.status,
              data: err.response.data
            } : 'No response'
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
        await interaction.editReply(`❗ Invalid target language code. Allowed: ${supportedLanguages.join(', ')}`);
        return;
      }

      try {
        const detectRes = await axios.post(`${LIBRETRANSLATE_URL}/detect`, { q: message.content });
        const detectedLang = detectRes.data?.[0]?.language || 'unknown';

        if (!supportedLanguages.includes(detectedLang)) {
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
        console.error('Translation error:', {
          message: err.message,
          response: err.response ? {
            status: err.response.status,
            data: err.response.data
          } : 'No response'
        });
        await interaction.editReply('❌ Error translating message. Please try again later.');
      }
    }
  } catch (err) {
    console.error('Interaction error:', err.message);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true }).catch(console.error);
    }
  }
});

// Handle reaction role add
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  const channelId = reaction.message.channel.id;
  const messageId = reaction.message.id;

  // Handle Welcome channel reactions
  if (channelId === WELCOME_CHANNEL_ID && messageId === reactionRoleData[WELCOME_CHANNEL_ID]?.messageId) {
    try {
      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id);
      const emojiName = reaction.emoji.name;

      const roleEntry = Object.entries(welcomeRoles).find(
        ([_, { emoji }]) => emoji === emojiName
      );

      if (roleEntry) {
        const roleId = roleEntry[1].roleId;
        const role = guild.roles.cache.get(roleId);
        if (role) {
          await member.roles.add(role);
          console.log(`Assigned role ${roleEntry[0]} (ID: ${roleId}) to ${user.tag} in Welcome channel`);
        } else {
          console.warn(`Role not found: ${roleId} in Welcome channel`);
        }
      }
    } catch (err) {
      console.error('Error adding reaction role in Welcome channel:', err.message);
    }
    return;
  }

  // Handle LFG channel reactions
  if (channelId === LFG_CHANNEL_ID) {
    for (const [messageKey, { roles }] of Object.entries(lfgRoles)) {
      const lfgMessageId = reactionRoleData[`${LFG_CHANNEL_ID}_${messageKey}`]?.messageId;
      if (messageId !== lfgMessageId) continue;

      try {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const emoji = reaction.emoji;
        const emojiName = emoji.name || (emoji.id ? await guild.emojis.fetch(emoji.id).then(e => e.name) : null);

        console.log(`Reaction added: user=${user.tag}, channel=${channelId}, message=${messageId}, emojiName=${emojiName}, messageKey=${messageKey}`);

        const roleEntry = Object.entries(roles).find(
          ([_, { emoji: roleEmoji }]) => roleEmoji === emojiName
        );

        if (roleEntry) {
          const roleName = roleEntry[0];
          const roleId = roleEntry[1].roleId;
          const role = guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.add(role);
            console.log(`Assigned role ${roleName} (ID: ${roleId}) to ${user.tag} in LFG channel (${messageKey})`);
          } else {
            console.warn(`Role not found: ${roleId} in LFG channel (${messageKey})`);
          }
        } else {
          console.warn(`No matching role found for emoji ${emojiName} in message ${messageKey}`);
        }
      } catch (err) {
        console.error(`Error adding reaction role in LFG channel (${messageKey}):`, err.message);
      }
      break;
    }
  }
});

// Handle reaction role remove
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  const channelId = reaction.message.channel.id;
  const messageId = reaction.message.id;

  // Handle Welcome channel reactions
  if (channelId === WELCOME_CHANNEL_ID && messageId === reactionRoleData[WELCOME_CHANNEL_ID]?.messageId) {
    try {
      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id);
      const emojiName = reaction.emoji.name;

      const roleEntry = Object.entries(welcomeRoles).find(
        ([_, { emoji }]) => emoji === emojiName
      );

      if (roleEntry) {
        const roleId = roleEntry[1].roleId;
        const role = guild.roles.cache.get(roleId);
        if (role) {
          await member.roles.remove(role);
          console.log(`Removed role ${roleEntry[0]} (ID: ${roleId}) from ${user.tag} in Welcome channel`);
        } else {
          console.warn(`Role not found: ${roleId} in Welcome channel`);
        }
      }
    } catch (err) {
      console.error('Error removing reaction role in Welcome channel:', err.message);
    }
    return;
  }

  // Handle LFG channel reactions
  if (channelId === LFG_CHANNEL_ID) {
    for (const [messageKey, { roles }] of Object.entries(lfgRoles)) {
      const lfgMessageId = reactionRoleData[`${LFG_CHANNEL_ID}_${messageKey}`]?.messageId;
      if (messageId !== lfgMessageId) continue;

      try {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const emojiName = reaction.emoji.name;

        const roleEntry = Object.entries(roles).find(
          ([_, { emoji }]) => emoji === emojiName
        );

        if (roleEntry) {
          const roleId = roleEntry[1].roleId;
          const role = guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.remove(role);
            console.log(`Removed role ${roleEntry[0]} (ID: ${roleId}) from ${user.tag} in LFG channel (${messageKey})`);
          } else {
            console.warn(`Role not found: ${roleId} in LFG channel (${messageKey})`);
          }
        }
      } catch (err) {
        console.error(`Error removing reaction role in LFG channel (${messageKey}):`, err.message);
      }
      break;
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
