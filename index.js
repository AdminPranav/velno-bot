require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { Client, Events, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

// MongoDB Connection with Retry Logic
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
                <p>50+ Commands • Economy • Casino • Business</p>
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

// ROAST LINES
const roastLines = [
    "Arre madarchod, tu itna ghatiya hai ki teri maa bhi tujhe dekh ke roti hai!",
    "Bhenchod, tera face dekh ke toh darwaza bhi bolta hai – Bhai, yeh kya laaya?",
    "Saale, tu itna harami hai ki haramkhor bhi tujhse sharma jaye.",
    "Madarchod, tera dimaag toh teri maa ke pet mein hi reh gaya tha kya?",
    "Bhen ke lode, tu itna slow hai ki kachhua bhi tujhe thappad maare.",
    "Chutiye, tera IQ toh zero se bhi neeche hai – negative mein chala gaya.",
    "Madarchod, tu itna fake hai ki teri behen bhi tujhe pehchanti nahi.",
    "Bhenchod, tera style dekh ke toh kutta bhi bolta hai – Bhai, yeh kya pehna hai?",
    "Saale haramzade, tu itna kanjoos hai ki free ka paani bhi nahi peeta.",
    "Chut ka pujari, tera face toh Photoshop mein bhi fix nahi hota.",
    "Madarchod, tu itna boring hai ki teri maa bhi tujhse baat nahi karti.",
    "Bhen ke takke, tera brain toh airplane mode pe hai – signal zero.",
    "Saale, tu itna loser hai ki Ludo mein bhi CPU se haar jata hai.",
    "Chutiye, tera sense of humor toh teri behen ke jokes se bhi bura hai.",
    "Madarchod, tu itna ugly hai ki mirror bhi toot jata hai tujhe dekh ke."
];

const complimentLines = [
    "Bhai, tu actually decent hai – tera sense of humor sahi hai!",
    "Respect! Tu apne skills ke liye known hai server mein.",
    "Tu actually chill person hai – log tujhe like karti hain.",
    "Your dedication is insane bro – keep it up!",
    "Bhai, tu actually smart choices make karta hai.",
    "Tu ek dum chamatkar ho – no lie!",
    "Your vibe is immaculate – shuddh class!",
    "Actually you are way cooler than you think!",
    "Respect the hustle – tu genuinely hard working hai!",
    "You have more brain cells than the average person!"
];

// BUSINESS PASSIVE INCOME - Runs every hour
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
            text: isPremium ? "VelnoX • Cool mind. Sharp code." : "Velno • Smart. Simple. Steady.",
            iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp();
}

client.once(Events.ClientReady, (readyClient) => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║   ✅ VELNO BOT ONLINE!               ║');
    console.log('║   50+ COMMANDS • LIVE ECONOMY        ║');
    console.log('║   BUSINESSES • ROASTS • CASINO       ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('✓ Logged in as ' + readyClient.user.tag);
    console.log('✓ Prefix: ' + CONFIG.PREFIX);
    console.log('✓ Commands: 50+');
    console.log('══════════════════════════════════════\n');

    client.user.setActivity("Velno • Type !help", { type: 0 });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    let commandName, args;

    if (message.content.startsWith(CONFIG.PREFIX)) {
        const argsRaw = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
        commandName = argsRaw.shift().toLowerCase();
        args = argsRaw;
    } else {
        return;
    }

    try {
        await handleCommand(message, commandName, args);
    } catch (error) {
        console.error('Command Error:', error);
        message.reply("❌ An error occurred!");
    }
});

