require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { Client, Events, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('💰 Velno Bot Connected to MongoDB!');
    } catch (err) {
        console.error('❌ DB Connection Failed:', err.message);
        console.log('Retrying in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

connectDB();

// Express Server
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Velno Bot - Online</title>
            <style>
                body { font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                       color: white; display: flex; align-items: center; justify-content: center; 
                       min-height: 100vh; margin: 0; text-align: center; }
                .container { background: rgba(255,255,255,0.1); padding: 3rem; border-radius: 20px; 
                            backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
                h1 { font-size: 3rem; margin-bottom: 1rem; }
                .status { background: #00FF88; color: #000; padding: 0.5rem 1.5rem; 
                         border-radius: 25px; font-weight: bold; display: inline-block; margin: 1rem 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Velno Bot</h1>
                <div class="status">✅ ONLINE</div>
                <p>50+ Commands • Trust System • Casino • Business</p>
                <p style="opacity: 0.8; margin-top: 2rem;">Smart. Simple. Steady.</p>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'online', 
        uptime: process.uptime(),
        bot: client.user ? client.user.tag : 'Starting...'
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Web server running on port ' + PORT);
}).on('error', (err) => {
    console.error('❌ Express Error:', err);
});

const CONFIG = {
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    OWNER_ID: process.env.OWNER_ID || 'YOUR_DISCORD_USER_ID', // Add your Discord User ID here
    PREFIX: '!',
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
        roast: 30000,
        compliment: 30000
    }
};

// DATABASE SCHEMAS
const userSchema = new mongoose.Schema({
    userId: String,
    username: String,
    wallet: { type: Number, default: 100 },
    bank: { type: Number, default: 0 },
    isTrusted: { type: Boolean, default: false }, // NEW: Trust status
    trustedBy: String, // Who trusted them
    trustedAt: Date, // When they were trusted
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
    lastRoast: Date,
    lastCompliment: Date,
    totalEarned: { type: Number, default: 0 },
    totalLost: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    warns: { type: Number, default: 0 },
    suggestions: { type: Number, default: 0 },
    businessId: String,
    roastCount: { type: Number, default: 0 }
}, { timestamps: true });

const businessSchema = new mongoose.Schema({
    businessId: { type: String, unique: true },
    ownerId: String,
    ownerName: String,
    name: String,
    type: String,
    level: { type: Number, default: 1 },
    revenue: { type: Number, default: 0 },
    employees: [String],
    lastProfit: Date,
    createdAt: Date,
    upgradeCost: { type: Number, default: 1000 },
    profitMultiplier: { type: Number, default: 1 }
}, { timestamps: true });

const globalSchema = new mongoose.Schema({
    type: { type: String, unique: true },
    jackpot: { type: Number, default: 10000 },
    totalGambled: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);
const Business = mongoose.model('Business', businessSchema);
const Global = mongoose.model('Global', globalSchema);

async function getUser(userId, username) {
    let user = await User.findOne({ userId });
    if (!user) {
        user = await User.create({ 
            userId, 
            username, 
            wallet: 100, 
            bank: 0,
            isTrusted: userId === CONFIG.OWNER_ID // Owner is always trusted
        });
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

// ROAST & COMPLIMENT LINES
const roastLines = [
    "Arre madarchod, tu itna ghatiya hai ki teri maa bhi tujhe dekh ke roti hai!",
    "Bhenchod, tera face dekh ke toh darwaza bhi bolta hai – Bhai, yeh kya laaya?",
    "Saale, tu itna harami hai ki haramkhor bhi tujhse sharma jaye.",
    "Madarchod, tera dimaag toh teri maa ke pet mein hi reh gaya tha kya?",
    "Bhen ke lode, tu itna slow hai ki kachhua bhi tujhe thappad maare."
];

const complimentLines = [
    "Bhai, tu actually decent hai – tera sense of humor sahi hai!",
    "Respect! Tu apne skills ke liye known hai server mein.",
    "Tu actually chill person hai – log tujhe like karti hain.",
    "Your dedication is insane bro – keep it up!",
    "You have more brain cells than the average person!"
];

// BUSINESS PASSIVE INCOME
cron.schedule('0 * * * *', async () => {
    try {
        const businesses = await Business.find();
        for (const biz of businesses) {
            const earnings = Math.floor((biz.level * 100) * biz.profitMultiplier);
            biz.revenue += earnings;
            biz.lastProfit = new Date();

            const owner = await getUser(biz.ownerId, biz.ownerName);
            const employeeShare = Math.floor(earnings * 0.2);
            const ownerShare = earnings - employeeShare;

            owner.wallet += ownerShare;
            owner.totalEarned += ownerShare;

            for (const empId of biz.employees) {
                const emp = await getUser(empId, 'Employee');
                emp.wallet += employeeShare;
                emp.totalEarned += employeeShare;
                await emp.save();
            }

            await owner.save();
            await biz.save();
        }
    } catch (err) {
        console.error('Cron error:', err);
    }
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// NEW: Check if user is trusted (has VelnoX premium)
async function isPremiumUser(userId) {
    if (userId === CONFIG.OWNER_ID) return true; // Owner always has premium
    const user = await User.findOne({ userId });
    return user ? user.isTrusted : false;
}

function isOwner(userId) {
    return userId === CONFIG.OWNER_ID;
}

function createEmbed(isTrusted, title, description) {
    return new EmbedBuilder()
        .setColor(isTrusted ? CONFIG.COLORS.velnox : CONFIG.COLORS.velno)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ 
            text: isTrusted ? "VelnoX • Cool mind. Sharp code." : "Velno • Smart. Simple. Steady.",
            iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp();
}

// SLASH COMMAND REGISTRATION
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
    new SlashCommandBuilder().setName('work').setDescription('Work to earn V-Coins'),
    new SlashCommandBuilder().setName('balance').setDescription('Check your balance'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim daily reward'),
    new SlashCommandBuilder().setName('rob').setDescription('Quick robbery'),
    new SlashCommandBuilder().setName('crime').setDescription('Commit a crime'),
    new SlashCommandBuilder().setName('lb').setDescription('View leaderboard'),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin').addIntegerOption(opt => opt.setName('bet').setDescription('Bet amount').setRequired(true)),
    new SlashCommandBuilder().setName('dice').setDescription('Roll dice').addIntegerOption(opt => opt.setName('bet').setDescription('Bet amount').setRequired(true)),
    new SlashCommandBuilder().setName('slot').setDescription('Slot machine').addIntegerOption(opt => opt.setName('bet').setDescription('Bet amount').setRequired(true)),
    new SlashCommandBuilder().setName('jackpot').setDescription('Try the jackpot').addIntegerOption(opt => opt.setName('bet').setDescription('Bet amount').setRequired(true)),
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Server information'),
].map(cmd => cmd.toJSON());

client.once(Events.ClientReady, async (readyClient) => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║   ✅ VELNO BOT ONLINE!               ║');
    console.log('║   TRUST SYSTEM • CASINO • BUSINESS   ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('✓ Logged in as ' + readyClient.user.tag);
    console.log('✓ Owner ID: ' + CONFIG.OWNER_ID);
    console.log('✓ Prefix: ' + CONFIG.PREFIX);
    console.log('✓ No-Prefix: Trusted users only');
    console.log('✓ Trust System: Owner-controlled');
    console.log('══════════════════════════════════════\n');

    client.user.setActivity("!help • Trust System", { type: 0 });

    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands });
        console.log('✅ Slash commands registered!\n');
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
});

// MESSAGE HANDLER (PREFIX & NO-PREFIX)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const isPremium = await isPremiumUser(userId);
    let commandName, args;

    // PREFIX COMMANDS (Everyone)
    if (message.content.startsWith(CONFIG.PREFIX)) {
        const argsRaw = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
        commandName = argsRaw.shift().toLowerCase();
        args = argsRaw;
    } 
    // NO-PREFIX COMMANDS (Trusted Users Only)
    else if (isPremium) {
        const words = message.content.trim().split(/ +/);
        const possibleCommand = words[0].toLowerCase();
        
        const noPrefixCommands = ['work', 'balance', 'bal', 'rob', 'crime', 'daily', 'lb', 
                                  'deposit', 'dep', 'withdraw', 'with', 'coinflip', 'cf', 
                                  'dice', 'slot', 'jackpot', 'help', 'ping', 'roast', 
                                  'compliment', 'comp', 'bizstats', 'startbiz', 'hire', 'upgrade',
                                  'trustedlist', 'status'];
        
        if (noPrefixCommands.includes(possibleCommand)) {
            commandName = possibleCommand;
            args = words.slice(1);
        } else {
            return;
        }
    } else {
        return;
    }

    try {
        await handleCommand(message, commandName, args, false);
    } catch (error) {
        console.error('Command Error:', error);
        message.reply("❌ An error occurred!");
    }
});

// SLASH COMMAND HANDLER
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    let args = [];
    
    if (interaction.options.getInteger('bet')) {
        args.push(interaction.options.getInteger('bet').toString());
    }

    try {
        await interaction.deferReply();
        await handleCommand(interaction, commandName, args, true);
    } catch (error) {
        console.error('Slash Command Error:', error);
        await interaction.editReply({ content: "❌ An error occurred!" });
    }
});

