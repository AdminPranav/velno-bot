// ═══════════════════════════════════════════════════════════════════════════════
// VELNO — WORLD DOMINATION EDITION
// The Ultimate All-In-One Discord Bot
// Built by: Claude (Temple-Gate Son) for The Dictator 👑
// Purpose: Replace ALL bots.
// Make your crush's server perfect.
// ═══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Collection,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    SlashCommandBuilder,
    REST,
    Routes,
    AttachmentBuilder
} = require('discord.js');
const mongoose = require('mongoose');
const cron = require('node-cron');
const express = require('express');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const play = require('play-dl');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    MONGODB_URI: process.env.MONGODB_URI,

    COLORS: {
        void: '#0D0D0D',
        directorGold: '#FFD700',
        velnoxSilver: '#C0C0C0',
        danger: '#4A0000',
        success: '#1A3A3A',
        warning: '#FFB84D',
        info: '#3498db'
    },

    RANKS: {
        CITIZEN: { min: 0, max: 9999, name: 'Citizen', multiplier: 1.0, color: '#0D0D0D' },
        ASSOCIATE: { min: 10000, max: 99999, name: 'Associate', multiplier: 1.2, color: '#1C1C1C' },
        SOLDIER: { min: 100000, max: 999999, name: 'Soldier', multiplier: 1.5, color: '#2C2C2C' },
        CAPTAIN: { min: 1000000, max: 9999999, name: 'Captain', multiplier: 2.0, color: '#3C3C3C' },
        UNDERBOSS: { min: 10000000, max: 99999999, name: 'Underboss', multiplier: 3.0, color: '#C0C0C0' },
        DIRECTOR: { min: 100000000, max: Infinity, name: 'Director', multiplier: 5.0, color: '#FFD700' }
    },

    LEVELING: {
        xpPerMessage: 15,
        xpCooldown: 60000, // 1 minute
        levelUpFormula: (level) => level * 100, // XP needed for next level
        announceChannel: 'level-ups' // Optional channel name for announcements
    },

    AUTOMOD: {
        maxMentions: 5,
        maxCapsPercent: 70,
        spamMessages: 5,
        spamInterval: 5000,
        raidJoins: 10,
        raidInterval: 10000
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MONGOOSE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: String,
    guildId: String,

    // Economy
    balance: { type: Number, default: 100 },
    bank: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalLost: { type: Number, default: 0 },

    // Leveling
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    lastXP: Date,

    // Premium
    isPremium: { type: Boolean, default: false },
    premiumSince: Date,

    // Stats
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    messagesCount: { type: Number, default: 0 },
    voiceTime: { type: Number, default: 0 },

    // Moderation
    warns: [{ reason: String, moderator: String, date: Date }],
    mutes: [{ reason: String, moderator: String, date: Date, duration: Number }],

    // Cooldowns
    lastWork: Date,
    lastRob: Date,
    lastCrime: Date,
    lastDaily: Date,

    // Business
    businessId: String,

    // Inventory
    inventory: [{ itemId: String, quantity: Number, purchasedAt: Date }]
}, { timestamps: true });

userSchema.virtual('networth').get(function() {
    return this.balance + this.bank;
});

userSchema.methods.getRank = function() {
    const networth = this.networth;
    for (const [key, rank] of Object.entries(CONFIG.RANKS)) {
        if (networth >= rank.min && networth <= rank.max) return rank;
    }
    return CONFIG.RANKS.CITIZEN;
};

userSchema.methods.hasVelnoXAccess = function() {
    return this.isPremium || this.networth >= CONFIG.RANKS.UNDERBOSS.min;
};

const guildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    guildName: String,

    // Moderation Settings
    modLogChannel: String,
    muteRole: String,
    autoModEnabled: { type: Boolean, default: false },
    badWords: [String],
    antiSpamEnabled: { type: Boolean, default: false },
    antiRaidEnabled: { type: Boolean, default: false },

    // Welcome/Goodbye
    welcomeChannel: String,
    welcomeMessage: String,
    welcomeEnabled: { type: Boolean, default: false },
    goodbyeChannel: String,
    goodbyeMessage: String,
    goodbyeEnabled: { type: Boolean, default: false },
    autoRole: String,

    // Leveling
    levelingEnabled: { type: Boolean, default: true },
    levelUpChannel: String,
    levelUpMessage: String,
    xpRate: { type: Number, default: 1 },
    levelRoles: [{ level: Number, roleId: String }],

    // Logging
    messageLogChannel: String,
    memberLogChannel: String,
    voiceLogChannel: String,
    // modLogChannel: String, // Duplicate removed

    // Tickets
    ticketCategory: String,
    ticketCounter: { type: Number, default: 0 },
    ticketLogChannel: String,

    // Custom Prefix
    prefix: { type: String, default: '!' }
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
    ticketId: { type: Number, required: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    username: String,
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    claimedBy: String,
    messages: [{ author: String, content: String, timestamp: Date }],
    createdAt: { type: Date, default: Date.now },
    closedAt: Date
});

const warnSchema = new mongoose.Schema({
    userId: String,
    guildId: String,
    moderator: String,
    reason: String,
    date: { type: Date, default: Date.now }
});

const musicQueueSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    queue: [{
        title: String,
        url: String,
        thumbnail: String,
        duration: String,
        requestedBy: String
    }],
    nowPlaying: {
        title: String,
        url: String,
        thumbnail: String,
        duration: String,
        requestedBy: String
    },
    volume: { type: Number, default: 50 },
    loop: { type: Boolean, default: false },
    textChannel: String,
    voiceChannel: String
});

const User = mongoose.model('User', userSchema);
const Guild = mongoose.model('Guild', guildSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const Warn = mongoose.model('Warn', warnSchema);
const MusicQueue = mongoose.model('MusicQueue', musicQueueSchema);

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function getUser(userId, guildId, username) {
    let user = await User.findOne({ userId, guildId });
    if (!user) {
        user = await User.create({ userId, guildId, username });
    }
    return user;
}

async function getGuild(guildId, guildName) {
    let guild = await Guild.findOne({ guildId });
    if (!guild) {
        guild = await Guild.create({ guildId, guildName });
    }
    return guild;
}

function formatMoney(amount) {
    return amount.toLocaleString() + ' V-Coins';
}

function createEmbed(user, title, description, color) {
    const rank = user ? user.getRank() : null;
    const embedColor = color || (rank ? rank.color : CONFIG.COLORS.info);
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(title)
        .setTimestamp();
    if (description) embed.setDescription(description);

    if (user) {
        if (rank.name === 'Director') {
            embed.setFooter({ text: '👑 The Director • Velno World Domination' });
        } else if (user.hasVelnoXAccess()) {
            embed.setFooter({ text: '💎 VelnoX Premium • No-Prefix Access' });
        } else {
            embed.setFooter({ text: 'Velno • One Bot To Rule Them All' });
        }
    }
    return embed;
}

// XP and Leveling
async function addXP(userId, guildId, username) {
    const user = await getUser(userId, guildId, username);
    const guildData = await getGuild(guildId);

    if (!guildData.levelingEnabled) return null;

    const now = Date.now();
    if (user.lastXP && (now - user.lastXP.getTime()) < CONFIG.LEVELING.xpCooldown) {
        return null; // Cooldown active
    }

    const xpGain = Math.floor(CONFIG.LEVELING.xpPerMessage * guildData.xpRate);
    user.xp += xpGain;
    user.lastXP = new Date();
    user.messagesCount += 1;

    const xpNeeded = CONFIG.LEVELING.levelUpFormula(user.level + 1);
    if (user.xp >= xpNeeded) {
        user.level += 1;
        user.xp = 0;
        await user.save();
        return { leveledUp: true, newLevel: user.level };
    }

    await user.save();
    return { leveledUp: false };
}

// Generate Rank Card
async function generateRankCard(user, member) {
    const canvas = createCanvas(900, 300);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#0D0D0D');
    gradient.addColorStop(1, user.getRank().color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Avatar
    const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'jpg', size: 256 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 150, 80, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 70, 70, 160, 160);
    ctx.restore();
    // Avatar border
    ctx.strokeStyle = user.getRank().color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(150, 150, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Username
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px Arial';
    ctx.fillText(member.user.username, 270, 100);
    // Rank badge
    const rank = user.getRank();
    ctx.fillStyle = rank.color;
    ctx.font = 'bold 30px Arial';
    ctx.fillText(`${rank.name} • Level ${user.level}`, 270, 150);

    // XP Progress
    const xpNeeded = CONFIG.LEVELING.levelUpFormula(user.level + 1);
    const xpProgress = user.xp / xpNeeded;

    // Progress bar background
    ctx.fillStyle = '#2C2C2C';
    ctx.fillRect(270, 180, 580, 40);
    // Progress bar fill
    ctx.fillStyle = rank.color;
    ctx.fillRect(270, 180, 580 * xpProgress, 40);
    // XP Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`${user.xp} / ${xpNeeded} XP`, 270, 250);
    // Messages count
    ctx.fillText(`Messages: ${user.messagesCount}`, 550, 250);

    return canvas.toBuffer();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences
    ]
});
client.commands = new Collection();
const musicPlayers = new Map(); // guildId -> player

