// ═══════════════════════════════════════════════════════════════════════════════
// 👑 VELNO SOVEREIGN EDITION
// "The Last Bot You Will Ever Need"
// ═══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, 
    REST, Routes, ChannelType, ActivityType 
} = require('discord.js');
const mongoose = require('mongoose');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection 
} = require('@discordjs/voice');
const play = require('play-dl');

// 🎨 PREMIUM THEME CONFIGURATION
const THEME = {
    GOLD: '#FFD700',       // Main Accent
    DARK: '#0F172A',       // Background
    ERROR: '#DC2626',      // Errors
    SUCCESS: '#10B981',    // Success
    FOOTER: 'Velno Sovereign • Exclusive Systems',
    OWNER_ID: 'YOUR_DISCORD_ID_HERE' 
};

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    MONGO_URI: process.env.MONGODB_URI,
    PREFIX: '.'
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🗄️ DATABASE SCHEMAS (Unified Sovereign DB)
// ═══════════════════════════════════════════════════════════════════════════════

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 1000 },
    bank: { type: Number, default: 5000 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    warns: { type: Number, default: 0 },
    inventory: [String],
    dailyStreak: { type: Number, default: 0 },
    lastDaily: Date
});

const User = mongoose.model('SovereignUser', userSchema);

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 MUSIC SYSTEM CORE
// ═══════════════════════════════════════════════════════════════════════════════

const musicQueue = new Map();

// Initialize play-dl tokens (Optional: Add Spotify/SoundCloud tokens here if needed)
play.setToken({
    youtube : { cookie : "" } // Add cookies here if YouTube blocks you later
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// ═══════════════════════════════════════════════════════════════════════════════
// 💎 UTILITY FUNCTIONS (The "Premium" Feel)
// ═══════════════════════════════════════════════════════════════════════════════

function createEmbed(title, description, color = THEME.GOLD) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: THEME.FOOTER, iconURL: client.user?.displayAvatarURL() });
}

