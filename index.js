// ═══════════════════════════════════════════════════════════════════════════════
// 👑 VELNO SOVEREIGN EDITION (fixed)
// ═══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const http = require('http');
const {
    Client, GatewayIntentBits, Partials, Events, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField,
    REST, Routes, ChannelType, ActivityType, MessageFlags
} = require('discord.js');
const mongoose = require('mongoose');
const {
    joinVoiceChannel, createAudioPlayer, createAudioResource,
    AudioPlayerStatus, VoiceConnectionStatus, entersState
} = require('@discordjs/voice');
const play = require('play-dl');

// ─── Keep Render happy (it wants an open port on Web Services) ────────────────
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Velno Sovereign is alive');
}).listen(process.env.PORT || 3000);

// ─── Never let one error kill the process ─────────────────────────────────────
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err));

const THEME = {
    GOLD: '#FFD700',
    ERROR: '#DC2626',
    SUCCESS: '#10B981',
    FOOTER: 'Velno Sovereign • Exclusive Systems'
};

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    MONGO_URI: process.env.MONGODB_URI,
    PREFIX: '.'
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE
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

async function getUser(id) {
    let user = await User.findOne({ userId: id });
    if (!user) user = await User.create({ userId: id });
    return user;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT
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
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// FIX: description is optional – setDescription('') throws in discord.js
function createEmbed(title, description, color = THEME.GOLD) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setTimestamp()
        .setFooter({ text: THEME.FOOTER, iconURL: client.user?.displayAvatarURL() });
    if (description) embed.setDescription(description);
    return embed;
}

// Works for both slash interactions and prefix messages
async function reply(i, content, ephemeral = false) {
    const payload = typeof content === 'string' ? { content } : { ...content };

    if (i.isChatInputCommand?.()) {
        if (ephemeral) payload.flags = MessageFlags.Ephemeral;
        if (i.deferred || i.replied) return i.editReply(payload);
        return i.reply(payload);
    }

    // Prefix command: send to channel (command message may already be deleted)
    const sent = await i.channel.send(payload);
    if (ephemeral) setTimeout(() => sent.delete().catch(() => {}), 5000);
    return sent;
}

async function runCommand(command, i, isSlash, args) {
    try {
        await command.execute(i, isSlash, args);
    } catch (err) {
        console.error(`[command:${command.name}]`, err);
        await reply(i, '❌ Something went wrong: ' + err.message).catch(() => {});
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUSIC ENGINE  (one state object per guild)
// ═══════════════════════════════════════════════════════════════════════════════

const guildMusic = new Map(); // guildId -> { queue, player, connection, textChannel }

function cleanupGuild(guildId) {
    const state = guildMusic.get(guildId);
    if (!state) return;
    try { state.player.stop(true); } catch {}
    try { state.connection.destroy(); } catch {}
    guildMusic.delete(guildId);
}

async function playNext(guildId) {
    const state = guildMusic.get(guildId);
    if (!state) return;

    const song = state.queue[0];
    if (!song) return cleanupGuild(guildId);

    try {
        const stream = await play.stream(song.url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        state.player.play(resource);

        const embed = createEmbed('🎶 Now Playing', `[**${song.title}**](${song.url})`)
            .addFields({ name: 'Duration', value: song.duration || 'Live', inline: true });
        if (song.thumbnail) embed.setImage(song.thumbnail);
        state.textChannel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
        console.error('Stream error:', err);
        state.textChannel.send('❌ Could not stream that track. Skipping...').catch(() => {});
        state.queue.shift();
        playNext(guildId);
    }
}

async function getOrCreateState(guild, voiceChannel, textChannel) {
    let state = guildMusic.get(guild.id);
    if (state) return state;

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
    });

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (err) {
        connection.destroy();
        throw new Error('Could not join the voice channel (check bot permissions).');
    }

    const player = createAudioPlayer();
    connection.subscribe(player);

    state = { queue: [], player, connection, textChannel };
    guildMusic.set(guild.id, state);

    // Registered ONCE per guild (the old code stacked listeners per song)
    player.on(AudioPlayerStatus.Idle, () => {
        state.queue.shift();
        playNext(guild.id);
    });
    player.on('error', err => console.error('Player error:', err.message));

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
            ]);
        } catch {
            cleanupGuild(guild.id);
        }
    });

    return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