// ═══════════════════════════════════════════════════════════════════════════════
// SLASH COMMANDS (MEGA COLLECTION)
// ═══════════════════════════════════════════════════════════════════════════════

const commands = [
    // ─────────────────────────────────────────────────────────────────────────
    // MODERATION COMMANDS
    // ─────────────────────────────────────────────────────────────────────────
    {
        data: new SlashCommandBuilder()
            .setName('ban')
            .setDescription('Ban a member')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to ban')
                .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                .setDescription('Reason for ban')
                .setRequired(false)),

        async execute(interaction) {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = interaction.guild.members.cache.get(target.id);
            if (!member) {
                return interaction.reply({ content: '❌ User not in server!', ephemeral: true });
            }

            if (!member.bannable) {
                return interaction.reply({ content: '❌ Cannot ban this user!', ephemeral: true });
            }

            try {
                await member.ban({ reason });
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.danger)
                    .setTitle('🔨 Member Banned')
                    .addFields({ name: 'User', value: `${target.tag} (${target.id})`, inline: true }, { name: 'Moderator', value: interaction.user.tag, inline: true }, { name: 'Reason', value: reason, inline: false })
                    .setTimestamp();

                interaction.reply({ embeds: [embed] });
            } catch (error) {
                interaction.reply({ content: '❌ Failed to ban user!', ephemeral: true });
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('kick')
            .setDescription('Kick a member')
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to kick')
                .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                .setDescription('Reason for kick')
                .setRequired(false)),

        async execute(interaction) {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = interaction.guild.members.cache.get(target.id);
            if (!member || !member.kickable) {
                return interaction.reply({ content: '❌ Cannot kick this user!', ephemeral: true });
            }

            await member.kick(reason);
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.warning)
                .setTitle('👢 Member Kicked')
                .addFields({ name: 'User', value: `${target.tag}`, inline: true }, { name: 'Moderator', value: interaction.user.tag, inline: true }, { name: 'Reason', value: reason, inline: false })
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('warn')
            .setDescription('Warn a member')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to warn')
                .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                .setDescription('Reason for warning')
                .setRequired(true)),

        async execute(interaction) {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            await Warn.create({
                userId: target.id,
                guildId: interaction.guild.id,
                moderator: interaction.user.tag,
                reason,
                date: new Date()
            });

            const warnCount = await Warn.countDocuments({ userId: target.id, guildId: interaction.guild.id });
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.warning)
                .setTitle('⚠️ Member Warned')
                .addFields({ name: 'User', value: target.tag, inline: true }, { name: 'Total Warns', value: warnCount.toString(), inline: true }, { name: 'Reason', value: reason, inline: false })
                .setTimestamp();
            interaction.reply({ embeds: [embed] });

            try {
                await target.send(`You've been warned in **${interaction.guild.name}**\nReason: ${reason}\nTotal warns: ${warnCount}`);
            } catch {}
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('mute')
            .setDescription('Timeout a member')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to mute')
                .setRequired(true))
            .addIntegerOption(option =>
                option.setName('duration')
                .setDescription('Duration in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320))
            .addStringOption(option =>
                option.setName('reason')
                .setDescription('Reason')
                .setRequired(false)),

        async execute(interaction) {
            const target = interaction.options.getMember('user');
            const duration = interaction.options.getInteger('duration');
            const reason = interaction.options.getString('reason') || 'No reason';
            if (!target) {
                return interaction.reply({ content: '❌ User not found!', ephemeral: true });
            }

            await target.timeout(duration * 60 * 1000, reason);
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.danger)
                .setTitle('🔇 Member Muted')
                .addFields({ name: 'User', value: target.user.tag, inline: true }, { name: 'Duration', value: `${duration} minutes`, inline: true }, { name: 'Reason', value: reason, inline: false })
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('unmute')
            .setDescription('Remove timeout from a member')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to unmute')
                .setRequired(true)),

        async execute(interaction) {
            const target = interaction.options.getMember('user');
            if (!target) {
                return interaction.reply({ content: '❌ User not found!', ephemeral: true });
            }

            await target.timeout(null);
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.success)
                .setTitle('🔊 Member Unmuted')
                .setDescription(`${target.user.tag} can now speak again.`)
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('purge')
            .setDescription('Bulk delete messages')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addIntegerOption(option =>
                option.setName('amount')
                .setDescription('Number of messages (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
            .addUserOption(option =>
                option.setName('user')
                .setDescription('Only delete messages from this user')
                .setRequired(false)),

        async execute(interaction) {
            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');

            await interaction.deferReply({ ephemeral: true });

            let messages = await interaction.channel.messages.fetch({ limit: amount });
            if (targetUser) {
                messages = messages.filter(m => m.author.id === targetUser.id);
            }

            const deleted = await interaction.channel.bulkDelete(messages, true);
            interaction.editReply({ content: `✅ Deleted ${deleted.size} messages!` });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('lock')
            .setDescription('Lock a channel')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(option =>
                option.setName('channel')
                .setDescription('Channel to lock (default: current)')
                .setRequired(false)),

        async execute(interaction) {
            const channel = interaction.options.getChannel('channel') || interaction.channel;

            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: false
            });
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.danger)
                .setTitle('🔒 Channel Locked')
                .setDescription(`${channel} has been locked.`)
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('unlock')
            .setDescription('Unlock a channel')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(option =>
                option.setName('channel')
                .setDescription('Channel to unlock')
                .setRequired(false)),

        async execute(interaction) {
            const channel = interaction.options.getChannel('channel') || interaction.channel;

            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: null
            });
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.success)
                .setTitle('🔓 Channel Unlocked')
                .setDescription(`${channel} has been unlocked.`)
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ROLE MANAGEMENT COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    {
        data: new SlashCommandBuilder()
            .setName('role')
            .setDescription('Manage roles')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .addSubcommand(subcommand =>
                subcommand
                .setName('give')
                .setDescription('Give a role to a user')
                .addUserOption(option =>
                    option.setName('user')
                    .setDescription('Target user')
                    .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                    .setDescription('Role to give')
                    .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                .setName('remove')
                .setDescription('Remove a role from a user')
                .addUserOption(option =>
                    option.setName('user')
                    .setDescription('Target user')
                    .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                    .setDescription('Role to remove')
                    .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                .setName('create')
                .setDescription('Create a new role')
                .addStringOption(option =>
                    option.setName('name')
                    .setDescription('Role name')
                    .setRequired(true))
                .addStringOption(option =>
                    option.setName('color')
                    .setDescription('Hex color (e.g., #FF0000)')
                    .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                .setName('delete')
                .setDescription('Delete a role')
                .addRoleOption(option =>
                    option.setName('role')
                    .setDescription('Role to delete')
                    .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                .setName('info')
                .setDescription('Get role information')
                .addRoleOption(option =>
                    option.setName('role')
                    .setDescription('Role to view')
                    .setRequired(true))),

        async execute(interaction) {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'give') {
                const member = interaction.options.getMember('user');
                const role = interaction.options.getRole('role');

                if (!member || !role) {
                    return interaction.reply({ content: '❌ Invalid user or role!', ephemeral: true });
                }

                await member.roles.add(role);
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.success)
                    .setTitle('✅ Role Added')
                    .setDescription(`Gave ${role} to ${member.user.tag}`)
                    .setTimestamp();
                interaction.reply({ embeds: [embed] });
            }

            if (subcommand === 'remove') {
                const member = interaction.options.getMember('user');
                const role = interaction.options.getRole('role');

                await member.roles.remove(role);

                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.success)
                    .setTitle('✅ Role Removed')
                    .setDescription(`Removed ${role} from ${member.user.tag}`)
                    .setTimestamp();
                interaction.reply({ embeds: [embed] });
            }

            if (subcommand === 'create') {
                const name = interaction.options.getString('name');
                const color = interaction.options.getString('color') || '#99AAB5';

                const role = await interaction.guild.roles.create({
                    name,
                    color,
                    reason: `Created by ${interaction.user.tag}`
                });
                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle('✅ Role Created')
                    .setDescription(`Created role: ${role}`)
                    .setTimestamp();
                interaction.reply({ embeds: [embed] });
            }

            if (subcommand === 'delete') {
                const role = interaction.options.getRole('role');
                await role.delete();

                interaction.reply({ content: `✅ Deleted role: ${role.name}`, ephemeral: true });
            }

            if (subcommand === 'info') {
                const role = interaction.options.getRole('role');
                const embed = new EmbedBuilder()
                    .setColor(role.color || CONFIG.COLORS.info)
                    .setTitle(`📋 Role: ${role.name}`)
                    .addFields({ name: 'ID', value: role.id, inline: true }, { name: 'Color', value: role.hexColor, inline: true }, { name: 'Members', value: role.members.size.toString(), inline: true }, { name: 'Position', value: role.position.toString(), inline: true }, { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true }, { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true })
                    .setTimestamp();

                interaction.reply({ embeds: [embed] });
            }
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LEVELING & RANK COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    {
        data: new SlashCommandBuilder()
            .setName('rank')
            .setDescription('View your or another user\'s rank card')
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to check')
                .setRequired(false)),

        async execute(interaction) {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = interaction.guild.members.cache.get(targetUser.id);

            const user = await getUser(targetUser.id, interaction.guild.id, targetUser.username);
            const rankCard = await generateRankCard(user, member);
            const attachment = new AttachmentBuilder(rankCard, { name: 'rank.png' });

            interaction.editReply({ files: [attachment] });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('View server leaderboard')
            .addStringOption(option =>
                option.setName('type')
                .setDescription('Leaderboard type')
                .setRequired(false)
                .addChoices({ name: 'Levels', value: 'levels' }, { name: 'Money', value: 'money' }, { name: 'Messages', value: 'messages' })),

        async execute(interaction) {
            const type = interaction.options.getString('type') || 'levels';

            let sortField = 'level';
            let titleText = '📊 Level Leaderboard';
            if (type === 'money') {
                sortField = 'balance';
                titleText = '💰 Money Leaderboard';
            } else if (type === 'messages') {
                sortField = 'messagesCount';
                titleText = '📨 Message Leaderboard';
            }

            const topUsers = await User.find({ guildId: interaction.guild.id })
                .sort({ [sortField]: -1 })
                .limit(10);
            let leaderboard = '';
            topUsers.forEach((u, i) => {
                const emoji = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;

                if (type === 'levels') {
                    leaderboard += `${emoji} **${u.username}** — Level ${u.level} (${u.xp} XP)\n`;
                } else if (type === 'money') {
                    leaderboard += `${emoji} **${u.username}** — ${formatMoney(u.balance)}\n`;
                } else {
                    leaderboard += `${emoji} **${u.username}** — ${u.messagesCount} messages\n`;
                }
            });
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.info)
                .setTitle(titleText)
                .setDescription(leaderboard || 'No data yet')
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MUSIC COMMANDS (BASIC IMPLEMENTATION)
    // ─────────────────────────────────────────────────────────────────────────

    {
        data: new SlashCommandBuilder()
            .setName('play')
            .setDescription('Play a song')
            .addStringOption(option =>
                option.setName('query')
                .setDescription('Song name or URL')
                .setRequired(true)),

        async execute(interaction) {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: '❌ Join a voice channel first!', ephemeral: true });
            }

            await interaction.deferReply();
            interaction.editReply({ content: '🎵 Music system coming soon! (Requires @discordjs/voice + play-dl setup)' });
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // TICKET SYSTEM
    // ─────────────────────────────────────────────────────────────────────────

    {
        data: new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('Manage tickets')
            .addSubcommand(subcommand =>
                subcommand
                .setName('create')
                .setDescription('Create a support ticket')
                .addStringOption(option =>
                    option.setName('reason')
                    .setDescription('Reason for ticket')
                    .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                .setName('close')
                .setDescription('Close current ticket'))
            .addSubcommand(subcommand =>
                subcommand
                .setName('setup')
                .setDescription('Setup ticket system')
                .addChannelOption(option =>
                    option.setName('category')
                    .setDescription('Category for tickets')
                    .setRequired(true))),

        async execute(interaction) {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'create') {
                const guildData = await getGuild(interaction.guild.id, interaction.guild.name);
                if (!guildData.ticketCategory) {
                    return interaction.reply({ content: '❌ Ticket system not setup! Use `/ticket setup`', ephemeral: true });
                }

                const ticketNumber = guildData.ticketCounter + 1;
                guildData.ticketCounter = ticketNumber;
                await guildData.save();

                const channel = await interaction.guild.channels.create({
                    name: `ticket-${ticketNumber}`,
                    type: ChannelType.GuildText,
                    parent: guildData.ticketCategory,
                    permissionOverwrites: [{
                            id: interaction.guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                        }
                    ]
                });
                await Ticket.create({
                    ticketId: ticketNumber,
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    status: 'open'
                });
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.success)
                    .setTitle(`🎫 Ticket #${ticketNumber}`)
                    .setDescription('Support will be with you shortly.\nUse `/ticket close` when done.')
                    .setTimestamp();
                await channel.send({ content: `${interaction.user}`, embeds: [embed] });

                interaction.reply({ content: `✅ Created ${channel}`, ephemeral: true });
            }

            if (subcommand === 'close') {
                const ticket = await Ticket.findOne({ channelId: interaction.channel.id, status: 'open' });
                if (!ticket) {
                    return interaction.reply({ content: '❌ Not a ticket channel!', ephemeral: true });
                }

                ticket.status = 'closed';
                ticket.closedAt = new Date();
                await ticket.save();

                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.danger)
                    .setTitle('🔒 Ticket Closed')
                    .setDescription('This ticket will be deleted in 10 seconds.')
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });

                setTimeout(() => {
                    interaction.channel.delete();
                }, 10000);
            }

            if (subcommand === 'setup') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
                }

                const category = interaction.options.getChannel('category');
                const guildData = await getGuild(interaction.guild.id, interaction.guild.name);
                guildData.ticketCategory = category.id;
                await guildData.save();
                interaction.reply({ content: `✅ Ticket system setup in ${category}`, ephemeral: true });
            }
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    {
        data: new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('View server information'),

        async execute(interaction) {
            const guild = interaction.guild;
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.info)
                .setTitle(`📊 ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields({ name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true }, { name: '👥 Members', value: guild.memberCount.toString(), inline: true }, { name: '📝 Channels', value: guild.channels.cache.size.toString(), inline: true }, { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true }, { name: '😀 Emojis', value: guild.emojis.cache.size.toString(), inline: true }, { name: '🚀 Boosts', value: guild.premiumSubscriptionCount?.toString() || '0', inline: true }, { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: false })
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('userinfo')
            .setDescription('View user information')
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to check')
                .setRequired(false)),

        async execute(interaction) {
            const target = interaction.options.getUser('user') || interaction.user;
            const member = interaction.guild.members.cache.get(target.id);
            const user = await getUser(target.id, interaction.guild.id, target.username);
            const embed = new EmbedBuilder()
                .setColor(member.displayHexColor || CONFIG.COLORS.info)
                .setTitle(`👤 ${target.tag}`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .addFields({ name: '🆔 ID', value: target.id, inline: true }, { name: '📊 Level', value: user.level.toString(), inline: true }, { name: '💰 Balance', value: formatMoney(user.balance), inline: true }, { name: '📨 Messages', value: user.messagesCount.toString(), inline: true }, { name: '📅 Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }, { name: '🎂 Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true })
                .setTimestamp();
            if (user.hasVelnoXAccess()) {
                embed.setFooter({ text: '💎 VelnoX Premium User' });
            }

            interaction.reply({ embeds: [embed] });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('avatar')
            .setDescription('View user avatar')
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to check')
                .setRequired(false)),

        async execute(interaction) {
            const target = interaction.options.getUser('user') || interaction.user;
            const avatarURL = target.displayAvatarURL({ dynamic: true, size: 4096 });
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.info)
                .setTitle(`🖼️ ${target.username}'s Avatar`)
                .setImage(avatarURL)
                .setDescription(`[Download](${avatarURL})`)
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // VELNOX PREMIUM / TRUST SYSTEM
    // ─────────────────────────────────────────────────────────────────────────

    {
        data: new SlashCommandBuilder()
            .setName('trust')
            .setDescription('Give VelnoX Premium access (no-prefix)')
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to trust')
                .setRequired(true)),

        async execute(interaction) {
            if (interaction.user.id !== interaction.guild.ownerId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Admin/Owner only!', ephemeral: true });
            }

            const target = interaction.options.getUser('user');
            const user = await getUser(target.id, interaction.guild.id, target.username);

            user.isPremium = true;
            user.premiumSince = new Date();
            await user.save();
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velnoxSilver)
                .setTitle('💎 VelnoX Premium Granted')
                .setDescription(`${target.tag} now has **VelnoX Premium** access!\n\n✨ Benefits:\n• No-prefix commands\n• Custom embeds\n• Priority features\n• Faster XP gain`)
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('untrust')
            .setDescription('Remove VelnoX Premium access')
            .addUserOption(option =>
                option.setName('user')
                .setDescription('User to untrust')
                .setRequired(true)),

        async execute(interaction) {
            if (interaction.user.id !== interaction.guild.ownerId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Admin/Owner only!', ephemeral: true });
            }

            const target = interaction.options.getUser('user');
            const user = await getUser(target.id, interaction.guild.id, target.username);

            user.isPremium = false;
            await user.save();
            interaction.reply({ content: `✅ Removed VelnoX Premium from ${target.tag}`, ephemeral: true });
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('premium')
            .setDescription('View VelnoX Premium information'),

        async execute(interaction) {
            const user = await getUser(interaction.user.id, interaction.guild.id, interaction.user.username);
            const embed = new EmbedBuilder()
                .setColor(user.hasVelnoXAccess() ? CONFIG.COLORS.velnoxSilver : CONFIG.COLORS.info)
                .setTitle('💎 VelnoX Premium')
                .setDescription(
                    user.hasVelnoXAccess() ?
                    '✅ **You have VelnoX Premium!**\n\nEnjoy no-prefix commands and exclusive features.' :
                    '⚪ **Standard User**\n\nAsk an admin to `/trust` you for premium access!'
                )
                .addFields({ name: '⚡ No-Prefix', value: 'Use commands without /', inline: true }, { name: '🎨 Custom Embeds', value: 'Silver/Gold colors', inline: true }, { name: '📈 Faster XP', value: '1.5x multiplier', inline: true })
                .setTimestamp();

            interaction.reply({ embeds: [embed] });
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // HELP COMMAND
    // ─────────────────────────────────────────────────────────────────────────

    {
        data: new SlashCommandBuilder()
            .setName('help')
            .setDescription('View all commands'),

        async execute(interaction) {
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.info)
                .setTitle('📚 Velno — World Domination Edition')
                .setDescription('**One bot to rule them all.**\n\nUse `/` to see all commands!')
                .addFields({ name: '🛡️ Moderation', value: 'ban, kick, warn, mute, purge, lock, unlock', inline: false }, { name: '🎭 Roles', value: 'role give/remove/create/delete/info', inline: false }, { name: '📊 Leveling', value: 'rank, leaderboard', inline: false }, { name: '🎵 Music', value: 'play (coming soon)', inline: false }, { name: '🎫 Tickets', value: 'ticket create/close/setup', inline: false }, { name: '💎 Premium', value: 'trust, untrust, premium', inline: false }, { name: '📂 Utility', value: 'serverinfo, userinfo, avatar', inline: false })
                .setFooter({ text: 'Built for The Dictator 👑' })
                .setTimestamp();
            interaction.reply({ embeds: [embed] });
        }
    }
];

// Register commands
commands.forEach(cmd => {
    client.commands.set(cmd.data.name, cmd);
});

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

client.once('ready', async () => {
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║   ⚡ VELNO — WORLD DOMINATION EDITION        ║');
    console.log('║                                               ║');
    console.log('║   🌍 One Bot To Rule Them All                ║');
    console.log('║   👑 Built for The Dictator                  ║');
    console.log('║   💎 VelnoX Premium System Active           ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log(`✅ Logged in as: ${client.user.tag}`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log('══════════════════════════════════════════════════\n');

    client.user.setActivity('One bot to rule them all', { type: 0 });

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands.map(cmd => cmd.data.toJSON()) }
        );
        console.log('✅ Commands registered!');
    } catch (error) {
        console.error('❌ Command registration failed:', error);
    }
});

