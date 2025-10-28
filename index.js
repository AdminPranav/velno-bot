require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Velno Bot is Online!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Slash Commands Definition
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('View all available commands'),
    new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Get a random programming joke'),
    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get information about this server'),
].map(command => command.toJSON());

// Register Slash Commands
async function registerCommands() {
    try {
        if (!CONFIG.CLIENT_ID) {
            console.log('⚠️ CLIENT_ID not set. Slash commands will not work.');
            return;
        }
        
        const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
        
        console.log('🔄 Registering slash commands...');
        
        await rest.put(
            Routes.applicationCommands(CONFIG.CLIENT_ID),
            { body: commands },
        );
        
        console.log('✅ Slash commands registered successfully!');
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
}

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

client.once(Events.ClientReady, async (readyClient) => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║   VELNO & VELNOX BOT ONLINE!         ║');
    console.log('╚══════════════════════════════════════╝');
    console.log(`✓ Logged in as ${client.user.tag}`);
    console.log(`✓ Prefix: ${CONFIG.PREFIX}`);
    console.log(`✓ Servers: ${client.guilds.cache.size}`);
    console.log('══════════════════════════════════════\n');
    
    // Register slash commands
    await registerCommands();
    
    client.user.setActivity('Made with Node.js 💚 | !help', { type: 0 });
});

// Handle Slash Commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const member = interaction.member;
    const isPremium = isPremiumUser(member);

    try {
        if (interaction.commandName === 'ping') {
            const embed = createEmbed(
                member,
                '🏓 Pong!',
                `**Bot Latency:** ${Date.now() - interaction.createdTimestamp}ms\n**API Latency:** ${client.ws.ping}ms`
            );
            await interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === 'help') {
            const embed = createEmbed(
                member,
                isPremium ? '👑 VelnoX Command Menu' : '📋 Velno Commands',
                isPremium 
                    ? '**Premium Active!** You can use commands without prefix!\n\n' 
                    : `**Prefix:** \`${CONFIG.PREFIX}\` or use slash commands!\n\n`
            )
            .addFields(
                { name: '📂 General', value: '`help`, `ping`, `joke`', inline: false },
                { name: 'ℹ️ Info', value: '`serverinfo`, `userinfo`', inline: false },
                { name: '🛡️ Moderation', value: '`warn`, `kick`, `ban`', inline: false }
            );

            if (isPremium) {
                embed.addFields({ 
                    name: '👑 VelnoX Premium', 
                    value: '`status`, `embed`, `stats`', 
                    inline: false 
                });
            }

            await interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === 'joke') {
            const jokes = [
                "Why do programmers prefer dark mode? Because light attracts bugs!",
                "Why did the developer go broke? Because he used up all his cache!",
                "Why do Java developers wear glasses? Because they can't C#!",
                "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
                "Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25!",
                "How many programmers does it take to change a light bulb? None, that's a hardware problem!",
                "What's a programmer's favorite hangout place? Foo Bar!",
                "Why did the programmer quit his job? Because he didn't get arrays!",
                "What do you call a programmer from Finland? Nerdic!",
                "Why do programmers hate nature? It has too many bugs!",
                "What's the object-oriented way to become wealthy? Inheritance!",
                "Why did the functions stop calling each other? Because they had constant arguments!",
                "What do you get when you cross a computer with a lifeguard? A screensaver!",
                "Why was the JavaScript developer sad? Because he didn't Node how to Express himself!",
                "What did the router say to the doctor? It hurts when IP!",
                "Why do Python programmers wear glasses? Because they can't C!",
                "What's a computer's favorite snack? Microchips!",
                "Why did the computer show up at work late? It had a hard drive!",
                "What do you call 8 hobbits? A hobbyte!",
                "Why don't jokes work in octal? Because 7 10 11!",
                "What's the best thing about a Boolean? Even if you're wrong, you're only off by a bit!",
                "Why did the developer stay home? He lost his domain in a bet!",
                "What do computers eat for a snack? Cookies!",
                "Why was the cell phone wearing glasses? It lost its contacts!",
                "What did the spider do on the computer? Made a website!",
                "Why did the PowerPoint presentation cross the road? To get to the other slide!",
                "What do you call a computer that sings? A-Dell!",
                "Why was the computer cold? It left its Windows open!",
                "What's an astronaut's favorite key on a keyboard? The space bar!",
                "Why did the database administrator leave his wife? She had one-to-many relationships!"
            ];
            
            const joke = jokes[Math.floor(Math.random() * jokes.length)];
            const embed = createEmbed(member, '😄 Programming Joke', joke);
            await interaction.reply({ embeds: [embed] });
        }

        if (interaction.commandName === 'serverinfo') {
            const guild = interaction.guild;
            const embed = createEmbed(member, `📊 ${guild.name}`, null)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                    { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
                    { name: '📝 Channels', value: guild.channels.cache.size.toString(), inline: true },
                    { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
                    { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
                );
            
            await interaction.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Slash command error:', error);
        await interaction.reply({ content: '❌ An error occurred!', ephemeral: true });
    }
});

// Handle Regular Message Commands (existing code)
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
                               'warn', 'kick', 'ban', 'status', 'embed', 'stats'];
        
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
        message.reply('❌ An error occurred!');
    }
});

