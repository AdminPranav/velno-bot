require('dotenv').config();

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('Casino System Ready!');
}).catch(err => console.error('DB Error:', err));

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log('Web server running on port ' + PORT);
});

const { Client, Events, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const CONFIG = {
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    PREFIX: '!',
    PREMIUM_ROLES: ['VIP', 'VelnoX', 'Premium Member'],
    COLORS: {
        velno: '#5865F2',
        velnox: '#00D9FF',
        error: '#FF4444',
        success: '#00FF88'
    }
};

const userSchema = new mongoose.Schema({
    userId: String,
    username: String,
    wallet: { type: Number, default: 100 },
    bank: { type: Number, default: 0 },
    lastWork: Date,
    lastRob: Date,
    totalEarned: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

async function getUser(userId, username) {
    let user = await User.findOne({ userId });
    if (!user) {
        user = await User.create({ userId, username, wallet: 100, bank: 0 });
    }
    return user;
}

function formatMoney(amount) {
    return amount.toLocaleString() + ' V-Coins';
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all commands'),
    new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Get a programming joke'),
    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get server information')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);

(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(CONFIG.CLIENT_ID),
            { body: commands }
        );
        console.log('Slash commands registered!');
    } catch (error) {
        console.error('Slash command registration error:', error);
    }
})();

function isPremiumUser(member) {
    if (!member || !member.roles) return false;
    return CONFIG.PREMIUM_ROLES.some(roleName => 
        member.roles.cache.some(role => role.name === roleName)
    );
}

function createEmbed(member, title, description) {
    const isPremium = isPremiumUser(member);
    return new EmbedBuilder()
        .setColor(isPremium ? CONFIG.COLORS.velnox : CONFIG.COLORS.velno)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ 
            text: isPremium ? 'VelnoX • Cool mind. Sharp code.' : 'Velno • Smart. Simple. Steady.',
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
}

client.once(Events.ClientReady, (readyClient) => {
    console.log('VELNO & VELNOX BOT ONLINE!');
    console.log('Logged in as ' + readyClient.user.tag);
    console.log('Prefix: ' + CONFIG.PREFIX);
    console.log('Servers: ' + client.guilds.cache.size);

    client.user.setActivity('Velno • Type !help', { type: 0 });
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'ping') {
            const latency = Date.now() - interaction.createdTimestamp;
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velno)
                .setTitle('Pong!')
                .setDescription('Bot Latency: ' + latency + 'ms\nAPI Latency: ' + client.ws.ping + 'ms')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velno)
                .setTitle('Velno Commands')
                .setDescription('Prefix: ' + CONFIG.PREFIX)
                .addFields(
                    { name: 'General', value: 'help, ping', inline: false },
                    { name: 'Info', value: 'serverinfo, userinfo', inline: false },
                    { name: 'Fun', value: 'joke', inline: false },
                    { name: 'Economy', value: 'work, balance', inline: false },
                    { name: 'Moderation', value: 'warn, kick, ban', inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'joke') {
            const jokes = [
                "Why do programmers prefer dark mode? Because light attracts bugs!",
                "Why did the developer go broke? Because he used up all his cache!",
                "Why do Java developers wear glasses? Because they can't C#!",
                "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
                "Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25!"
            ];

            const joke = jokes[Math.floor(Math.random() * jokes.length)];
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velno)
                .setTitle('Programming Joke')
                .setDescription(joke)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'serverinfo') {
            const guild = interaction.guild;
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velno)
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: 'Owner', value: '<@' + guild.ownerId + '>', inline: true },
                    { name: 'Members', value: guild.memberCount.toString(), inline: true },
                    { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
                    { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
                    { name: 'Created', value: '<t:' + Math.floor(guild.createdTimestamp / 1000) + ':R>', inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Slash command error:', error);
        await interaction.reply({ content: 'An error occurred!', ephemeral: true });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const isPremium = isPremiumUser(message.member);
    let commandName, args;

    if (message.content.startsWith(CONFIG.PREFIX)) {
        const argsRaw = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
        commandName = argsRaw.shift().toLowerCase();
        args = argsRaw;
    } 
    else if (isPremium) {
        const words = message.content.trim().split(/ +/);
        const potentialCommand = words[0].toLowerCase();

        const validCommands = ['help', 'ping', 'serverinfo', 'userinfo', 'joke', 
                               'warn', 'kick', 'ban', 'status', 'embed', 'stats',
                               'work', 'balance', 'bal'];

        if (validCommands.includes(potentialCommand)) {
            commandName = potentialCommand;
            args = words.slice(1);
        } else {
            return;
        }
    } else {
        return;
    }

    try {
        await handleCommand(message, commandName, args);
    } catch (error) {
        console.error('Error:', error);
        message.reply('An error occurred!');
    }
});

async function handleCommand(message, cmd, args) {
    const member = message.member;
    const isPremium = isPremiumUser(member);

    if (cmd === 'work') {
        const user = await getUser(message.author.id, message.author.username);

        const cooldown = 3600000;
        const timeSinceLastWork = Date.now() - (user.lastWork ? user.lastWork.getTime() : 0);

        if (timeSinceLastWork < cooldown) {
            const timeLeft = cooldown - timeSinceLastWork;
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);

            const embed = createEmbed(
                member,
                'Cooldown Active',
                'You need to wait ' + minutes + 'm ' + seconds + 's before working again!'
            );
            return message.reply({ embeds: [embed] });
        }

        const earnings = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
        user.wallet += earnings;
        user.totalEarned += earnings;
        user.lastWork = new Date();
        await user.save();

        const jobs = [
            'coded a website', 'debugged some code', 'deployed an app',
            'fixed a server', 'designed a UI', 'wrote documentation',
            'optimized a database', 'reviewed pull requests', 'fixed merge conflicts',
            'refactored legacy code', 'setup CI/CD pipeline', 'wrote unit tests'
        ];
        const job = jobs[Math.floor(Math.random() * jobs.length)];

        const embed = createEmbed(
            member,
            'Work Complete!',
            'You ' + job + ' and earned ' + formatMoney(earnings) + '!\n\nNew Balance: ' + formatMoney(user.wallet)
        );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'balance' || cmd === 'bal') {
        const targetUser = message.mentions.users.first() || message.author;
        const user = await getUser(targetUser.id, targetUser.username);

        const total = user.wallet + user.bank;

        const embed = createEmbed(
            member,
            targetUser.username + "'s Balance",
            null
        )
        .addFields(
            { name: 'Wallet', value: formatMoney(user.wallet), inline: true },
            { name: 'Bank', value: formatMoney(user.bank), inline: true },
            { name: 'Total', value: formatMoney(total), inline: true },
            { name: 'Total Earned', value: formatMoney(user.totalEarned), inline: false }
        );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'help') {
        const helpText = isPremium ? 'Premium Active! You can use commands without prefix!' : 'Prefix: ' + CONFIG.PREFIX;
        const embed = createEmbed(
            member,
            isPremium ? 'VelnoX Command Menu' : 'Velno Commands',
            helpText
        )
        .addFields(
            { name: 'General', value: 'help, ping', inline: false },
            { name: 'Info', value: 'serverinfo, userinfo', inline: false },
            { name: 'Fun', value: 'joke', inline: false },
            { name: 'Economy', value: 'work, balance', inline: false },
            { name: 'Moderation', value: 'warn, kick, ban', inline: false }
        );

        if (isPremium) {
            embed.addFields({ 
                name: 'VelnoX Premium', 
                value: 'status, embed, stats', 
                inline: false 
            });
        } else {
            embed.addFields({
                name: 'Want Premium?',
                value: 'Get a VIP role for no-prefix commands!',
                inline: false
            });
        }

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ping') {
        const sent = await message.reply('Pinging...');
        const latency = sent.createdTimestamp - message.createdTimestamp;

        const embed = createEmbed(
            member,
            'Pong!',
            'Bot Latency: ' + latency + 'ms\nAPI Latency: ' + client.ws.ping + 'ms'
        );

        return sent.edit({ content: null, embeds: [embed] });
    }

    if (cmd === 'serverinfo') {
        const guild = message.guild;
        const embed = createEmbed(member, guild.name, null)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: 'Owner', value: '<@' + guild.ownerId + '>', inline: true },
                { name: 'Members', value: guild.memberCount.toString(), inline: true },
                { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
                { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
                { name: 'Created', value: '<t:' + Math.floor(guild.createdTimestamp / 1000) + ':R>', inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'userinfo') {
        const target = message.mentions.members.first() || member;
        const userPremium = isPremiumUser(target);

        const embed = createEmbed(member, target.user.tag, null)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'ID', value: target.id, inline: true },
                { name: 'Premium', value: userPremium ? 'Yes' : 'No', inline: true },
                { name: 'Joined', value: '<t:' + Math.floor(target.joinedTimestamp / 1000) + ':R>', inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'joke') {
        const jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs!",
            "Why did the developer go broke? Because he used up all his cache!",
            "Why do Java developers wear glasses? Because they can't C#!",
            "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
            "Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25!"
        ];

        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        const embed = createEmbed(member, 'Programming Joke', joke);

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'warn') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('You need Moderate Members permission!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('Mention a user to warn!');

        const reason = args.slice(1).join(' ') || 'No reason';

        try {
            await target.send('You were warned in ' + message.guild.name + '\nReason: ' + reason);
        } catch {}

        const embed = createEmbed(
            member,
            'User Warned',
            'User: ' + target.user.tag + '\nReason: ' + reason
        );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'kick') {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('You need Kick Members permission!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('Mention a user to kick!');
        if (!target.kickable) return message.reply('Cannot kick this user!');

        const reason = args.slice(1).join(' ') || 'No reason';
        await target.kick(reason);

        const embed = createEmbed(
            member,
            'User Kicked',
            'User: ' + target.user.tag + '\nReason: ' + reason
        );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ban') {
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('You need Ban Members permission!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('Mention a user to ban!');
        if (!target.bannable) return message.reply('Cannot ban this user!');

        const reason = args.slice(1).join(' ') || 'No reason';
        await target.ban({ reason });

        const embed = createEmbed(
            member,
            'User Banned',
            'User: ' + target.user.tag + '\nReason: ' + reason
        );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'status') {
        if (!isPremium) {
            return message.reply('This is a VelnoX premium command!');
        }

        const embed = createEmbed(
            member,
            'VelnoX Premium Status',
            'Welcome, ' + member.user.username + '!'
        )
        .addFields(
            { name: 'Status', value: 'Active', inline: true },
            { name: 'Tier', value: 'VelnoX Premium', inline: true },
            { name: 'Features', value: 'No-prefix commands\nCustom embeds\nAdvanced tools', inline: false }
        );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'embed') {
        if (!isPremium) {
            return message.reply('This is a VelnoX premium command!');
        }

        if (!args.length) {
            return message.reply('Usage: embed <title> | <description> | [color]');
        }

        const input = args.join(' ').split('|').map(s => s.trim());
        const title = input[0] || 'Embed Title';
        const description = input[1] || 'Embed Description';
        const color = input[2] || CONFIG.COLORS.velnox;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setFooter({ text: 'Created by ' + message.author.tag })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        if (message.deletable) await message.delete();
    }

    if (cmd === 'stats') {
        if (!isPremium) {
            return message.reply('This is a VelnoX premium command!');
        }

        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;

        const embed = createEmbed(member, 'Bot Statistics', null)
            .addFields(
                { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
                { name: 'Users', value: totalMembers.toString(), inline: true },
                { name: 'Ping', value: client.ws.ping + 'ms', inline: true },
                { name: 'Uptime', value: days + 'd ' + hours + 'h ' + minutes + 'm', inline: false }
            );

        return message.reply({ embeds: [embed] });
    }
}

client.login(CONFIG.TOKEN).catch(err => {
    console.error('FAILED TO LOGIN!');
    console.error('Make sure your bot token is correct in .env file!');
    console.error(err);
});