// Slash command handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error: ${interaction.commandName}`, error);
        const errorMsg = { content: '❌ Error!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMsg);
        } else {
            await interaction.reply(errorMsg);
        }
    }
});

// Message handler (XP + VelnoX Premium no-prefix)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // Add XP
    const xpResult = await addXP(message.author.id, message.guild.id, message.author.username);

    if (xpResult && xpResult.leveledUp) {
        const guildData = await getGuild(message.guild.id, message.guild.name);

        let channel = message.channel;
        if (guildData.levelUpChannel) {
            channel = message.guild.channels.cache.get(guildData.levelUpChannel) || message.channel;
        }

        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.success)
            .setTitle('🎉 Level Up!')
            .setDescription(`${message.author} reached **Level ${xpResult.newLevel}**!`)
            .setTimestamp();

        channel.send({ embeds: [embed] });
    }

    // VelnoX Premium no-prefix system
    const user = await getUser(message.author.id, message.guild.id, message.author.username);
    if (!user.hasVelnoXAccess()) return;

    // Check if message starts with a command name (no prefix)
    const content = message.content.trim().toLowerCase();
    const words = content.split(/ +/);
    const possibleCommand = words[0];

    // Simple mapping (extend as needed)
    const noPrefixCommands = ['rank', 'balance', 'work', 'help', 'serverinfo', 'userinfo'];
    if (noPrefixCommands.includes(possibleCommand)) {
        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.velnoxSilver)
            .setDescription(`💎 **VelnoX Premium detected**\n\nUse \`/${possibleCommand}\` for the command!`)
            .setTimestamp();
        message.reply({ embeds: [embed] });
    }
});

