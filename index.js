require('dotenv').config();

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('💰 Casino System Ready!');
}).catch(err => console.error('❌ DB Error:', err));

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Web server running on port ' + PORT);
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
    },
    COOLDOWNS: {
        work: 3600000,
        rob: 300000,
        crime: 600000,
        steal: 900000
    }
};

const userSchema = new mongoose.Schema({
    userId: String,
    username: String,
    wallet: { type: Number, default: 100 },
    bank: { type: Number, default: 0 },
    lastWork: Date,
    lastRob: Date,
    lastCrime: Date,
    lastSteal: Date,
    totalEarned: { type: Number, default: 0 },
    totalLost: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 }
}, { timestamps: true });

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

function checkCooldown(lastTime, cooldownMs) {
    if (!lastTime) return { ready: true };
    const timePassed = Date.now() - lastTime.getTime();
    if (timePassed < cooldownMs) {
        const timeLeft = cooldownMs - timePassed;
        const hours = Math.floor(timeLeft / 3600000);
        const minutes = Math.floor((timeLeft % 3600000) / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        let timeString = '';
        if (hours > 0) timeString += hours + 'h ';
        if (minutes > 0) timeString += minutes + 'm ';
        if (seconds > 0) timeString += seconds + 's';
        
        return { ready: false, timeLeft: timeString.trim() };
    }
    return { ready: true };
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
        .setName('balance')
        .setDescription('Check your balance'),
    new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn V-Coins')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);

(async () => {
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(CONFIG.CLIENT_ID),
            { body: commands }
        );
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Slash command error:', error);
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
    console.log('╔══════════════════════════════════════╗');
    console.log('║   VELNO & VELNOX BOT ONLINE!         ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('✓ Logged in as ' + readyClient.user.tag);
    console.log('✓ Prefix: ' + CONFIG.PREFIX);
    console.log('✓ Servers: ' + client.guilds.cache.size);
    console.log('══════════════════════════════════════\n');

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
                .setTitle('🏓 Pong!')
                .setDescription('**Bot Latency:** ' + latency + 'ms\n**API Latency:** ' + client.ws.ping + 'ms')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velno)
                .setTitle('📋 Velno Commands')
                .setDescription('**Prefix:** ' + CONFIG.PREFIX)
                .addFields(
                    { name: '📂 General', value: '`help`, `ping`', inline: false },
                    { name: 'ℹ️ Info', value: '`serverinfo`, `userinfo`', inline: false },
                    { name: '🎮 Fun', value: '`joke`, `coinflip`, `dice`', inline: false },
                    { name: '💰 Economy', value: '`work`, `balance`, `deposit`, `withdraw`, `rob`, `crime`, `steal`', inline: false },
                    { name: '🎰 Casino', value: '`coinflip <bet>`, `dice <bet>`', inline: false },
                    { name: '🛡️ Moderation', value: '`warn`, `kick`, `ban`', inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'balance') {
            const user = await getUser(interaction.user.id, interaction.user.username);
            const total = user.wallet + user.bank;

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velno)
                .setTitle('💰 Your Balance')
                .addFields(
                    { name: '💵 Wallet', value: formatMoney(user.wallet), inline: true },
                    { name: '🏦 Bank', value: formatMoney(user.bank), inline: true },
                    { name: '💎 Net Worth', value: formatMoney(total), inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'work') {
            const user = await getUser(interaction.user.id, interaction.user.username);
            const cooldown = checkCooldown(user.lastWork, CONFIG.COOLDOWNS.work);

            if (!cooldown.ready) {
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.COLORS.error)
                    .setTitle('⏰ Cooldown Active')
                    .setDescription('You need to wait **' + cooldown.timeLeft + '** before working again!');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const earnings = Math.floor(Math.random() * 401) + 100;
            user.wallet += earnings;
            user.totalEarned += earnings;
            user.lastWork = new Date();
            await user.save();

            const jobs = [
                'coded a website', 'debugged some code', 'deployed an app',
                'fixed a server', 'designed a UI', 'wrote documentation'
            ];
            const job = jobs[Math.floor(Math.random() * jobs.length)];

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.success)
                .setTitle('💼 Work Complete!')
                .setDescription('You ' + job + ' and earned **' + formatMoney(earnings) + '**!\n\n💰 New Balance: ' + formatMoney(user.wallet));

            await interaction.reply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Slash command error:', error);
        await interaction.reply({ content: '❌ An error occurred!', ephemeral: true });
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
                               'work', 'balance', 'bal', 'deposit', 'dep', 'withdraw', 'with',
                               'rob', 'crime', 'steal', 'coinflip', 'cf', 'dice'];

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
        console.error('Command Error:', error);
        message.reply('❌ An error occurred!');
    }
});

async function handleCommand(message, cmd, args) {
    const member = message.member;
    const isPremium = isPremiumUser(member);

    if (cmd === 'work') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastWork, CONFIG.COOLDOWNS.work);

        if (!cooldown.ready) {
            const embed = createEmbed(member, '⏰ Cooldown Active', 
                'You need to wait **' + cooldown.timeLeft + '** before working again!');
            return message.reply({ embeds: [embed] });
        }

        const earnings = Math.floor(Math.random() * 401) + 100;
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

        const embed = createEmbed(member, '💼 Work Complete!',
            'You ' + job + ' and earned **' + formatMoney(earnings) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'balance' || cmd === 'bal') {
        const targetUser = message.mentions.users.first() || message.author;
        const user = await getUser(targetUser.id, targetUser.username);
        const total = user.wallet + user.bank;

        const embed = createEmbed(member, '💰 ' + targetUser.username + "'s Balance", null)
            .addFields(
                { name: '💵 Wallet', value: formatMoney(user.wallet), inline: true },
                { name: '🏦 Bank', value: formatMoney(user.bank), inline: true },
                { name: '💎 Net Worth', value: formatMoney(total), inline: true },
                { name: '📈 Total Earned', value: formatMoney(user.totalEarned), inline: true },
                { name: '📉 Total Lost', value: formatMoney(user.totalLost), inline: true },
                { name: '🎮 Games Won/Lost', value: user.gamesWon + ' / ' + user.gamesLost, inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'deposit' || cmd === 'dep') {
        const user = await getUser(message.author.id, message.author.username);

        let amount;
        if (args[0] === 'all' || args[0] === 'max') {
            amount = user.wallet;
        } else {
            amount = parseInt(args[0]);
        }

        if (!amount || amount <= 0 || isNaN(amount)) {
            return message.reply('❌ Specify a valid amount or use `all`!');
        }

        if (amount > user.wallet) {
            return message.reply('❌ You only have ' + formatMoney(user.wallet) + ' in your wallet!');
        }

        user.wallet -= amount;
        user.bank += amount;
        await user.save();

        const embed = createEmbed(member, '🏦 Deposit Successful',
            'Deposited **' + formatMoney(amount) + '** to your bank!\n\n💵 Wallet: ' + formatMoney(user.wallet) + '\n🏦 Bank: ' + formatMoney(user.bank));

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'withdraw' || cmd === 'with') {
        const user = await getUser(message.author.id, message.author.username);

        let amount;
        if (args[0] === 'all' || args[0] === 'max') {
            amount = user.bank;
        } else {
            amount = parseInt(args[0]);
        }

        if (!amount || amount <= 0 || isNaN(amount)) {
            return message.reply('❌ Specify a valid amount or use `all`!');
        }

        if (amount > user.bank) {
            return message.reply('❌ You only have ' + formatMoney(user.bank) + ' in your bank!');
        }

        user.bank -= amount;
        user.wallet += amount;
        await user.save();

        const embed = createEmbed(member, '💵 Withdrawal Successful',
            'Withdrew **' + formatMoney(amount) + '** from your bank!\n\n💵 Wallet: ' + formatMoney(user.wallet) + '\n🏦 Bank: ' + formatMoney(user.bank));

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'rob') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastRob, CONFIG.COOLDOWNS.rob);

        if (!cooldown.ready) {
            const embed = createEmbed(member, '⏰ Cooldown Active',
                'The police are watching! Wait **' + cooldown.timeLeft + '** before robbing again!');
            return message.reply({ embeds: [embed] });
        }

        const earnings = Math.floor(Math.random() * 101) + 50;
        user.wallet += earnings;
        user.totalEarned += earnings;
        user.lastRob = new Date();
        await user.save();

        const places = [
            'a gas station', 'a convenience store', 'an old lady', 'a parking meter',
            'a vending machine', 'a street performer', 'a food truck', 'a bus fare box'
        ];
        const place = places[Math.floor(Math.random() * places.length)];

        const embed = createEmbed(member, '🦹 Quick Rob!',
            'You robbed **' + place + '** and got **' + formatMoney(earnings) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'crime') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastCrime, CONFIG.COOLDOWNS.crime);

        if (!cooldown.ready) {
            const embed = createEmbed(member, '⏰ Cooldown Active',
                'You need to lay low! Wait **' + cooldown.timeLeft + '** before committing another crime!');
            return message.reply({ embeds: [embed] });
        }

        const success = Math.random() > 0.3;

        if (success) {
            const earnings = Math.floor(Math.random() * 501) + 200;
            user.wallet += earnings;
            user.totalEarned += earnings;
            user.lastCrime = new Date();
            await user.save();

            const crimes = [
                'hacked a bank', 'stole a luxury car', 'robbed a jewelry store',
                'broke into a mansion', 'hijacked a truck', 'pulled off a heist'
            ];
            const crime = crimes[Math.floor(Math.random() * crimes.length)];

            const embed = createEmbed(member, '🎭 Crime Success!',
                'You **' + crime + '** and got **' + formatMoney(earnings) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));

            return message.reply({ embeds: [embed] });
        } else {
            const fine = Math.floor(Math.random() * 201) + 100;
            const actualFine = Math.min(fine, user.wallet);
            user.wallet -= actualFine;
            user.totalLost += actualFine;
            user.lastCrime = new Date();
            await user.save();

            const embed = createEmbed(member, '🚔 Crime Failed!',
                'You got caught! Police fined you **' + formatMoney(actualFine) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));

            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'steal') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastSteal, CONFIG.COOLDOWNS.steal);

        if (!cooldown.ready) {
            const embed = createEmbed(member, '⏰ Cooldown Active',
                'You need to wait **' + cooldown.timeLeft + '** before stealing again!');
            return message.reply({ embeds: [embed] });
        }

        const target = message.mentions.users.first();
        if (!target) {
            return message.reply('❌ Mention a user to steal from! Usage: `!steal @user`');
        }

        if (target.id === message.author.id) {
            return message.reply('❌ You cannot steal from yourself!');
        }

        if (target.bot) {
            return message.reply('❌ You cannot steal from bots!');
        }

        const targetUser = await getUser(target.id, target.username);

        if (targetUser.wallet < 100) {
            return message.reply('❌ That user is too poor to steal from! (Less than 100 V-Coins)');
        }

        const success = Math.random() > 0.4;

        if (success) {
            const stolenAmount = Math.floor(targetUser.wallet * 0.1);
            targetUser.wallet -= stolenAmount;
            user.wallet += stolenAmount;
            user.totalEarned += stolenAmount;
            targetUser.totalLost += stolenAmount;
            user.lastSteal = new Date();
            await user.save();
            await targetUser.save();

            const embed = createEmbed(member, '💰 Steal Success!',
                'You stole **' + formatMoney(stolenAmount) + '** from ' + target.username + '!\n\n💵 Your Wallet: ' + formatMoney(user.wallet));

            return message.reply({ embeds: [embed] });
        } else {
            const fine = Math.floor(Math.random() * 151) + 50;
            const actualFine = Math.min(fine, user.wallet);
            user.wallet -= actualFine;
            user.totalLost += actualFine;
            user.lastSteal = new Date();
            await user.save();

            const embed = createEmbed(member, '🚨 Steal Failed!',
                'You got caught trying to steal! Lost **' + formatMoney(actualFine) + '**!\n\n💵 Your Wallet: ' + formatMoney(user.wallet));

            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'coinflip' || cmd === 'cf') {
        const user = await getUser(message.author.id, message.author.username);

        if (!args[0]) {
            return message.reply('❌ Usage: `!coinflip <amount>`');
        }

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0) {
            return message.reply('❌ Please specify a valid bet amount!');
        }

        if (bet > user.wallet) {
            return message.reply('❌ You only have ' + formatMoney(user.wallet) + '!');
        }

        const win = Math.random() > 0.5;
        const result = win ? 'Heads' : 'Tails';

        if (win) {
            user.wallet += bet;
            user.totalEarned += bet;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, '🪙 Coinflip - YOU WIN!',
                '**Result:** ' + result + '\n**Won:** ' + formatMoney(bet) + '\n\n💰 New Balance: ' + formatMoney(user.wallet));

            return message.reply({ embeds: [embed] });
        } else {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const embed = createEmbed(member, '🪙 Coinflip - YOU LOST!',
                '**Result:** ' + result + '\n**Lost:** ' + formatMoney(bet) + '\n\n💰 New Balance: ' + formatMoney(user.wallet));

            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'dice') {
        const user = await getUser(message.author.id, message.author.username);

        if (!args[0]) {
            return message.reply('❌ Usage: `!dice <amount>`');
        }

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0) {
            return message.reply('❌ Please specify a valid bet amount!');
        }

        if (bet > user.wallet) {
            return message.reply('❌ You only have ' + formatMoney(user.wallet) + '!');
        }

        const playerRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll = Math.floor(Math.random() * 6) + 1;

        if (playerRoll > botRoll) {
            user.wallet += bet;
            user.totalEarned += bet;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, '🎲 Dice Roll - YOU WIN!',
                '**Your Roll:** ' + playerRoll + '\n**Bot Roll:** ' + botRoll + '\n**Won:** ' + formatMoney(bet) + '\n\n💰 New Balance: ' + formatMoney(user.wallet));

            return message.reply({ embeds: [embed] });
        } else if (playerRoll < botRoll) {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const embed = createEmbed(member, '🎲 Dice Roll - YOU LOST!',
                '**Your Roll:** ' + playerRoll + '\n**Bot Roll:** ' + botRoll + '\n**Lost:** ' + formatMoney(bet) + '\n\n💰 New Balance: ' + formatMoney(user.wallet));

            return message.reply({ embeds: [embed] });
        } else {
            const embed = createEmbed(member, '🎲 Dice Roll - TIE!',
                '**Your Roll:** ' + playerRoll + '\n**Bot Roll:** ' + botRoll + '\n**Result:** Tie! No money won or lost.\n\n💰 Balance: ' + formatMoney(user.wallet));

            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'help') {
        const helpText = isPremium ? '**Premium Active!** You can use commands without prefix!\n\n' : '**Prefix:** ' + CONFIG.PREFIX + '\n\n';
        const embed = createEmbed(member, isPremium ? '👑 VelnoX Command Menu' : '📋 Velno Commands', helpText)
            .addFields(
                { name: '📂 General', value: '`help`, `ping`', inline: false },
                { name: 'ℹ️ Info', value: '`serverinfo`, `userinfo`', inline: false },
                { name: '🎮 Fun', value: '`joke`', inline: false },
                { name: '💰 Economy', value: '`work`, `balance`, `deposit`, `withdraw`, `rob`, `crime`, `steal`', inline: false },
                { name: '🎰 Casino', value: '`coinflip <bet>`, `dice <bet>`', inline: false },
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
                value: 'Get a VIP role for no-prefix commands!',
                inline: false
            });
        }

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ping') {
        const sent = await message.reply('🏓 Pinging...');
        const latency = sent.createdTimestamp - message.createdTimestamp;

        const embed = createEmbed(member, '🏓 Pong!',
            '**Bot Latency:** ' + latency + 'ms\n**API Latency:** ' + client.ws.ping + 'ms');

        return sent.edit({ content: null, embeds: [embed] });
    }

    if (cmd === 'serverinfo') {
        const guild = message.guild;
        const embed = createEmbed(member, '📊 ' + guild.name, null)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👑 Owner', value: '<@' + guild.ownerId + '>', inline: true },
                { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
                { name: '📝 Channels', value: guild.channels.cache.size.toString(), inline: true },
                { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
                { name: '📅 Created', value: '<t:' + Math.floor(guild.createdTimestamp / 1000) + ':R>', inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'userinfo') {
        const target = message.mentions.members.first() || member;
        const userPremium = isPremiumUser(target);

        const embed = createEmbed(member, '👤 ' + target.user.tag, null)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 ID', value: target.id, inline: true },
                { name: '👑 Premium', value: userPremium ? 'Yes' : 'No', inline: true },
                { name: '📅 Joined', value: '<t:' + Math.floor(target.joinedTimestamp / 1000) + ':R>', inline: true }
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
        const embed = createEmbed(member, '😄 Programming Joke', joke);

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'warn') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ You need Moderate Members permission!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('⚠️ Mention a user to warn!');

        const reason = args.slice(1).join(' ') || 'No reason';

        try {
            await target.send('⚠️ You were warned in **' + message.guild.name + '**\nReason: ' + reason);
        } catch {}

        const embed = createEmbed(member, '✅ User Warned',
            '**User:** ' + target.user.tag + '\n**Reason:** ' + reason);

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

        const embed = createEmbed(member, '✅ User Kicked',
            '**User:** ' + target.user.tag + '\n**Reason:** ' + reason);

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

        const embed = createEmbed(member, '✅ User Banned',
            '**User:** ' + target.user.tag + '\n**Reason:** ' + reason);

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'status') {
        if (!isPremium) {
            return message.reply('🔒 This is a VelnoX premium command!');
        }

        const embed = createEmbed(member, '👑 VelnoX Premium Status',
            'Welcome, **' + member.user.username + '**!')
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
            .setFooter({ text: 'Created by ' + message.author.tag })
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
                { name: '🏓 Ping', value: client.ws.ping + 'ms', inline: true },
                { name: '⏰ Uptime', value: days + 'd ' + hours + 'h ' + minutes + 'm', inline: false }
            );

        return message.reply({ embeds: [embed] });
    }
}

client.login(CONFIG.TOKEN).catch(err => {
    console.error('❌ FAILED TO LOGIN!');
    console.error('Make sure your bot token is correct in .env file!');
    console.error(err);
});

