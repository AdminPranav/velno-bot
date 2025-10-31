require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
const { Client, Events, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('💰 Casino System Ready!');
}).catch(err => console.error('❌ DB Error:', err));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Web server running on port ' + PORT);
});

const CONFIG = {
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    PREFIX: '!',
    PREMIUM_ROLES: ['VIP', 'VelnoX', 'Premium Member'],
    COLORS: {
        velno: '#5865F2',
        velnox: '#00D9FF',
        error: '#FF4444',
        success: '#00FF88',
        warning: '#FFB84D'
    },
    COOLDOWNS: {
        work: 10000,
        rob: 10000,
        crime: 10000,
        steal: 600000,
        daily: 86400000,
        coinflip: 3000,
        dice: 3000,
        slot: 5000,
        blackjack: 10000,
        roulette: 8000,
        jackpot: 5000,
        mute: 5000,
        clear: 5000,
        announce: 5000
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
    lastDaily: Date,
    lastCoinflip: Date,
    lastDice: Date,
    lastSlot: Date,
    lastBlackjack: Date,
    lastRoulette: Date,
    lastJackpot: Date,
    totalEarned: { type: Number, default: 0 },
    totalLost: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    warns: { type: Number, default: 0 },
    suggestions: { type: Number, default: 0 }
}, { timestamps: true });