const commands = [
    {
        name: 'ping',
        description: 'Check bot latency',
        execute: async (i) => reply(i, `🏓 Pong! **${Math.round(client.ws.ping)}ms**`)
    },
    {
        name: 'help',
        description: 'List all commands',
        execute: async (i) => {
            const list = commands.map(c => `**${CONFIG.PREFIX}${c.name}** — ${c.description}`).join('\n');
            await reply(i, { embeds: [createEmbed('📜 Sovereign Commands', list)] });
        }
    },

    // --- MODERATION ---
    {
        name: 'purge',
        description: 'Clear messages instantly',
        options: [{ name: 'amount', type: 4, description: 'Number of messages', required: true }],
        execute: async (i, isSlash, args) => {
            if (!i.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
                return reply(i, '❌ Access Denied.', true);
            const amount = isSlash ? i.options.getInteger('amount') : parseInt(args[0]);
            if (!amount || amount < 1 || amount > 99) return reply(i, '❌ Choose 1–99 messages.', true);

            // Prefix: also remove the command message itself
            const toDelete = amount + (isSlash ? 0 : 1);
            await i.channel.bulkDelete(toDelete, true);
            await reply(i, `🧹 **Systems purged ${amount} messages.**`, true);
        }
    },
    {
        name: 'ban',
        description: 'Banish a user from the realm',
        options: [{ name: 'user', type: 6, description: 'Target', required: true }],
        execute: async (i, isSlash) => {
            if (!i.member.permissions.has(PermissionsBitField.Flags.BanMembers))
                return reply(i, '❌ Access Denied.', true);
            const target = isSlash ? i.options.getUser('user') : i.mentions.users.first();
            if (!target) return reply(i, '❌ Target required.', true);

            await i.guild.members.ban(target.id);
            const embed = createEmbed('🔨 Judgment Executed', `**${target.tag}** has been banished.`, THEME.ERROR);
            await reply(i, { embeds: [embed] });
        }
    },

    // --- ECONOMY ---
    {
        name: 'balance',
        description: 'View your Sovereign Wealth',
        execute: async (i) => {
            const user = await getUser(i.member.id);
            const embed = createEmbed(`🏦 Sovereign Account: ${i.member.user.username}`)
                .addFields(
                    { name: '💵 Liquid Cash', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💎 Vault', value: `$${user.bank.toLocaleString()}`, inline: true },
                    { name: '📊 Net Worth', value: `$${(user.balance + user.bank).toLocaleString()}`, inline: true }
                )
                .setThumbnail(i.member.user.displayAvatarURL());
            await reply(i, { embeds: [embed] });
        }
    },
    {
        name: 'daily',
        description: 'Collect your daily tribute',
        execute: async (i) => {
            const user = await getUser(i.member.id);
            const now = new Date();

            if (user.lastDaily && (now - user.lastDaily) < 86400000)
                return reply(i, '⏳ **Patience.** The treasury reopens tomorrow.');

            // Reset streak if they missed more than 48h
            if (user.lastDaily && (now - user.lastDaily) > 172800000) user.dailyStreak = 0;

            const amount = 2000 + (user.dailyStreak * 100);
            user.balance += amount;
            user.dailyStreak++;
            user.lastDaily = now;
            await user.save();

            const embed = createEmbed('🎁 Tribute Collected',
                `You received **$${amount.toLocaleString()}**.\nStreak: ${user.dailyStreak} days`, THEME.SUCCESS);
            await reply(i, { embeds: [embed] });
        }
    },

    // --- MUSIC ---
    {
        name: 'play',
        description: 'Queue a melody',
        options: [{ name: 'song', type: 3, description: 'URL or Name', required: true }],
        execute: async (i, isSlash, args) => {
            const voiceChannel = i.member.voice?.channel;
            if (!voiceChannel) return reply(i, '❌ Connect to a voice channel first.');

            const query = isSlash ? i.options.getString('song') : args.join(' ');
            if (!query) return reply(i, '❌ Tell me what to play.');

            if (isSlash) await i.deferReply();
            else await i.channel.sendTyping();

            let video;
            if (play.yt_validate(query) === 'video') {
                video = (await play.video_basic_info(query)).video_details;
            } else {
                const results = await play.search(query, { limit: 1 });
                video = results?.[0];
            }
            if (!video) return reply(i, '❌ No melody found.');

            const state = await getOrCreateState(i.guild, voiceChannel, i.channel);
            const wasEmpty = state.queue.length === 0;

            state.queue.push({
                title: video.title,
                url: video.url,
                duration: video.durationRaw,
                thumbnail: video.thumbnails?.[0]?.url
            });

            if (wasEmpty) {
                await reply(i, `🎵 **Starting:** ${video.title}`);
                playNext(i.guild.id);
            } else {
                const embed = createEmbed('📜 Added to Queue', `**${video.title}**\nLength: ${video.durationRaw}`);
                if (video.thumbnails?.[0]?.url) embed.setThumbnail(video.thumbnails[0].url);
                await reply(i, { embeds: [embed] });
            }
        }
    },
    {
        name: 'skip',
        description: 'Skip current song',
        execute: async (i) => {
            const state = guildMusic.get(i.guild.id);
            if (!state || state.queue.length === 0) return reply(i, '❌ Nothing playing.');
            state.player.stop(); // Idle handler moves to the next track
            await reply(i, '⏭️ **Skipped.**');
        }
    },
    {
        name: 'stop',
        description: 'Stop music and clear the queue',
        execute: async (i) => {
            if (!guildMusic.has(i.guild.id)) return reply(i, '❌ Nothing playing.');
            cleanupGuild(i.guild.id);
            await reply(i, '⏹️ **Stopped and left the channel.**');
        }
    },

    // --- LEVELING ---
    {
        name: 'rank',
        description: 'Check your prestige',
        execute: async (i) => {
            const user = await getUser(i.member.id);
            const nextLevel = user.level * 1000;
            const pct = Math.min(user.xp / nextLevel, 1);
            const filled = Math.floor(pct * 10);
            const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);

            const embed = createEmbed(`👑 Prestige: ${i.member.user.username}`)
                .addFields(
                    { name: 'Level', value: `${user.level}`, inline: true },
                    { name: 'XP', value: `${user.xp} / ${nextLevel}`, inline: true },
                    { name: 'Progress', value: `${bar} (${Math.floor(pct * 100)}%)`, inline: false }
                );
            await reply(i, { embeds: [embed] });
        }
    },

    // --- TICKETS ---
    {
        name: 'ticket',
        description: 'Spawn the ticket portal',
        execute: async (i) => {
            if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return reply(i, '❌ Administrators only.', true);

            const embed = createEmbed('📩 Sovereign Support', 'Click below to open a private channel with High Command.')
                .setThumbnail(i.guild.iconURL());
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_ticket').setLabel('Open Ticket')
                    .setStyle(ButtonStyle.Secondary).setEmoji('📩')
            );
            await i.channel.send({ embeds: [embed], components: [row] });
            await reply(i, '✅ Portal opened.', true);
        }
    }
];

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