async function getUser(id) {
    let user = await User.findOne({ userId: id });
    if (!user) user = await User.create({ userId: id });
    return user;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📜 COMMANDS REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

const commands = [
    // --- 🛡️ MODERATION ---
    {
        name: 'purge',
        description: 'Clear messages instantly',
        options: [{ name: 'amount', type: 4, description: 'Number of messages', required: true }],
        execute: async (i, isSlash, args) => {
            if (!i.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return reply(i, '❌ Access Denied.');
            const amount = isSlash ? i.options.getInteger('amount') : parseInt(args[0]);
            if (!amount || amount > 100) return reply(i, '❌ Max 100 messages.');
            
            await i.channel.bulkDelete(amount, true);
            reply(i, `🧹 **Systems purged ${amount} messages.**`, true);
        }
    },
    {
        name: 'ban',
        description: 'Banish a user from the realm',
        options: [{ name: 'user', type: 6, description: 'Target', required: true }],
        execute: async (i, isSlash, args) => {
            if (!i.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return reply(i, '❌ Access Denied.');
            const target = isSlash ? i.options.getUser('user') : i.mentions.users.first();
            if (!target) return reply(i, '❌ Target required.');
            
            await i.guild.members.ban(target);
            const embed = createEmbed('🔨 Judgment Executed', `**${target.tag}** has been banished from the Sovereign.`, THEME.ERROR);
            reply(i, { embeds: [embed] });
        }
    },

    // --- 💰 ECONOMY ---
    {
        name: 'balance',
        description: 'View your Sovereign Wealth',
        execute: async (i) => {
            const user = await getUser(i.member.id);
            const embed = createEmbed(`🏦 Sovereign Account: ${i.member.user.username}`, '')
                .addFields(
                    { name: '💵 Liquid Cash', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💎 Vault', value: `$${user.bank.toLocaleString()}`, inline: true },
                    { name: '📊 Net Worth', value: `$${(user.balance + user.bank).toLocaleString()}`, inline: true }
                )
                .setThumbnail(i.member.user.displayAvatarURL());
            reply(i, { embeds: [embed] });
        }
    },
    {
        name: 'daily',
        description: 'Collect your daily tribute',
        execute: async (i) => {
            const user = await getUser(i.member.id);
            const now = new Date();
            
            if (user.lastDaily && (now - user.lastDaily) < 86400000) {
                return reply(i, '⏳ **Patience.** The treasury reopens tomorrow.');
            }

            const amount = 2000 + (user.dailyStreak * 100);
            user.balance += amount;
            user.dailyStreak++;
            user.lastDaily = now;
            await user.save();

            const embed = createEmbed('🎁 Tribute Collected', `You received **$${amount.toLocaleString()}**.\nStreak: ${user.dailyStreak} days`, THEME.SUCCESS);
            reply(i, { embeds: [embed] });
        }
    },

    // --- 🎵 MUSIC (THE BIG ONE) ---
    {
        name: 'play',
        description: 'Queue a melody',
        options: [{ name: 'song', type: 3, description: 'URL or Name', required: true }],
        execute: async (i, isSlash, args) => {
            if (!i.member.voice.channel) return reply(i, '❌ Connect to a voice channel first.');
            
            // Defer reply because searching takes time
            if (isSlash) await i.deferReply();
            else await i.channel.sendTyping();

            const query = isSlash ? i.options.getString('song') : args.join(' ');
            
            try {
                // Search with play-dl
                let yt_info = await play.search(query, { limit: 1 });
                if (!yt_info || yt_info.length === 0) return editReply(i, isSlash, '❌ No melody found.');
                
                const video = yt_info[0];
                const queue = musicQueue.get(i.guild.id) || [];
                const isPlaying = queue.length > 0;
                
                queue.push({ 
                    title: video.title, 
                    url: video.url, 
                    duration: video.durationRaw,
                    thumbnail: video.thumbnails[0].url
                });
                musicQueue.set(i.guild.id, queue);

                if (!isPlaying) {
                    startMusic(i.guild, i.member.voice.channel, i.channel);
                    editReply(i, isSlash, `🎵 **Starting:** ${video.title}`);
                } else {
                    const embed = createEmbed('📜 Added to Queue', `**${video.title}**\nLength: ${video.durationRaw}`, THEME.GOLD)
                        .setThumbnail(video.thumbnails[0].url);
                    if (isSlash) await i.editReply({ embeds: [embed] });
                    else await i.channel.send({ embeds: [embed] });
                }

            } catch (error) {
                console.error(error);
                editReply(i, isSlash, '❌ Music System Error: ' + error.message);
            }
        }
    },
    {
        name: 'skip',
        description: 'Skip current song',
        execute: async (i) => {
            const player = getVoiceConnection(i.guild.id)?.state?.subscription?.player;
            if (player) {
                player.stop();
                reply(i, '⏭️ **Skipped.**');
            } else {
                reply(i, '❌ Nothing playing.');
            }
        }
    },

    // --- 📊 LEVELING ---
    {
        name: 'rank',
        description: 'Check your prestige',
        execute: async (i) => {
            const user = await getUser(i.member.id);
            const nextLevel = user.level * 1000;
            const progress = Math.floor((user.xp / nextLevel) * 10);
            const bar = '▰'.repeat(progress) + '▱'.repeat(10 - progress);

            const embed = createEmbed(`👑 Prestige: ${i.member.user.username}`, '')
                .addFields(
                    { name: 'Level', value: `${user.level}`, inline: true },
                    { name: 'XP', value: `${user.xp} / ${nextLevel}`, inline: true },
                    { name: 'Progress', value: `${bar} (${Math.floor((user.xp/nextLevel)*100)}%)`, inline: false }
                );
            reply(i, { embeds: [embed] });
        }
    },
    
    // --- 🎫 TICKETS ---
    {
        name: 'ticket',
        description: 'Spawn the ticket portal',
        execute: async (i) => {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
            
            const embed = createEmbed('📩 Sovereign Support', 'Click below to open a private channel with High Command.')
                .setThumbnail(i.guild.iconURL());
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_ticket').setLabel('Open Ticket').setStyle(ButtonStyle.Secondary).setEmoji('📩')
            );
            
            await i.channel.send({ embeds: [embed], components: [row] });
            reply(i, '✅ Portal opened.', true);
        }
    }
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🧠 SYSTEM CORE (HANDLERS)
// ═══════════════════════════════════════════════════════════════════════════════

// --- 🎵 MUSIC ENGINE ---
async function startMusic(guild, voiceChannel, textChannel) {
    const queue = musicQueue.get(guild.id);
    if (!queue || queue.length === 0) {
        musicQueue.delete(guild.id);
        const conn = getVoiceConnection(guild.id);
        if (conn) conn.destroy();
        return;
    }

    const song = queue[0];
    
    try {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        const stream = await play.stream(song.url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        const player = createAudioPlayer();
        
        player.play(resource);
        connection.subscribe(player);

        const embed = createEmbed('🎶 Now Playing', `[**${song.title}**](${song.url})`, THEME.GOLD)
            .addFields(
                { name: 'Duration', value: song.duration, inline: true },
                { name: 'Requester', value: 'Sovereign Guest', inline: true }
            )
            .setImage(song.thumbnail);

        textChannel.send({ embeds: [embed] });

        player.on(AudioPlayerStatus.Idle, () => {
            queue.shift();
            startMusic(guild, voiceChannel, textChannel);
        });

        player.on('error', error => {
            console.error('Player Error:', error);
            queue.shift();
            startMusic(guild, voiceChannel, textChannel);
        });

    } catch (error) {
        console.error('Connection Error:', error);
        textChannel.send('❌ Audio Extraction Failed. Playing next...');
        queue.shift();
        startMusic(guild, voiceChannel, textChannel);
    }
}

// --- ⚡ REPLY HELPERS ---
async function reply(i, content, ephemeral = false) {
    const payload = typeof content === 'string' ? { content } : content;
    if (ephemeral) payload.ephemeral = true;
    
    if (i.isChatInputCommand && i.isChatInputCommand()) {
        if (i.deferred) await i.editReply(payload);
        else await i.reply(payload).catch(() => {});
    } else {
        await i.reply(payload).catch(() => {});
    }
}

async function editReply(i, isSlash, content) {
    const payload = typeof content === 'string' ? { content } : content;
    if (isSlash) await i.editReply(payload);
    else await i.channel.send(payload);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 EVENTS & STARTUP
// ═══════════════════════════════════════════════════════════════════════════════

client.once('ready', async () => {
    console.log(`
    ╔════════════════════════════════════════════╗
    ║  👑 VELNO SOVEREIGN IS ONLINE              ║
    ║  Theme: GOLD / MIDNIGHT BLUE               ║
    ╚════════════════════════════════════════════╝
    `);

    mongoose.connect(CONFIG.MONGO_URI).then(() => console.log('🗄️  Sovereign DB Connected'));

    // Register Slash Commands
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(CONFIG.CLIENT_ID),
            { body: commands.map(c => ({ name: c.name, description: c.description, options: c.options || [] })) }
        );
        console.log('✅ Commands Synced.');
    } catch (e) { console.error(e); }

    client.user.setActivity('over the Empire | .help', { type: ActivityType.Watching });
});

// MESSAGE HANDLER (Leveling + Prefix)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Leveling Logic
    const user = await getUser(message.author.id);
    user.xp += Math.floor(Math.random() * 10) + 15;
    const nextLevel = user.level * 1000;
    if (user.xp >= nextLevel) {
        user.level++;
        user.xp = 0;
        await message.channel.send(`👑 **Ascension!** <@${message.author.id}> reached **Level ${user.level}**!`);
    }
    await user.save();

    // Command Logic
    if (!message.content.startsWith(CONFIG.PREFIX)) return;
    const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    
    const command = commands.find(c => c.name === cmdName);
    if (command) command.execute(message, false, args);
});

// INTERACTION HANDLER
client.on('interactionCreate', async i => {
    if (i.isChatInputCommand()) {
        const command = commands.find(c => c.name === i.commandName);
        if (command) await command.execute(i, true, null);
    }
    
    // Ticket Button Logic
    if (i.isButton() && i.customId === 'open_ticket') {
        const channel = await i.guild.channels.create({
            name: `ticket-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
            ]
        });
        
        const embed = createEmbed(`👋 Greetings, ${i.user.username}`, 'Describe your issue. Staff will arrive shortly.')
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );
        
        await channel.send({ content: `<@${i.user.id}>`, embeds: [embed], components: [row] });
        i.reply({ content: `✅ Ticket opened: ${channel}`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'close_ticket') {
        i.reply('🔒 Closing in 5 seconds...');
        setTimeout(() => i.channel.delete(), 5000);
    }
});

client.login(CONFIG.TOKEN);