const globalSchema = new mongoose.Schema({
    type: { type: String, unique: true },
    jackpot: { type: Number, default: 10000 },
    totalGambled: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);
const Global = mongoose.model('Global', globalSchema);

async function getUser(userId, username) {
    let user = await User.findOne({ userId });
    if (!user) {
        user = await User.create({ userId, username, wallet: 100, bank: 0 });
    }
    return user;
}

async function getGlobal() {
    let global = await Global.findOne({ type: 'main' });
    if (!global) {
        global = await Global.create({ type: 'main', jackpot: 10000 });
    }
    return global;
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
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
    new SlashCommandBuilder().setName('balance').setDescription('Check your balance'),
    new SlashCommandBuilder().setName('work').setDescription('Work to earn V-Coins'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('View economy leaderboard'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Get server information'),
    new SlashCommandBuilder().setName('userinfo').setDescription('Get user information')
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
            iconURL: client.user?.displayAvatarURL()
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
    console.log('✓ Commands: 43+');
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
                    { name: '💰 Economy', value: '`work`, `balance`, `deposit`, `withdraw`, `rob`, `crime`, `steal`, `daily`, `lb`', inline: false },
                    { name: '🎰 Casino', value: '`coinflip`, `dice`, `slot`, `blackjack`, `roulette`, `jackpot`', inline: false },
                    { name: '📂 General', value: '`help`, `ping`, `serverinfo`, `userinfo`, `avatar`, `joke`, `quote`', inline: false },
                    { name: '🛡️ Moderation', value: '`warn`, `kick`, `ban`, `clear`, `botclear`, `mute`, `unmute`, `lock`, `unlock`', inline: false },
                    { name: '👑 Premium', value: '`status`, `embed`, `stats`, `announce`, `booststatus`, `colorrole`, `reactionrole`', inline: false },
                    { name: '🧠 Utility', value: '`uptime`, `invite`, `vote`, `suggest`', inline: false }
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
                    .setDescription('Wait **' + cooldown.timeLeft + '** before working again!');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const earnings = Math.floor(Math.random() * 401) + 100;
            user.wallet += earnings;
            user.totalEarned += earnings;
            user.lastWork = new Date();
            await user.save();

            const jobs = ['coded a website', 'debugged code', 'deployed an app', 'fixed a server', 'designed a UI', 'wrote documentation'];
            const job = jobs[Math.floor(Math.random() * jobs.length)];

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.success)
                .setTitle('💼 Work Complete!')
                .setDescription('You ' + job + ' and earned **' + formatMoney(earnings) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));

            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'leaderboard') {
            const topUsers = await User.find().sort({ wallet: -1 }).limit(10);
            
            let lb = '';
            topUsers.forEach((u, i) => {
                lb += (i + 1) + '. ' + u.username + ' - ' + formatMoney(u.wallet + u.bank) + '\n';
            });

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velno)
                .setTitle('📊 Top 10 Richest Users')
                .setDescription(lb || 'No data yet')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'serverinfo') {
            const guild = interaction.guild;
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velno)
                .setTitle('📊 ' + guild.name)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: '👑 Owner', value: '<@' + guild.ownerId + '>', inline: true },
                    { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
                    { name: '📝 Channels', value: guild.channels.cache.size.toString(), inline: true }
                );
            
            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'userinfo') {
            const user = interaction.user;
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.velno)
                .setTitle('👤 ' + user.tag)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '🆔 ID', value: user.id, inline: true },
                    { name: '👤 Username', value: user.username, inline: true }
                );
            
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

        const validCommands = ['help', 'ping', 'serverinfo', 'userinfo', 'joke', 'quote', 'avatar',
                               'warn', 'kick', 'ban', 'clear', 'botclear', 'mute', 'unmute', 'lock', 'unlock', 'status', 'embed', 'stats',
                               'work', 'balance', 'bal', 'deposit', 'dep', 'withdraw', 'with', 'daily', 'lb',
                               'rob', 'crime', 'steal', 'coinflip', 'cf', 'dice', 'slot', 'blackjack', 'roulette', 'jackpot',
                               'announce', 'booststatus', 'colorrole', 'reactionrole', 'uptime', 'invite', 'vote', 'suggest'];

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
            const embed = createEmbed(member, '⏰ Cooldown', 'Wait **' + cooldown.timeLeft + '** before working again!');
            return message.reply({ embeds: [embed] });
        }

        const earnings = Math.floor(Math.random() * 401) + 100;
        user.wallet += earnings;
        user.totalEarned += earnings;
        user.lastWork = new Date();
        await user.save();

        const jobs = ['coded a website', 'debugged code', 'deployed an app', 'fixed a server', 'designed a UI', 'wrote documentation'];
        const job = jobs[Math.floor(Math.random() * jobs.length)];

        const embed = createEmbed(member, '💼 Work Complete!', 'You ' + job + ' and earned **' + formatMoney(earnings) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));
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
                { name: '💎 Total', value: formatMoney(total), inline: true },
                { name: '📈 Earned', value: formatMoney(user.totalEarned), inline: true },
                { name: '📉 Lost', value: formatMoney(user.totalLost), inline: true },
                { name: '🎮 W/L', value: user.gamesWon + ' / ' + user.gamesLost, inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'deposit' || cmd === 'dep') {
        const user = await getUser(message.author.id, message.author.username);
        let amount = parseInt(args[0]);

        if (args[0] === 'all' || args[0] === 'max') amount = user.wallet;
        if (!amount || amount <= 0 || isNaN(amount)) return message.reply('❌ Invalid amount!');
        if (amount > user.wallet) return message.reply('❌ Insufficient balance!');

        user.wallet -= amount;
        user.bank += amount;
        await user.save();

        const embed = createEmbed(member, '🏦 Deposit Successful', 'Deposited **' + formatMoney(amount) + '**\n\n💵 Wallet: ' + formatMoney(user.wallet) + '\n🏦 Bank: ' + formatMoney(user.bank));
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'withdraw' || cmd === 'with') {
        const user = await getUser(message.author.id, message.author.username);
        let amount = parseInt(args[0]);

        if (args[0] === 'all' || args[0] === 'max') amount = user.bank;
        if (!amount || amount <= 0 || isNaN(amount)) return message.reply('❌ Invalid amount!');
        if (amount > user.bank) return message.reply('❌ Insufficient bank balance!');

        user.bank -= amount;
        user.wallet += amount;
        await user.save();

        const embed = createEmbed(member, '💵 Withdrawal Successful', 'Withdrew **' + formatMoney(amount) + '**\n\n💵 Wallet: ' + formatMoney(user.wallet) + '\n🏦 Bank: ' + formatMoney(user.bank));
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'rob') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastRob, CONFIG.COOLDOWNS.rob);

        if (!cooldown.ready) {
            const embed = createEmbed(member, '⏰ Cooldown', 'Wait **' + cooldown.timeLeft + '** before robbing again!');
            return message.reply({ embeds: [embed] });
        }

        const earnings = Math.floor(Math.random() * 201) + 50;
        user.wallet += earnings;
        user.totalEarned += earnings;
        user.lastRob = new Date();
        await user.save();

        const embed = createEmbed(member, '🦹 Quick Rob!', 'You stole **' + formatMoney(earnings) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'crime') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastCrime, CONFIG.COOLDOWNS.crime);

        if (!cooldown.ready) {
            const embed = createEmbed(member, '⏰ Cooldown', 'Wait **' + cooldown.timeLeft + '** before committing crime!');
            return message.reply({ embeds: [embed] });
        }

        const success = Math.random() > 0.3;

        if (success) {
            const earnings = Math.floor(Math.random() * 701) + 200;
            user.wallet += earnings;
            user.totalEarned += earnings;
            user.lastCrime = new Date();
            await user.save();

            const embed = createEmbed(member, '🎭 Crime Success!', 'You earned **' + formatMoney(earnings) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else {
            const fine = Math.floor(Math.random() * 301) + 100;
            const actualFine = Math.min(fine, user.wallet);
            user.wallet -= actualFine;
            user.totalLost += actualFine;
            user.lastCrime = new Date();
            await user.save();

            const embed = createEmbed(member, '🚔 Crime Failed!', 'You got caught! Fined **' + formatMoney(actualFine) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'steal') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastSteal, CONFIG.COOLDOWNS.steal);

        if (!cooldown.ready) {
            const embed = createEmbed(member, '⏰ Cooldown', 'Wait **' + cooldown.timeLeft + '** before stealing!');
            return message.reply({ embeds: [embed] });
        }

        const target = message.mentions.users.first();
        if (!target || target.bot) return message.reply('❌ Mention a valid user!');
        if (target.id === message.author.id) return message.reply('❌ Cannot steal from yourself!');

        const targetUser = await getUser(target.id, target.username);
        if (targetUser.wallet < 100) return message.reply('❌ Target is too poor!');

        const success = Math.random() > 0.5;

        if (success) {
            const stolen = Math.floor(targetUser.wallet * 0.15);
            targetUser.wallet -= stolen;
            user.wallet += stolen;
            user.totalEarned += stolen;
            targetUser.totalLost += stolen;
            user.lastSteal = new Date();
            await user.save();
            await targetUser.save();

            const embed = createEmbed(member, '💰 Steal Success!', 'You stole **' + formatMoney(stolen) + '** from ' + target.username + '!\n\n💵 Your Wallet: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else {
            const fine = Math.floor(Math.random() * 201) + 50;
            const actualFine = Math.min(fine, user.wallet);
            user.wallet -= actualFine;
            user.totalLost += actualFine;
            user.lastSteal = new Date();
            await user.save();

            const embed = createEmbed(member, '🚨 Steal Failed!', 'Caught! Lost **' + formatMoney(actualFine) + '**!\n\n💵 Wallet: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'daily') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastDaily, CONFIG.COOLDOWNS.daily);

        if (!cooldown.ready) {
            const embed = createEmbed(member, '⏰ Daily Cooldown', 'Come back **' + cooldown.timeLeft + '** for your daily reward!');
            return message.reply({ embeds: [embed] });
        }

        const reward = 500;
        user.wallet += reward;
        user.totalEarned += reward;
        user.lastDaily = new Date();
        await user.save();

        const embed = createEmbed(member, '🎁 Daily Reward Claimed!', 'You claimed **' + formatMoney(reward) + '**!\n\n💰 Wallet: ' + formatMoney(user.wallet));
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'lb') {
        const topUsers = await User.find().sort({ wallet: -1 }).limit(10);
        
        let lb = '';
        topUsers.forEach((u, i) => {
            lb += (i + 1) + '. ' + u.username + ' - ' + formatMoney(u.wallet + u.bank) + '\n';
        });

        const embed = createEmbed(member, '📊 Top 10 Richest', lb || 'No data yet');
        return message.reply({ embeds: [embed] });
    }

if (cmd === 'coinflip' || cmd === 'cf') {
    const user = await getUser(message.author.id, message.author.username);
    const cooldown = checkCooldown(user.lastCoinflip, CONFIG.COOLDOWNS.coinflip);

    if (!cooldown.ready) return message.reply('❌ Wait ' + cooldown.timeLeft + ' before flipping again!');
    if (!args[0]) return message.reply('❌ Usage: !coinflip <bet>');

    let bet = parseInt(args[0]);
    if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply('❌ Invalid bet!');

    const win = Math.random() > 0.5;
    const result = win ? 'Heads' : 'Tails';

    // ANIMATION MESSAGE
    const animationEmbed = createEmbed(member, '🪙 Flipping Coin...', '🪙 ⚪ 🪙\n\n*spinning...*');
    const animationMsg = await message.reply({ embeds: [animationEmbed] });

    // Wait 2 seconds for animation
    setTimeout(async () => {
        if (win) {
            user.wallet += bet;
            user.totalEarned += bet;
            user.gamesWon += 1;
            await user.save();

            const resultEmbed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.success)
                .setTitle('🪙 HEADS! YOU WIN!')
                .setDescription('**Result:** ' + result + '\n**Won:** ' + formatMoney(bet) + '\n\n💰 Balance: ' + formatMoney(user.wallet))
                .setFooter({ text: 'VelnoX • Cool mind. Sharp code.' })
                .setTimestamp();

            await animationMsg.edit({ embeds: [resultEmbed] });
        } else {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const resultEmbed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.error)
                .setTitle('🪙 TAILS! YOU LOSE!')
                .setDescription('**Result:** ' + result + '\n**Lost:** ' + formatMoney(bet) + '\n\n💰 Balance: ' + formatMoney(user.wallet))
                .setFooter({ text: 'VelnoX • Cool mind. Sharp code.' })
                .setTimestamp();

            await animationMsg.edit({ embeds: [resultEmbed] });
        }
        user.lastCoinflip = new Date();
        await user.save();
    }, 2000);
}


    if (cmd === 'dice') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastDice, CONFIG.COOLDOWNS.dice);

        if (!cooldown.ready) return message.reply('❌ Wait ' + cooldown.timeLeft + ' before rolling!');
        if (!args[0]) return message.reply('❌ Usage: !dice <bet>');

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply('❌ Invalid bet!');

        const playerRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll = Math.floor(Math.random() * 6) + 1;

        if (playerRoll > botRoll) {
            user.wallet += bet;
            user.totalEarned += bet;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, '🎲 Dice - WIN!', '**You:** ' + playerRoll + ' | **Bot:** ' + botRoll + '\n**Won:** ' + formatMoney(bet) + '\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else if (playerRoll < botRoll) {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const embed = createEmbed(member, '🎲 Dice - LOSE!', '**You:** ' + playerRoll + ' | **Bot:** ' + botRoll + '\n**Lost:** ' + formatMoney(bet) + '\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else {
            const embed = createEmbed(member, '🎲 Dice - TIE!', '**You:** ' + playerRoll + ' | **Bot:** ' + botRoll + '\n**Tie! No money won or lost**\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'slot') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastSlot, CONFIG.COOLDOWNS.slot);

        if (!cooldown.ready) return message.reply('❌ Wait ' + cooldown.timeLeft + ' before spinning!');
        if (!args[0]) return message.reply('❌ Usage: !slot <bet>');

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply('❌ Invalid bet!');

        const symbols = ['🍎', '🍊', '🍋', '🍌', '🍉', '7️⃣'];
        const roll1 = symbols[Math.floor(Math.random() * symbols.length)];
        const roll2 = symbols[Math.floor(Math.random() * symbols.length)];
        const roll3 = symbols[Math.floor(Math.random() * symbols.length)];

        const result = roll1 + ' | ' + roll2 + ' | ' + roll3;

        if (roll1 === roll2 && roll2 === roll3) {
            const winnings = bet * 5;
            user.wallet += winnings;
            user.totalEarned += winnings;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, '🎰 JACKPOT!!!', result + '\n\n🎉 YOU WON **' + formatMoney(winnings) + '**!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else if (roll1 === roll2 || roll2 === roll3) {
            const winnings = bet * 2;
            user.wallet += winnings;
            user.totalEarned += winnings;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, '🎰 Two Matches!', result + '\n\n✨ You won **' + formatMoney(winnings) + '**!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const embed = createEmbed(member, '🎰 No Match', result + '\n\n❌ You lost **' + formatMoney(bet) + '**!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'blackjack') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastBlackjack, CONFIG.COOLDOWNS.blackjack);

        if (!cooldown.ready) return message.reply('❌ Wait ' + cooldown.timeLeft + ' before playing again!');
        if (!args[0]) return message.reply('❌ Usage: !blackjack <bet>');

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply('❌ Invalid bet!');

        const cardValue = () => Math.floor(Math.random() * 21) + 1;
        const playerHand = cardValue() + cardValue();
        const dealerHand = cardValue() + cardValue();

        if (playerHand === 21) {
            const winnings = Math.floor(bet * 2.5);
            user.wallet += winnings;
            user.totalEarned += winnings;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, '🃏 BLACKJACK!', 'You got 21!\n\n🎉 You won **' + formatMoney(winnings) + '**!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else if (playerHand > dealerHand && playerHand <= 21) {
            const winnings = bet * 2;
            user.wallet += winnings;
            user.totalEarned += winnings;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, '🃏 Blackjack - WIN!', 'Your: ' + playerHand + ' | Dealer: ' + dealerHand + '\n\n✨ You won **' + formatMoney(winnings) + '**!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const embed = createEmbed(member, '🃏 Blackjack - LOSE!', 'Your: ' + playerHand + ' | Dealer: ' + dealerHand + '\n\n❌ You lost **' + formatMoney(bet) + '**!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'roulette') {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastRoulette, CONFIG.COOLDOWNS.roulette);

        if (!cooldown.ready) return message.reply('❌ Wait ' + cooldown.timeLeft + ' before spinning again!');
        if (!args[0]) return message.reply('❌ Usage: !roulette <bet>');

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply('❌ Invalid bet!');

        const spin = Math.floor(Math.random() * 37);
        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(spin);
        const isEven = spin % 2 === 0 && spin !== 0;

        const win = Math.random() > 0.5;

        if (win) {
            const winnings = bet * 3;
            user.wallet += winnings;
            user.totalEarned += winnings;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, '🎡 Roulette - WIN!', 'Spin: ' + spin + ' (' + (isRed ? 'Red' : 'Black') + ')\n\n🎉 You won **' + formatMoney(winnings) + '**!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const embed = createEmbed(member, '🎡 Roulette - LOSE!', 'Spin: ' + spin + '\n\n❌ You lost **' + formatMoney(bet) + '**!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'jackpot') {
        const user = await getUser(message.author.id, message.author.username);
        const global = await getGlobal();
        const cooldown = checkCooldown(user.lastJackpot, CONFIG.COOLDOWNS.jackpot);

        if (!cooldown.ready) return message.reply('❌ Wait ' + cooldown.timeLeft + ' before trying again!');
        if (!args[0]) return message.reply('❌ Usage: !jackpot <bet>');

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply('❌ Invalid bet!');

        const jackpotChance = Math.random();

        if (jackpotChance < 0.02) {
            const jackpot = global.jackpot;
            user.wallet += jackpot;
            user.totalEarned += jackpot;
            user.gamesWon += 1;
            global.jackpot = 10000;
            global.totalGambled = 0;
            await user.save();
            await global.save();

            const embed = createEmbed(member, '💎 MEGA JACKPOT!!!', 'YOU WON THE JACKPOT!\n\n🎊 YOU WON **' + formatMoney(jackpot) + '**!!!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            global.jackpot += bet;
            global.totalGambled += bet;
            await user.save();
            await global.save();

            const embed = createEmbed(member, '🎲 Jackpot Attempt', 'Jackpot now: **' + formatMoney(global.jackpot) + '**\n\n❌ You lost **' + formatMoney(bet) + '**!\n\n💰 Balance: ' + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === 'help') {
        const helpText = isPremium ? '**Premium Active!** No-prefix commands!\n\n' : '**Prefix:** ' + CONFIG.PREFIX + '\n\n';
        const embed = createEmbed(member, isPremium ? '👑 VelnoX Commands' : '📋 Velno Commands', helpText)
            .addFields(
                { name: '💰 Economy', value: '`work` `balance` `deposit` `withdraw` `rob` `crime` `steal` `daily` `lb`', inline: false },
                { name: '🎰 Casino', value: '`coinflip` `dice` `slot` `blackjack` `roulette` `jackpot`', inline: false },
                { name: '📂 General', value: '`help` `ping` `serverinfo` `userinfo` `avatar` `joke` `quote`', inline: false },
                { name: '🛡️ Moderation', value: '`warn` `kick` `ban` `clear` `botclear` `mute` `unmute` `lock` `unlock`', inline: false },
                { name: '👑 Premium', value: '`status` `embed` `stats` `announce` `booststatus` `colorrole` `reactionrole`', inline: false },
                { name: '🧠 Utility', value: '`uptime` `invite` `vote` `suggest`', inline: false }
            );

        if (isPremium) {
            embed.addFields({ name: '✨ Premium Active', value: 'You have VelnoX access!', inline: false });
        }

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ping') {
        const sent = await message.reply('🏓 Pinging...');
        const latency = sent.createdTimestamp - message.createdTimestamp;

        const embed = createEmbed(member, '🏓 Pong!', '**Bot Latency:** ' + latency + 'ms\n**API Latency:** ' + client.ws.ping + 'ms');
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

    if (cmd === 'avatar') {
        const target = message.mentions.users.first() || message.author;
        const embed = createEmbed(member, '👤 ' + target.username + "'s Avatar", null)
            .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }));

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'joke') {
        const jokes = [
            'Why do programmers prefer dark mode? Because light attracts bugs!',
            'Why did the developer go broke? Because he used up all his cache!',
            'Why do Java developers wear glasses? Because they cannot C#!',
            'A SQL query walks into a bar, walks up to two tables and asks... Can I join you?',
            'Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25!'
        ];

        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        const embed = createEmbed(member, '😄 Random Joke', joke);

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'quote') {
        const quotes = [
            'The only way to do great work is to love what you do. - Steve Jobs',
            'Innovation distinguishes between a leader and a follower. - Steve Jobs',
            'Life is what happens when you are busy making other plans. - John Lennon',
            'The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt',
            'It is during our darkest moments that we must focus to see the light. - Aristotle'
        ];

        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        const embed = createEmbed(member, '✨ Random Quote', quote);

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'warn') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ You need permissions!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('⚠️ Mention a user!');

        const reason = args.slice(1).join(' ') || 'No reason';
        const user = await getUser(target.user.id, target.user.username);
        user.warns += 1;
        await user.save();

        try {
            await target.send('⚠️ You were warned in **' + message.guild.name + '**\nReason: ' + reason + '\nWarns: ' + user.warns);
        } catch {}

        const embed = createEmbed(member, '✅ User Warned', '**User:** ' + target.user.tag + '\n**Reason:** ' + reason + '\n**Warns:** ' + user.warns);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'kick') {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('❌ You need permissions!');
        }

        const target = message.mentions.members.first();
        if (!target || !target.kickable) return message.reply('❌ Cannot kick this user!');

        const reason = args.slice(1).join(' ') || 'No reason';
        await target.kick(reason);

        const embed = createEmbed(member, '✅ User Kicked', '**User:** ' + target.user.tag + '\n**Reason:** ' + reason);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'ban') {
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ You need permissions!');
        }

        const target = message.mentions.members.first();
        if (!target || !target.bannable) return message.reply('❌ Cannot ban this user!');

        const reason = args.slice(1).join(' ') || 'No reason';
        await target.ban({ reason });

        const embed = createEmbed(member, '✅ User Banned', '**User:** ' + target.user.tag + '\n**Reason:** ' + reason);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'clear') {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ You need ManageMessages permission!');
        }

        const amount = parseInt(args[0]) || 10;
        if (amount < 1 || amount > 100) return message.reply('❌ Clear 1-100 messages!');

        await message.channel.bulkDelete(amount);

        const embed = createEmbed(member, '✅ Cleared Messages', 'Deleted **' + amount + '** messages!');
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'botclear') {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ You need ManageMessages permission!');
        }

        const messages = await message.channel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(m => m.author.bot);

        await message.channel.bulkDelete(botMessages);

        const embed = createEmbed(member, '✅ Bot Messages Cleared', 'Deleted **' + botMessages.size + '** bot messages!');
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'mute') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ You need permissions!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('⚠️ Mention a user!');

        const muteRole = message.guild.roles.cache.find(r => r.name === 'Muted') || 
                        await message.guild.roles.create({ name: 'Muted', color: '#FF0000', permissions: [] });

        await target.roles.add(muteRole);

        const embed = createEmbed(member, '🔇 User Muted', '**User:** ' + target.user.tag);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'unmute') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ You need permissions!');
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('⚠️ Mention a user!');

        const muteRole = message.guild.roles.cache.find(r => r.name === 'Muted');
        if (muteRole) await target.roles.remove(muteRole);

        const embed = createEmbed(member, '🔊 User Unmuted', '**User:** ' + target.user.tag);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'lock') {
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ You need permissions!');
        }

        await message.channel.permissionOverwrites.create(message.guild.roles.everyone, { SendMessages: false });

        const embed = createEmbed(member, '🔒 Channel Locked', 'Channel is now locked!');
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'unlock') {
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ You need permissions!');
        }

        await message.channel.permissionOverwrites.delete(message.guild.roles.everyone);

        const embed = createEmbed(member, '🔓 Channel Unlocked', 'Channel is now unlocked!');
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'status') {
        if (!isPremium) return message.reply('🔒 Premium only!');

        const embed = createEmbed(member, '👑 VelnoX Premium Status', 'Welcome, **' + member.user.username + '**!')
            .addFields(
                { name: '✨ Status', value: 'Active', inline: true },
                { name: '🎯 Tier', value: 'VelnoX Premium', inline: true },
                { name: '🚀 Features', value: 'No-prefix • Custom Embeds • Advanced Stats', inline: false }
            );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'embed') {
        if (!isPremium) return message.reply('🔒 Premium only!');
        if (!args.length) return message.reply('Usage: !embed <title> | <description> | [color]');

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
        if (!isPremium) return message.reply('🔒 Premium only!');

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

    if (cmd === 'announce') {
        if (!isPremium || !member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('🔒 Premium + Permissions needed!');
        }

        if (!args.length) return message.reply('Usage: !announce <message>');

        const announcement = args.join(' ');
        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.velnox)
            .setTitle('📢 ANNOUNCEMENT')
            .setDescription(announcement)
            .setFooter({ text: 'Announced by ' + message.author.tag })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        if (message.deletable) await message.delete();
    }

    if (cmd === 'booststatus') {
        if (!isPremium) return message.reply('🔒 Premium only!');

        const boosters = message.guild.members.cache.filter(m => m.premiumSince);
        let boosterList = boosters.map(m => m.user.tag).join(', ') || 'No boosters yet';

        const embed = createEmbed(member, '🚀 Server Boosters', 'Boosters: ' + boosters.size + '\n\n' + boosterList);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'colorrole') {
        if (!isPremium || !member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('🔒 Premium + Permissions needed!');
        }

        if (!args.length) return message.reply('Usage: !colorrole <name> <color>');

        const name = args[0];
        const color = args[1] || '#00D9FF';

        const role = await message.guild.roles.create({ name, color });

        const embed = createEmbed(member, '✨ Color Role Created', 'Created role: ' + role.toString() + '\nColor: ' + color);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'reactionrole') {
        if (!isPremium) return message.reply('🔒 Premium only!');

        const embed = createEmbed(member, '⚙️ Reaction Role Setup', 'Use !reactionrole setup <message_id> to set up reaction roles!');
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'uptime') {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const seconds = Math.floor(uptime % 60);

        const embed = createEmbed(member, '⏰ Bot Uptime', days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's');
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'invite') {
        const embed = createEmbed(member, '📬 Invite Links', 'Discord.js v14 | MongoDB | Economy Bot\n\n[Add Velno Bot](https://discord.com/api/oauth2/authorize?client_id=1431927437746503700&permissions=8&scope=bot%20applications.commands)');
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'vote') {
        const embed = createEmbed(member, '⭐ Vote for Us', 'Support the bot by voting!\n\nVote on top.gg and other bot lists!');
        return message.reply({ embeds: [embed] });
    }

    if (cmd === 'suggest') {
        if (!args.length) return message.reply('Usage: !suggest <your suggestion>');

        const suggestion = args.join(' ');
        const user = await getUser(message.author.id, message.author.username);
        user.suggestions += 1;
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.success)
            .setTitle('💡 New Suggestion')
            .setDescription(suggestion)
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        const reply = createEmbed(message.member, '✅ Suggestion Submitted', 'Your suggestion has been recorded!\n\nTotal: ' + user.suggestions);
        return message.reply({ embeds: [reply] });
    }
}

client.login(CONFIG.TOKEN).catch(err => {
    console.error('❌ FAILED TO LOGIN!');
    console.error('Make sure your bot token is correct!');
    console.error(err);
});