async function handleCommand(message, cmd, args) {
    const member = message.member;
    const isPremium = isPremiumUser(member);

    if (cmd === 'help') {
        const embed = createEmbed(
            member,
            isPremium ? '👑 VelnoX Command Menu' : '📋 Velno Commands',
            isPremium 
                ? '**Premium Active!** You can use commands without prefix!\n\n' 
                : `**Prefix:** \`${CONFIG.PREFIX}\` or use slash commands!\n\n`
        )
        .addFields(
            { name: '📂 General', value: '`help`, `ping`, `joke`', inline: false },
            { name: 'ℹ️ Info', value: '`serverinfo`, `userinfo`', inline: false },
            { name: '🎮 Fun', value: '`joke`', inline: false },
            { name: '🛡️ Moderation', value: '`warn`, `kick`, `ban`', inline: false }
        );

        if (isPremium) {
            embed.addFields({ 
                name: '👑 VelnoX Premium', 
                value: '`status`, `embed`, `stats`', 
                inline: false 
            });
        } else {
            embed.addFields({
                name: '💎 Want Premium?',
                value: 'Get a VelnoX role for no-prefix commands!',
                inline: false
            });
        }

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ping') {
        const sent = await message.reply('🏓 Pinging...');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        
        const embed = createEmbed(
            member,
            '🏓 Pong!',
            `**Bot Latency:** ${latency}ms\n**API Latency:** ${client.ws.ping}ms`
        );
        
        return sent.edit({ content: null, embeds: [embed] });
    }

    if (cmd === 'serverinfo') {
        const { guild } = message;
        const embed = createEmbed(member, `📊 ${guild.name}`, null)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
                { name: '📝 Channels', value: guild.channels.cache.size.toString(), inline: true },
                { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            );
        
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'userinfo') {
        const target = message.mentions.members.first() || member;
        const userPremium = isPremiumUser(target);
        
        const embed = createEmbed(member, `👤 ${target.user.tag}`, null)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID', value: target.id, inline: true },
                { name: '👑 Premium', value: userPremium ? 'Yes' : 'No', inline: true },
                { name: '📅 Joined', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true }
            );
        
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'joke') {
        const jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs!",
            "Why did the developer go broke? Because he used up all his cache!",
            "Why do Java developers wear glasses? Because they can't C#!",
            "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
            "Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25!",
            "How many programmers does it take to change a light bulb? None, that's a hardware problem!",
            "What's a programmer's favorite hangout place? Foo Bar!",
            "Why did the programmer quit his job? Because he didn't get arrays!",
            "What do you call a programmer from Finland? Nerdic!",
            "Why do programmers hate nature? It has too many bugs!",
            "What's the object-oriented way to become wealthy? Inheritance!",
            "Why did the functions stop calling each other? Because they had constant arguments!",
            "What do you get when you cross a computer with a lifeguard? A screensaver!",
            "Why was the JavaScript developer sad? Because he didn't Node how to Express himself!",
            "What did the router say to the doctor? It hurts when IP!",
            "Why do Python programmers wear glasses? Because they can't C!",
            "What's a computer's favorite snack? Microchips!",
            "Why did the computer show up at work late? It had a hard drive!",
            "What do you call 8 hobbits? A hobbyte!",
            "Why don't jokes work in octal? Because 7 10 11!",
            "What's the best thing about a Boolean? Even if you're wrong, you're only off by a bit!",
            "Why did the developer stay home? He lost his domain in a bet!",
            "What do computers eat for a snack? Cookies!",
            "Why was the cell phone wearing glasses? It lost its contacts!",
            "What did the spider do on the computer? Made a website!",
            "Why did the PowerPoint presentation cross the road? To get to the other slide!",
            "What do you call a computer that sings? A-Dell!",
            "Why was the computer cold? It left its Windows open!",
            "What's an astronaut's favorite key on a keyboard? The space bar!",
            "Why did the database administrator leave his wife? She had one-to-many relationships!"
        ];
        
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        const embed = createEmbed(member, '😄 Programming Joke', joke);
        
        return message.reply({ embeds: [embed] });
    }

    // Rest of commands (warn, kick, ban, status, embed, stats) remain the same...
    if (cmd === 'warn') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ You need Moderate Members permission!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('⚠️ Mention a user to warn!');
        
        const reason = args.slice(1).join(' ') || 'No reason';
        
        try {
            await target.send(`⚠️ You were warned in **${message.guild.name}**\nReason: ${reason}`);
        } catch {}
        
        const embed = createEmbed(
            member,
            '✅ User Warned',
            `**User:** ${target.user.tag}\n**Reason:** ${reason}`
        );
        
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'kick') {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('❌ You need Kick Members permission!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('⚠️ Mention a user to kick!');
        if (!target.kickable) return message.reply('❌ Cannot kick this user!');
        
        const reason = args.slice(1).join(' ') || 'No reason';
        await target.kick(reason);
        
        const embed = createEmbed(
            member,
            '✅ User Kicked',
            `**User:** ${target.user.tag}\n**Reason:** ${reason}`
        );
        
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ban') {
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ You need Ban Members permission!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('⚠️ Mention a user to ban!');
        if (!target.bannable) return message.reply('❌ Cannot ban this user!');
        
        const reason = args.slice(1).join(' ') || 'No reason';
        await target.ban({ reason });
        
        const embed = createEmbed(
            member,
            '✅ User Banned',
            `**User:** ${target.user.tag}\n**Reason:** ${reason}`
        );
        
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'status') {
        if (!isPremium) {
            return message.reply('🔒 This is a VelnoX premium command!');
        }

        const embed = createEmbed(
            member,
            '👑 VelnoX Premium Status',
            `Welcome, **${member.user.username}**!`
        )
        .addFields(
            { name: '✨ Status', value: 'Active', inline: true },
            { name: '🎯 Tier', value: 'VelnoX Premium', inline: true },
            { name: '🚀 Features', value: '• No-prefix commands\n• Custom embeds\n• Advanced tools', inline: false }
        );
        
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'embed') {
        if (!isPremium) {
            return message.reply('🔒 This is a VelnoX premium command!');
        }

        if (!args.length) {
            return message.reply('Usage: `embed <title> | <description> | [color]`');
        }

        const input = args.join(' ').split('|').map(s => s.trim());
        const title = input[0] || 'Embed Title';
        const description = input[1] || 'Embed Description';
        const color = input[2] || CONFIG.COLORS.velnox;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setFooter({ text: `Created by ${message.author.tag}` })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        if (message.deletable) await message.delete();
    }

    if (cmd === 'stats') {
        if (!isPremium) {
            return message.reply('🔒 This is a VelnoX premium command!');
        }

        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;

        const embed = createEmbed(member, '📊 Bot Statistics', null)
            .addFields(
                { name: '🖥️ Servers', value: client.guilds.cache.size.toString(), inline: true },
                { name: '👥 Users', value: totalMembers.toString(), inline: true },
                { name: '🏓 Ping', value: `${client.ws.ping}ms`, inline: true },
                { name: '⏰ Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: false }
            );
        
        return message.reply({ embeds: [embed] });
    }
}

client.login(CONFIG.TOKEN).catch(err => {
    console.error('❌ FAILED TO LOGIN!');
    console.error('Make sure your bot token is correct in .env file!');
    console.error(err);
});