async function handleCommand(message, cmd, args) {
    const member = message.member;
    const isPremium = isPremiumUser(member);

    // ========== HELP COMMAND ==========
    if (cmd === 'help') {
        const pages = [
            createEmbed(member, "💰 Economy (Page 1/6)", null)
                .addFields(
                    { name: "!work", value: "Earn V-Coins (10s)", inline: true },
                    { name: "!balance", value: "Check balance", inline: true },
                    { name: "!deposit <amt>", value: "Deposit to bank", inline: true },
                    { name: "!withdraw <amt>", value: "Withdraw", inline: true },
                    { name: "!rob", value: "Quick rob (10s)", inline: true },
                    { name: "!crime", value: "Risky crime (10s)", inline: true },
                    { name: "!steal @user", value: "Steal (10min)", inline: true },
                    { name: "!daily", value: "Daily reward (24h)", inline: true },
                    { name: "!lb", value: "Top 10 rich", inline: true }
                ),

            createEmbed(member, "🏢 Business (Page 2/6)", null)
                .addFields(
                    { name: "!startbiz <name>", value: "5000 V-Coins", inline: true },
                    { name: "!bizstats", value: "View stats", inline: true },
                    { name: "!hire @user", value: "Hire employee", inline: true },
                    { name: "!upgrade", value: "Upgrade level", inline: true }
                )
                .setDescription("💹 Passive income every hour!"),

            createEmbed(member, "🎰 Casino (Page 3/6)", null)
                .addFields(
                    { name: "!coinflip <bet>", value: "50/50 (3s)", inline: true },
                    { name: "!dice <bet>", value: "Roll dice (3s)", inline: true },
                    { name: "!slot <bet>", value: "5x jackpot (5s)", inline: true },
                    { name: "!jackpot <bet>", value: "2% mega (5s)", inline: true }
                )
                .setDescription("🎊 Animated games with rewards!"),

            createEmbed(member, "🎭 Fun (Page 4/6)", null)
                .addFields(
                    { name: "!roast [@user]", value: "Roasts (30s)", inline: true },
                    { name: "!compliment [@user]", value: "Nice words (30s)", inline: true },
                    { name: "!joke", value: "Random joke", inline: true },
                    { name: "!quote", value: "Inspiration", inline: true }
                ),

            createEmbed(member, "🛡️ Moderation (Page 5/6)", null)
                .addFields(
                    { name: "!warn @user", value: "Warn member", inline: true },
                    { name: "!kick @user", value: "Kick member", inline: true },
                    { name: "!ban @user", value: "Ban member", inline: true },
                    { name: "!clear <amt>", value: "Bulk delete", inline: true },
                    { name: "!mute @user", value: "Mute member", inline: true },
                    { name: "!unmute @user", value: "Unmute member", inline: true },
                    { name: "!lock", value: "Lock channel", inline: true },
                    { name: "!unlock", value: "Unlock channel", inline: true }
                ),

            createEmbed(member, "📂 Utility (Page 6/6)", null)
                .addFields(
                    { name: "!ping", value: "Bot latency", inline: true },
                    { name: "!serverinfo", value: "Server details", inline: true },
                    { name: "!userinfo [@user]", value: "User info", inline: true },
                    { name: "!uptime", value: "Bot uptime", inline: true },
                    { name: "!invite", value: "Invite link", inline: true }
                )
                .setDescription("🛠️ General utilities!")
        ];

        let currentPage = 0;

        const getButtons = (page) => {
            const row = new ActionRowBuilder();
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId("prev")
                    .setLabel("◀ Previous")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId("next")
                    .setLabel("Next ▶")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === pages.length - 1),
                new ButtonBuilder()
                    .setCustomId("delete")
                    .setLabel("❌ Close")
                    .setStyle(ButtonStyle.Danger)
            );
            return row;
        };

        const helpMessage = await message.reply({
            embeds: [pages[currentPage]],
            components: [getButtons(currentPage)]
        });

        const collector = helpMessage.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 60000
        });

        collector.on("collect", async (interaction) => {
            if (interaction.customId === "prev") {
                currentPage--;
            } else if (interaction.customId === "next") {
                currentPage++;
            } else if (interaction.customId === "delete") {
                await helpMessage.delete();
                return;
            }
            await interaction.update({
                embeds: [pages[currentPage]],
                components: [getButtons(currentPage)]
            });
        });

        collector.on("end", async () => {
            try {
                await helpMessage.edit({ components: [] });
            } catch {}
        });

        return;
    }

    // ========== ROAST COMMAND ==========
    if (cmd === "roast") {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastRoast, CONFIG.COOLDOWNS.roast);

        if (!cooldown.ready) {
            const embed = createEmbed(member, "⏰ Cooldown", "Wait **" + cooldown.timeLeft + "** before roasting again!");
            return message.reply({ embeds: [embed] });
        }

        const target = message.mentions.users.first() || message.author;
        const roast = roastLines[Math.floor(Math.random() * roastLines.length)];

        user.lastRoast = new Date();
        user.roastCount += 1;
        await user.save();

        const embed = createEmbed(member, "🔥 ROASTED! 🔥", target.toString() + "\n\n" + roast)
            .setColor("#FF4444");

        return message.reply({ embeds: [embed] });
    }

    // ========== COMPLIMENT COMMAND ==========
    if (cmd === "compliment" || cmd === "comp") {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastCompliment, CONFIG.COOLDOWNS.compliment);

        if (!cooldown.ready) {
            const embed = createEmbed(member, "⏰ Cooldown", "Wait **" + cooldown.timeLeft + "** before complimenting!");
            return message.reply({ embeds: [embed] });
        }

        const target = message.mentions.users.first() || message.author;
        const compliment = complimentLines[Math.floor(Math.random() * complimentLines.length)];

        user.lastCompliment = new Date();
        await user.save();

        const embed = createEmbed(member, "💖 COMPLIMENT! 💖", target.toString() + "\n\n" + compliment)
            .setColor(CONFIG.COLORS.success);

        return message.reply({ embeds: [embed] });
    }

    // ========== WORK COMMAND ==========
    if (cmd === "work") {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastWork, CONFIG.COOLDOWNS.work);

        if (!cooldown.ready) {
            const embed = createEmbed(member, "⏰ Cooldown", "Wait **" + cooldown.timeLeft + "** before working!");
            return message.reply({ embeds: [embed] });
        }

        const earnings = Math.floor(Math.random() * 401) + 100;
        user.wallet += earnings;
        user.totalEarned += earnings;
        user.lastWork = new Date();
        await user.save();

        const jobs = ["coded a website", "debugged code", "deployed an app", "fixed a server", "designed a UI", "wrote docs"];
        const job = jobs[Math.floor(Math.random() * jobs.length)];

        const embed = createEmbed(member, "💼 Work Complete!", 
            "You " + job + " and earned **" + formatMoney(earnings) + "**!\n\n💰 Wallet: " + formatMoney(user.wallet));
        return message.reply({ embeds: [embed] });
    }

    // ========== BALANCE COMMAND ==========
    if (cmd === "balance" || cmd === "bal") {
        const targetUser = message.mentions.users.first() || message.author;
        const user = await getUser(targetUser.id, targetUser.username);
        const total = user.wallet + user.bank;

        const embed = createEmbed(member, "💰 " + targetUser.username + "'s Balance", null)
            .addFields(
                { name: "💵 Wallet", value: formatMoney(user.wallet), inline: true },
                { name: "🏦 Bank", value: formatMoney(user.bank), inline: true },
                { name: "💎 Total", value: formatMoney(total), inline: true },
                { name: "📈 Earned", value: formatMoney(user.totalEarned), inline: true },
                { name: "📉 Lost", value: formatMoney(user.totalLost), inline: true },
                { name: "🎮 W/L", value: user.gamesWon + " / " + user.gamesLost, inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    // ========== DEPOSIT COMMAND ==========
    if (cmd === "deposit" || cmd === "dep") {
        const user = await getUser(message.author.id, message.author.username);
        let amount = parseInt(args[0]);

        if (args[0] === "all" || args[0] === "max") amount = user.wallet;
        if (!amount || amount <= 0 || isNaN(amount)) return message.reply("❌ Invalid amount!");
        if (amount > user.wallet) return message.reply("❌ Insufficient balance!");

        user.wallet -= amount;
        user.bank += amount;
        await user.save();

        const embed = createEmbed(member, "🏦 Deposit Success", 
            "Deposited **" + formatMoney(amount) + "**\n\n💵 Wallet: " + formatMoney(user.wallet) + "\n🏦 Bank: " + formatMoney(user.bank));
        return message.reply({ embeds: [embed] });
    }

    // ========== WITHDRAW COMMAND ==========
    if (cmd === "withdraw" || cmd === "with") {
        const user = await getUser(message.author.id, message.author.username);
        let amount = parseInt(args[0]);

        if (args[0] === "all" || args[0] === "max") amount = user.bank;
        if (!amount || amount <= 0 || isNaN(amount)) return message.reply("❌ Invalid amount!");
        if (amount > user.bank) return message.reply("❌ Insufficient bank balance!");

        user.bank -= amount;
        user.wallet += amount;
        await user.save();

        const embed = createEmbed(member, "💵 Withdrawal Success", 
            "Withdrew **" + formatMoney(amount) + "**\n\n💵 Wallet: " + formatMoney(user.wallet) + "\n🏦 Bank: " + formatMoney(user.bank));
        return message.reply({ embeds: [embed] });
    }

    // ========== ROB COMMAND ==========
    if (cmd === "rob") {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastRob, CONFIG.COOLDOWNS.rob);

        if (!cooldown.ready) {
            const embed = createEmbed(member, "⏰ Cooldown", "Wait **" + cooldown.timeLeft + "** before robbing!");
            return message.reply({ embeds: [embed] });
        }

        const earnings = Math.floor(Math.random() * 201) + 50;
        user.wallet += earnings;
        user.totalEarned += earnings;
        user.lastRob = new Date();
        await user.save();

        const embed = createEmbed(member, "🦹 Quick Rob!", 
            "You stole **" + formatMoney(earnings) + "**!\n\n💰 Wallet: " + formatMoney(user.wallet));
        return message.reply({ embeds: [embed] });
    }

    // ========== CRIME COMMAND ==========
    if (cmd === "crime") {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastCrime, CONFIG.COOLDOWNS.crime);

        if (!cooldown.ready) {
            const embed = createEmbed(member, "⏰ Cooldown", "Wait **" + cooldown.timeLeft + "** before committing crime!");
            return message.reply({ embeds: [embed] });
        }

        const success = Math.random() > 0.3;

        if (success) {
            const earnings = Math.floor(Math.random() * 701) + 200;
            user.wallet += earnings;
            user.totalEarned += earnings;
            user.lastCrime = new Date();
            await user.save();

            const embed = createEmbed(member, "🎭 Crime Success!", 
                "You earned **" + formatMoney(earnings) + "**!\n\n💰 Wallet: " + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        } else {
            const fine = Math.floor(Math.random() * 301) + 100;
            const actualFine = Math.min(fine, user.wallet);
            user.wallet -= actualFine;
            user.totalLost += actualFine;
            user.lastCrime = new Date();
            await user.save();

            const embed = createEmbed(member, "🚔 Crime Failed!", 
                "You got caught! Fined **" + formatMoney(actualFine) + "**!\n\n💰 Wallet: " + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        }
    }

    // ========== DAILY COMMAND ==========
    if (cmd === "daily") {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastDaily, CONFIG.COOLDOWNS.daily);

        if (!cooldown.ready) {
            const embed = createEmbed(member, "⏰ Daily Cooldown", "Come back **" + cooldown.timeLeft + "** for your daily!");
            return message.reply({ embeds: [embed] });
        }

        const reward = 500;
        user.wallet += reward;
        user.totalEarned += reward;
        user.lastDaily = new Date();
        await user.save();

        const embed = createEmbed(member, "🎁 Daily Reward!", 
            "You claimed **" + formatMoney(reward) + "**!\n\n💰 Wallet: " + formatMoney(user.wallet));
        return message.reply({ embeds: [embed] });
    }

    // ========== LEADERBOARD COMMAND ==========
    if (cmd === "lb") {
        const topUsers = await User.find().sort({ wallet: -1 }).limit(10);

        let lb = "";
        topUsers.forEach((u, i) => {
            lb += (i + 1) + ". **" + u.username + "** - " + formatMoney(u.wallet + u.bank) + "\n";
        });

        const embed = createEmbed(member, "📊 Top 10 Richest", lb || "No data yet");
        return message.reply({ embeds: [embed] });
    }

    // ========== BUSINESS COMMANDS ==========
    if (cmd === "startbiz") {
        const bizName = args.join(" ");
        if (!bizName) return message.reply("❌ Usage: !startbiz <business name>");

        const user = await getUser(message.author.id, message.author.username);
        if (user.wallet < 5000) return message.reply("❌ Need 5000 V-Coins to start a business!");

        const bizId = message.author.id + "_" + Date.now();
        await Business.create({
            businessId: bizId,
            ownerId: message.author.id,
            ownerName: message.author.username,
            name: bizName,
            type: "general",
            level: 1,
            revenue: 0,
            employees: [],
            createdAt: new Date()
        });

        user.wallet -= 5000;
        user.businessId = bizId;
        await user.save();

        const embed = createEmbed(member, "🏢 Business Created!", 
            "**" + bizName + "**\n\nCost: 5000 V-Coins\nWallet: " + formatMoney(user.wallet));
        return message.reply({ embeds: [embed] });
    }

    if (cmd === "bizstats") {
        const user = await getUser(message.author.id, message.author.username);
        if (!user.businessId) return message.reply("❌ You don't own a business! Use !startbiz <name>");

        const business = await Business.findOne({ businessId: user.businessId });
        if (!business) return message.reply("❌ Business not found!");

        const embed = createEmbed(member, "📊 Business Stats", null)
            .addFields(
                { name: "🏢 Name", value: business.name, inline: true },
                { name: "📈 Level", value: business.level.toString(), inline: true },
                { name: "💰 Revenue", value: formatMoney(business.revenue), inline: true },
                { name: "👥 Employees", value: business.employees.length.toString(), inline: true },
                { name: "💸 Profit/Hour", value: formatMoney(business.level * 100), inline: true },
                { name: "🆙 Upgrade Cost", value: formatMoney(business.upgradeCost), inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === "hire") {
        const user = await getUser(message.author.id, message.author.username);
        if (!user.businessId) return message.reply("❌ You don't own a business!");

        const target = message.mentions.users.first();
        if (!target) return message.reply("❌ Mention a user to hire!");

        const business = await Business.findOne({ businessId: user.businessId });
        if (!business) return message.reply("❌ Business not found!");

        if (business.employees.includes(target.id)) return message.reply("❌ Already employed!");

        business.employees.push(target.id);
        await business.save();

        const embed = createEmbed(member, "💼 Employee Hired!", 
            target.tag + " now works for " + business.name + "!\n\n💰 20% of profits every hour!");
        return message.reply({ embeds: [embed] });
    }

    if (cmd === "upgrade") {
        const user = await getUser(message.author.id, message.author.username);
        if (!user.businessId) return message.reply("❌ You don't own a business!");

        const business = await Business.findOne({ businessId: user.businessId });
        if (!business) return message.reply("❌ Business not found!");

        if (user.wallet < business.upgradeCost) return message.reply("❌ Need: " + formatMoney(business.upgradeCost));

        user.wallet -= business.upgradeCost;
        business.level += 1;
        business.upgradeCost = Math.floor(business.upgradeCost * 1.5);
        business.profitMultiplier += 0.1;

        await user.save();
        await business.save();

        const embed = createEmbed(member, "⬆️ Business Upgraded!", 
            business.name + " is now Level " + business.level + "!\n\n💰 Profit/Hour: " + formatMoney(business.level * 100) + "\n💵 Wallet: " + formatMoney(user.wallet));
        return message.reply({ embeds: [embed] });
    }

    // ========== CASINO COMMANDS ==========
    if (cmd === "coinflip" || cmd === "cf") {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastCoinflip, CONFIG.COOLDOWNS.coinflip);

        if (!cooldown.ready) return message.reply("❌ Wait " + cooldown.timeLeft + " before flipping!");
        if (!args[0]) return message.reply("❌ Usage: !coinflip <bet>");

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply("❌ Invalid bet!");

        user.lastCoinflip = new Date();
        const win = Math.random() > 0.5;

        if (win) {
            user.wallet += bet;
            user.totalEarned += bet;
            user.gamesWon += 1;
            await user.save();

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.success)
                .setTitle("🪙 YOU WIN!")
                .setDescription("**Won:** " + formatMoney(bet) + "\n💰 Balance: " + formatMoney(user.wallet))
                .setFooter({ text: "VelnoX • Cool mind. Sharp code." })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        } else {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.error)
                .setTitle("🪙 YOU LOSE!")
                .setDescription("**Lost:** " + formatMoney(bet) + "\n💰 Balance: " + formatMoney(user.wallet))
                .setFooter({ text: "VelnoX • Cool mind. Sharp code." })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === "dice") {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastDice, CONFIG.COOLDOWNS.dice);

        if (!cooldown.ready) return message.reply("❌ Wait " + cooldown.timeLeft + " before rolling!");
        if (!args[0]) return message.reply("❌ Usage: !dice <bet>");

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply("❌ Invalid bet!");

        user.lastDice = new Date();
        const playerRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll = Math.floor(Math.random() * 6) + 1;

        if (playerRoll > botRoll) {
            user.wallet += bet;
            user.totalEarned += bet;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, "🎲 YOU WIN!", 
                "You: " + playerRoll + " | Bot: " + botRoll + "\n**Won:** " + formatMoney(bet) + "\n💰 Balance: " + formatMoney(user.wallet));
            embed.setColor(CONFIG.COLORS.success);
            return message.reply({ embeds: [embed] });
        } else if (playerRoll < botRoll) {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const embed = createEmbed(member, "🎲 YOU LOSE!", 
                "You: " + playerRoll + " | Bot: " + botRoll + "\n**Lost:** " + formatMoney(bet) + "\n💰 Balance: " + formatMoney(user.wallet));
            embed.setColor(CONFIG.COLORS.error);
            return message.reply({ embeds: [embed] });
        } else {
            await user.save();
            const embed = createEmbed(member, "🎲 TIE!", 
                "You: " + playerRoll + " | Bot: " + botRoll + "\n**No money lost or won**\n💰 Balance: " + formatMoney(user.wallet));
            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === "slot") {
        const user = await getUser(message.author.id, message.author.username);
        const cooldown = checkCooldown(user.lastSlot, CONFIG.COOLDOWNS.slot);

        if (!cooldown.ready) return message.reply("❌ Wait " + cooldown.timeLeft + " before spinning!");
        if (!args[0]) return message.reply("❌ Usage: !slot <bet>");

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply("❌ Invalid bet!");

        user.lastSlot = new Date();
        const symbols = ["🍎", "🍊", "🍋", "🍌", "🍉", "7️⃣"];
        const roll1 = symbols[Math.floor(Math.random() * symbols.length)];
        const roll2 = symbols[Math.floor(Math.random() * symbols.length)];
        const roll3 = symbols[Math.floor(Math.random() * symbols.length)];

        const result = roll1 + " | " + roll2 + " | " + roll3;

        if (roll1 === roll2 && roll2 === roll3) {
            const winnings = bet * 5;
            user.wallet += winnings;
            user.totalEarned += winnings;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, "🎰 JACKPOT!!!", 
                result + "\n\n🎉 YOU WON **" + formatMoney(winnings) + "**!\n💰 Balance: " + formatMoney(user.wallet));
            embed.setColor(CONFIG.COLORS.success);
            return message.reply({ embeds: [embed] });
        } else if (roll1 === roll2 || roll2 === roll3) {
            const winnings = bet * 2;
            user.wallet += winnings;
            user.totalEarned += winnings;
            user.gamesWon += 1;
            await user.save();

            const embed = createEmbed(member, "🎰 TWO MATCH!", 
                result + "\n\n✨ Won **" + formatMoney(winnings) + "**!\n💰 Balance: " + formatMoney(user.wallet));
            embed.setColor(CONFIG.COLORS.success);
            return message.reply({ embeds: [embed] });
        } else {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            await user.save();

            const embed = createEmbed(member, "🎰 NO MATCH", 
                result + "\n\n❌ Lost **" + formatMoney(bet) + "**!\n💰 Balance: " + formatMoney(user.wallet));
            embed.setColor(CONFIG.COLORS.error);
            return message.reply({ embeds: [embed] });
        }
    }

    if (cmd === "jackpot") {
        const user = await getUser(message.author.id, message.author.username);
        const global = await getGlobal();
        const cooldown = checkCooldown(user.lastJackpot, CONFIG.COOLDOWNS.jackpot);

        if (!cooldown.ready) return message.reply("❌ Wait " + cooldown.timeLeft + "!");
        if (!args[0]) return message.reply("❌ Usage: !jackpot <bet>");

        let bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || bet > user.wallet) return message.reply("❌ Invalid bet!");

        user.lastJackpot = new Date();
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

            const embed = createEmbed(member, "💎 MEGA JACKPOT!!!", 
                "🎊 YOU WON **" + formatMoney(jackpot) + "**!!!\n💰 Balance: " + formatMoney(user.wallet));
            embed.setColor("#FFD700");
            return message.reply({ embeds: [embed] });
        } else {
            user.wallet -= bet;
            user.totalLost += bet;
            user.gamesLost += 1;
            global.jackpot += bet;
            global.totalGambled += bet;
            await user.save();
            await global.save();

            const embed = createEmbed(member, "🎲 Jackpot", 
                "Pool: **" + formatMoney(global.jackpot) + "**\n❌ Lost **" + formatMoney(bet) + "**!\n💰 Balance: " + formatMoney(user.wallet));
            embed.setColor(CONFIG.COLORS.error);
            return message.reply({ embeds: [embed] });
        }
    }

    // ========== UTILITY COMMANDS ==========
    if (cmd === "ping") {
        const sent = await message.reply("🏓 Pinging...");
        const latency = sent.createdTimestamp - message.createdTimestamp;

        const embed = createEmbed(member, "🏓 Pong!", 
            "**Bot:** " + latency + "ms\n**API:** " + client.ws.ping + "ms");
        return sent.edit({ content: null, embeds: [embed] });
    }

    if (cmd === "serverinfo") {
        const guild = message.guild;
        const embed = createEmbed(member, "📊 " + guild.name, null)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: "👑 Owner", value: "<@" + guild.ownerId + ">", inline: true },
                { name: "👥 Members", value: guild.memberCount.toString(), inline: true },
                { name: "📝 Channels", value: guild.channels.cache.size.toString(), inline: true },
                { name: "📅 Created", value: "<t:" + Math.floor(guild.createdTimestamp / 1000) + ":R>", inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === "userinfo") {
        const target = message.mentions.members.first() || member;
        const userPremium = isPremiumUser(target);

        const embed = createEmbed(member, "👤 " + target.user.tag, null)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "🆔 ID", value: target.id, inline: true },
                { name: "👑 Premium", value: userPremium ? "Yes ✅" : "No", inline: true },
                { name: "📅 Joined", value: "<t:" + Math.floor(target.joinedTimestamp / 1000) + ":R>", inline: true }
            );

        return message.reply({ embeds: [embed] });
    }

    if (cmd === "joke") {
        const jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs!",
            "Why did the developer go broke? Because he used up all his cache!",
            "Why do Java developers wear glasses? Because they cannot C#!",
            "A SQL query walks into a bar... asks two tables if he can join them.",
            "Why do programmers always confuse Halloween and Christmas? Oct 31 == Dec 25!"
        ];

        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        const embed = createEmbed(member, "😄 Random Joke", joke);

        return message.reply({ embeds: [embed] });
    }

    if (cmd === "quote") {
        const quotes = [
            "The only way to do great work is to love what you do. - Steve Jobs",
            "Innovation distinguishes between a leader and a follower. - Steve Jobs",
            "Life is what happens when you are busy making other plans. - John Lennon",
            "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
            "It is during our darkest moments that we must focus to see the light. - Aristotle"
        ];

        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        const embed = createEmbed(member, "✨ Random Quote", quote);

        return message.reply({ embeds: [embed] });
    }

    if (cmd === "uptime") {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const seconds = Math.floor(uptime % 60);

        const embed = createEmbed(member, "⏰ Bot Uptime", 
            days + "d " + hours + "h " + minutes + "m " + seconds + "s");
        return message.reply({ embeds: [embed] });
    }

    if (cmd === "invite") {
        const embed = createEmbed(member, "📬 Invite Velno", 
            "[Click here to invite](https://discord.com/api/oauth2/authorize?client_id=" + CONFIG.CLIENT_ID + "&permissions=8&scope=bot%20applications.commands)");
        return message.reply({ embeds: [embed] });
    }

    // ========== MODERATION COMMANDS ==========
    if (cmd === "warn") {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply("❌ You need ModerateMembers permission!");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply("⚠️ Mention a user!");

        const reason = args.slice(1).join(" ") || "No reason";
        const user = await getUser(target.user.id, target.user.username);
        user.warns += 1;
        await user.save();

        try {
            await target.send("⚠️ Warned in **" + message.guild.name + "**\nReason: " + reason + "\nWarns: " + user.warns);
        } catch {}

        const embed = createEmbed(member, "✅ User Warned", 
            "**User:** " + target.user.tag + "\n**Reason:** " + reason + "\n**Warns:** " + user.warns);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === "kick") {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply("❌ You need KickMembers permission!");
        }

        const target = message.mentions.members.first();
        if (!target || !target.kickable) return message.reply("❌ Cannot kick this user!");

        const reason = args.slice(1).join(" ") || "No reason";
        await target.kick(reason);

        const embed = createEmbed(member, "✅ User Kicked", 
            "**User:** " + target.user.tag + "\n**Reason:** " + reason);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === "ban") {
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply("❌ You need BanMembers permission!");
        }

        const target = message.mentions.members.first();
        if (!target || !target.bannable) return message.reply("❌ Cannot ban this user!");

        const reason = args.slice(1).join(" ") || "No reason";
        await target.ban({ reason });

        const embed = createEmbed(member, "✅ User Banned", 
            "**User:** " + target.user.tag + "\n**Reason:** " + reason);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === "clear") {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply("❌ You need ManageMessages permission!");
        }

        const amount = parseInt(args[0]) || 10;
        if (amount < 1 || amount > 100) return message.reply("❌ Clear 1-100 messages!");

        await message.channel.bulkDelete(amount + 1);

        const embed = createEmbed(member, "✅ Cleared", "Deleted **" + amount + "** messages!");
        const msg = await message.channel.send({ embeds: [embed] });
        setTimeout(() => msg.delete().catch(() => {}), 3000);
    }

    if (cmd === "mute") {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply("❌ You need permissions!");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply("⚠️ Mention a user!");

        const muteRole = message.guild.roles.cache.find(r => r.name === "Muted") || 
                        await message.guild.roles.create({ name: "Muted", color: "#FF0000", permissions: [] });

        await target.roles.add(muteRole);

        const embed = createEmbed(member, "🔇 User Muted", "**User:** " + target.user.tag);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === "unmute") {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply("❌ You need permissions!");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply("⚠️ Mention a user!");

        const muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
        if (muteRole) await target.roles.remove(muteRole);

        const embed = createEmbed(member, "🔊 User Unmuted", "**User:** " + target.user.tag);
        return message.reply({ embeds: [embed] });
    }

    if (cmd === "lock") {
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply("❌ You need permissions!");
        }

        await message.channel.permissionOverwrites.create(message.guild.roles.everyone, { SendMessages: false });

        const embed = createEmbed(member, "🔒 Channel Locked", "Channel is now locked!");
        return message.reply({ embeds: [embed] });
    }

    if (cmd === "unlock") {
        if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply("❌ You need permissions!");
        }

        await message.channel.permissionOverwrites.delete(message.guild.roles.everyone);

        const embed = createEmbed(member, "🔓 Channel Unlocked", "Channel is now unlocked!");
        return message.reply({ embeds: [embed] });
    }
}

// ========== BOT LOGIN ==========
client.login(CONFIG.TOKEN).catch(err => {
    console.error("❌ LOGIN FAILED!");
    console.error("Error:", err.message);
    
    if (err.message.includes('token')) {
        console.error("⚠️  CHECK YOUR TOKEN IN .env FILE!");
    }
    
    if (err.message.includes('intents')) {
        console.error("⚠️  ENABLE INTENTS IN DISCORD DEVELOPER PORTAL!");
    }
    
    process.exit(1);
});

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        mongoose.connection.close(false, () => {
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