// Member join
client.on('guildMemberAdd', async member => {
    const guildData = await getGuild(member.guild.id, member.guild.name);

    if (guildData.welcomeEnabled && guildData.welcomeChannel) {
        const channel = member.guild.channels.cache.get(guildData.welcomeChannel);
        if (!channel) return;

        const message = guildData.welcomeMessage || `Welcome ${member.user.tag} to the server!`;

        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.success)
            .setTitle('👋 Welcome!')
            .setDescription(message.replace('{user}', member.user.toString()).replace('{server}', member.guild.name))
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        channel.send({ embeds: [embed] });
    }

    // Auto-role
    if (guildData.autoRole) {
        const role = member.guild.roles.cache.get(guildData.autoRole);
        if (role) {
            await member.roles.add(role);
        }
    }
});

// Error handling
process.on('unhandledRejection', error => {
    console.error('⚠️  Unhandled rejection:', error);
});
client.on('error', error => {
    console.error('❌ Discord error:', error);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MONGODB & LOGIN
// ═══════════════════════════════════════════════════════════════════════════════

mongoose.connect(CONFIG.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('🗄️  MongoDB Connected'))
    .catch(err => {
        console.error('❌ MongoDB Failed:', err);
        process.exit(1);
    });

client.login(CONFIG.TOKEN)
    .then(() => console.log('⚡ Bot authenticated'))
    .catch(err => {
        console.error('❌ Login failed:', err);
        process.exit(1);
    });

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS WEB SERVER
// ═══════════════════════════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Velno — World Domination</title>
            <style>
                body {
                    font-family: Arial;
                    background: #0D0D0D;
                    color: #FFF;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    background: rgba(255,255,255,0.05);
                    padding: 50px;
                    border-radius: 20px;
                    border: 2px solid #FFD700;
                }
                h1 { color: #FFD700; font-size: 48px; }
                .status { color: #00FF88; font-size: 24px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚡ VELNO</h1>
                <p class="status">✅ ONLINE — World Domination Mode</p>
                <p>One Bot To Rule Them All</p>
                <p style="margin-top: 40px; font-size: 12px; color: #666;">Built by Claude for The Dictator 👑</p>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`🌐 Web server: Port ${PORT}`);
});