client.once(Events.ClientReady, async () => {
    console.log('👑 VELNO SOVEREIGN IS ONLINE');

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), {
            body: commands.map(c => ({
                name: c.name,
                description: c.description,
                options: c.options || []
            }))
        });
        console.log('✅ Commands Synced.');
    } catch (e) {
        console.error('Command sync failed:', e);
    }

    client.user.setActivity('over the Empire | .help', { type: ActivityType.Watching });
});

const xpCooldown = new Map(); // userId -> timestamp

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    // Leveling (max once per 30s per user to spare the DB)
    try {
        const last = xpCooldown.get(message.author.id) || 0;
        if (Date.now() - last > 30_000) {
            xpCooldown.set(message.author.id, Date.now());
            const user = await getUser(message.author.id);
            user.xp += Math.floor(Math.random() * 10) + 15;
            if (user.xp >= user.level * 1000) {
                user.level++;
                user.xp = 0;
                message.channel.send(`👑 **Ascension!** <@${message.author.id}> reached **Level ${user.level}**!`).catch(() => {});
            }
            await user.save();
        }
    } catch (err) {
        console.error('Leveling error:', err.message);
    }

    // Prefix commands
    if (!message.content.startsWith(CONFIG.PREFIX)) return;
    const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const command = commands.find(c => c.name === cmdName);
    if (command) await runCommand(command, message, false, args);
});

client.on(Events.InteractionCreate, async i => {
    try {
        if (i.isChatInputCommand()) {
            const command = commands.find(c => c.name === i.commandName);
            if (command) await runCommand(command, i, true, null);
            return;
        }

        if (i.isButton() && i.customId === 'open_ticket') {
            const channel = await i.guild.channels.create({
                name: `ticket-${i.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    {
                        id: i.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ]
            });

            const embed = createEmbed(`👋 Greetings, ${i.user.username}`, 'Describe your issue. Staff will arrive shortly.');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close')
                    .setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            await channel.send({ content: `<@${i.user.id}>`, embeds: [embed], components: [row] });
            await i.reply({ content: `✅ Ticket opened: ${channel}`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (i.isButton() && i.customId === 'close_ticket') {
            if (!i.channel.name.startsWith('ticket-')) return;
            await i.reply('🔒 Closing in 5 seconds...');
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }
    } catch (err) {
        console.error('Interaction error:', err);
        if (!i.replied && !i.deferred) {
            i.reply({ content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STARTUP – connect DB first, then log in
// ═══════════════════════════════════════════════════════════════════════════════

(async () => {
    try {
        await mongoose.connect(CONFIG.MONGO_URI);
        console.log('🗄️  Sovereign DB Connected');
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
    }
    await client.login(CONFIG.TOKEN);
})();