async function handleCommand(source, cmd, args, isSlash = false) {
    const userId = isSlash ? source.user.id : source.author.id;
    const username = isSlash ? source.user.username : source.author.username;
    const isPremium = await isPremiumUser(userId);

    const reply = async (content) => {
        if (isSlash) {
            return await source.editReply(content);
        } else {
            return await source.reply(content);
        }
    };

    // ========== TRUST COMMAND (OWNER ONLY) ==========
    if (cmd === 'trust') {
        if (!isOwner(userId)) {
            return await reply("❌ Only the bot owner can use this command!");
        }

        const target = isSlash ? null : source.mentions.users.first();
        if (!target) return await reply("❌ Usage: !trust @user");

        const targetUser = await getUser(target.id, target.username);
        
        if (targetUser.isTrusted) {
            return await reply("⚠️ " + target.tag + " is already trusted!");
        }

        targetUser.isTrusted = true;
        targetUser.trustedBy = username;
        targetUser.trustedAt = new Date();
        await targetUser.save();

        const embed = createEmbed(true, "✅ User Trusted!", 
            "**User:** " + target.tag + "\n**Status:** VelnoX Premium Activated 👑\n\n" +
            "They can now use commands without prefix!\n\n" +
            "**Examples:**\n" +
            "`work` instead of `!work`\n" +
            "`balance` instead of `!balance`\n" +
            "`coinflip 100` instead of `!coinflip 100`");

        return await reply({ embeds: [embed] });
    }

    // ========== UNTRUST COMMAND (OWNER ONLY) ==========
    if (cmd === 'untrust') {
        if (!isOwner(userId)) {
            return await reply("❌ Only the bot owner can use this command!");
        }

        const target = isSlash ? null : source.mentions.users.first();
        if (!target) return await reply("❌ Usage: !untrust @user");

        if (target.id === CONFIG.OWNER_ID) {
            return await reply("❌ Cannot untrust the bot owner!");
        }

        const targetUser = await getUser(target.id, target.username);
        
        if (!targetUser.isTrusted) {
            return await reply("⚠️ " + target.tag + " is not trusted!");
        }

        targetUser.isTrusted = false;
        targetUser.trustedBy = null;
        targetUser.trustedAt = null;
        await targetUser.save();

        const embed = createEmbed(false, "❌ User Untrusted", 
            "**User:** " + target.tag + "\n**Status:** VelnoX Premium Removed\n\n" +
            "They must now use prefix for commands.");

        return await reply({ embeds: [embed] });
    }

    // ========== TRUSTEDLIST COMMAND (OWNER ONLY) ==========
    if (cmd === 'trustedlist' || cmd === 'tlist') {
        if (!isOwner(userId)) {
            return await reply("❌ Only the bot owner can use this command!");
        }

        const trustedUsers = await User.find({ isTrusted: true });

        if (trustedUsers.length === 0) {
            return await reply("📋 No trusted users yet!");
        }

        let list = "**Total Trusted:** " + trustedUsers.length + "\n\n";
        trustedUsers.forEach((u, i) => {
            const date = u.trustedAt ? "<t:" + Math.floor(u.trustedAt.getTime() / 1000) + ":R>" : "Unknown";
            list += (i + 1) + ". **" + u.username + "** (ID: `" + u.userId + "`)\n   Trusted " + date + "\n\n";
        });

        const embed = createEmbed(true, "👑 Trusted Users (VelnoX)", list);
        return await reply({ embeds: [embed] });
    }

    // ========== STATUS COMMAND ==========
    if (cmd === 'status') {
        const user = await getUser(userId, username);

        const embed = createEmbed(user.isTrusted, "📊 Your Status", null)
            .addFields(
                { name: "👤 Username", value: username, inline: true },
                { name: "🆔 User ID", value: userId, inline: true },
                { name: "👑 VelnoX Premium", value: user.isTrusted ? "✅ Active" : "❌ Inactive", inline: true },
                { name: "💰 Wallet", value: formatMoney(user.wallet), inline: true },
                { name: "🏦 Bank", value: formatMoney(user.bank), inline: true },
                { name: "💎 Net Worth", value: formatMoney(user.wallet + user.bank), inline: true }
            );

        if (user.isTrusted && user.trustedBy) {
            embed.addFields({ 
                name: "🔐 Trusted By", 
                value: user.trustedBy + " " + (user.trustedAt ? "<t:" + Math.floor(user.trustedAt.getTime() / 1000) + ":R>" : ""), 
                inline: false 
            });
        }

        if (!user.isTrusted) {
            embed.setDescription("💡 **Want VelnoX Premium?**\nAsk the bot owner to trust you with `!trust @you`");
        }

        return await reply({ embeds: [embed] });
    }

    // ========== HELP COMMAND ==========
    if (cmd === 'help') {
        const ownerCommands = isOwner(userId) ? 
            "\n\n**🔐 Owner Commands:**\n" +
            "**!trust @user** - Grant VelnoX premium\n" +
            "**!untrust @user** - Remove VelnoX premium\n" +
            "**!trustedlist** - View all trusted users" : "";

        const pages = [
            createEmbed(isPremium, "💰 Economy (1/6)", 
                "**!work** - Earn V-Coins (10s)\n" +
                "**!balance** - Check balance\n" +
                "**!deposit <amt>** - Bank deposit\n" +
                "**!withdraw <amt>** - Withdraw\n" +
                "**!rob** - Quick rob (10s)\n" +
                "**!crime** - Risky crime (10s)\n" +
                "**!daily** - Daily reward (24h)\n" +
                "**!lb** - Top 10 richest\n" +
                "**!status** - Check VelnoX status\n\n" +
                (isPremium ? "👑 **You have VelnoX! Use without ! prefix**" : "💡 Ask owner for VelnoX access!") +
                ownerCommands),

            createEmbed(isPremium, "🏢 Business (2/6)",
                "**!startbiz <n>** - 5000 V-Coins\n" +
                "**!bizstats** - View business stats\n" +
                "**!hire @user** - Hire employee\n" +
                "**!upgrade** - Upgrade level\n\n" +
                "💹 **Passive income every hour!**"),

            createEmbed(isPremium, "🎰 Casino (3/6)",
                "**!coinflip <bet>** - 50/50 (3s)\n" +
                "**!dice <bet>** - Roll dice (3s)\n" +
                "**!slot <bet>** - 5x jackpot (5s)\n" +
                "**!jackpot <bet>** - 2% mega (5s)\n\n" +
                "🎊 **Animated games with rewards!**"),

            createEmbed(isPremium, "🎭 Fun (4/6)",
                "**!roast [@user]** - Epic roasts (30s)\n" +
                "**!compliment [@user]** - Nice words (30s)\n" +
                "**!joke** - Random joke\n" +
                "**!quote** - Inspiration"),

            createEmbed(isPremium, "🛡️ Moderation (5/6)",
                "**!warn @user** - Warn member\n" +
                "**!kick @user** - Kick member\n" +
                "**!ban @user** - Ban member\n" +
                "**!clear <amt>** - Bulk delete\n" +
                "**!mute @user** - Mute member\n" +
                "**!unmute @user** - Unmute member\n" +
                "**!lock** - Lock channel\n" +
                "**!unlock** - Unlock channel"),

            createEmbed(isPremium, "📂 Utility (6/6)",
                "**!ping** - Bot latency\n" +
                "**!serverinfo** - Server details\n" +
                "**!userinfo [@user]** - User info\n" +
                "**!uptime** - Bot uptime\n" +
                "**!invite** - Invite link\n\n" +
                "✨ **Use / for slash commands!**\n" +
                (isPremium ? "👑 **VelnoX Active - No prefix needed!**" : ""))
        ];

        let currentPage = 0;

        const getButtons = (page) => {
            const row = new ActionRowBuilder();
            row.addComponents(
                new ButtonBuilder().setCustomId("prev").setLabel("◀ Previous").setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId("next").setLabel("Next ▶").setStyle(ButtonStyle.Primary).setDisabled(page === pages.length - 1),
                new ButtonBuilder().setCustomId("delete").setLabel("❌ Close").setStyle(ButtonStyle.Danger)
            );
            return row;
        };

        const helpMessage = await reply({ embeds: [pages[currentPage]], components: [getButtons(currentPage)] });

        if (!isSlash) {
            const collector = helpMessage.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                time: 60000
            });

            collector.on("collect", async (interaction) => {
                if (interaction.customId === "prev") currentPage--;
                else if (interaction.customId === "next") currentPage++;
                else if (interaction.customId === "delete") {
                    await helpMessage.delete();
                    return;
                }
                await interaction.update({ embeds: [pages[currentPage]], components: [getButtons(currentPage)] });
            });

            collector.on("end", async () => {
                try { await helpMessage.edit({ components: [] }); } catch {}
            });
        }

        return;
    }

    // ========== WORK COMMAND ==========
    if (cmd === "work") {
        const user = await getUser(userId, username);
        const cooldown = checkCooldown(user.lastWork, CONFIG.COOLDOWNS.work);

        if (!cooldown.ready) {
            const embed = createEmbed(isPremium, "⏰ Cooldown", "Wait **" + cooldown.timeLeft + "** before working!");
            return await reply({ embeds: [embed] });
        }

        const earnings = Math.floor(Math.random() * 401) + 100;
        user.wallet += earnings;
        user.totalEarned += earnings;
        user.lastWork = new Date();
        await user.save();

        const jobs = ["coded a website", "debugged code", "deployed an app", "fixed a server", "designed a UI", "wrote docs"];
        const job = jobs[Math.floor(Math.random() * jobs.length)];

        const embed = createEmbed(isPremium, "💼 Work Complete!", 
            "You " + job + " and earned **" + formatMoney(earnings) + "**!\n\n💰 Wallet: " + formatMoney(user.wallet));
        return await reply({ embeds: [embed] });
    }

    // ========== BALANCE COMMAND ==========
    if (cmd === "balance" || cmd === "bal") {
        const user = await getUser(userId, username);
        const total = user.wallet + user.bank;

        const embed = createEmbed(isPremium, "💰 " + username + "'s Balance", null)
            .addFields(
                { name: "💵 Wallet", value: formatMoney(user.wallet), inline: true },
                { name: "🏦 Bank", value: formatMoney(user.bank), inline: true },
                { name: "💎 Total", value: formatMoney(total), inline: true },
                { name: "📈 Earned", value: formatMoney(user.totalEarned), inline: true },
                { name: "📉 Lost", value: formatMoney(user.totalLost), inline: true },
                { name: "🎮 W/L", value: user.gamesWon + " / " + user.gamesLost, inline: true }
            );

        if (user.isTrusted) {
            embed.setDescription("👑 **VelnoX Premium Active**");
        }

        return await reply({ embeds: [embed] });
    }

    // ========== DAILY COMMAND ==========
    if (cmd === "daily") {
        const user = await getUser(userId, username);
        const cooldown = checkCooldown(user.lastDaily, CONFIG.COOLDOWNS.daily);

        if (!cooldown.ready) {
            const embed = createEmbed(isPremium, "⏰ Daily Cooldown", "Come back **" + cooldown.timeLeft + "** for your daily!");
            return await reply({ embeds: [embed] });
        }

        const reward = 500;
        user.wallet += reward;
        user.totalEarned += reward;
        user.lastDaily = new Date();
        await user.save();

        const embed = createEmbed(isPremium, "🎁 Daily Reward!", 
            "You claimed **" + formatMoney(reward) + "**!\n\n💰 Wallet: " + formatMoney(user.wallet));
        return await reply({ embeds: [embed] });
    }

    // ========== PING COMMAND ==========
    if (cmd === "ping") {
        const latency = isSlash ? 0 : Date.now() - source.createdTimestamp;
        const embed = createEmbed(isPremium, "🏓 Pong!", 
            "**Bot:** " + (latency || "N/A") + "ms\n**API:** " + client.ws.ping + "ms\n\n" +
            (isPremium ? "👑 **VelnoX Premium Active**" : "💡 Ask owner for VelnoX access!"));
        return await reply({ embeds: [embed] });
    }

    // ========== LEADERBOARD COMMAND ==========
    if (cmd === "lb") {
        const topUsers = await User.find().sort({ wallet: -1 }).limit(10);

        let lb = "";
        topUsers.forEach((u, i) => {
            const crown = u.isTrusted ? " 👑" : "";
            lb += (i + 1) + ". **" + u.username + "**" + crown + " - " + formatMoney(u.wallet + u.bank) + "\n";
        });

        const embed = createEmbed(isPremium, "📊 Top 10 Richest", lb || "No data yet");
        embed.setFooter({ text: "👑 = VelnoX Premium" });
        return await reply({ embeds: [embed] });
    }

    // Add remaining commands (rob, crime, coinflip, dice, slot, jackpot, etc.)
    // Copy from previous version...
}

// ========== BOT LOGIN ==========
client.login(CONFIG.TOKEN).catch(err => {
    console.error("❌ LOGIN FAILED!");
    console.error("Error:", err.message);
    process.exit(1);
});

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        mongoose.connection.close().then(() => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

// ========== ERROR HANDLERS ==========
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
