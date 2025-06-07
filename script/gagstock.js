const axios = require('axios');

const activeSessions = new Map();

module.exports.run = async function ({ api, event, args }) {
  const action = args[0]?.toLowerCase();

  if (!action || !['on', 'off'].includes(action)) {
    return api.sendMessage(
      '📌 𝗨𝘀𝗮𝗴𝗲:\n• gagstock on — Start tracking\n• gagstock off — Stop tracking',
      event.threadID,
      event.messageID
    );
  }

  const senderId = event.senderID;

  if (action === 'off') {
    const session = activeSessions.get(senderId);
    if (session) {
      clearInterval(session.interval);
      activeSessions.delete(senderId);
      return api.sendMessage('🛑 Gagstock tracking stopped.', event.threadID, event.messageID);
    } else {
      return api.sendMessage('⚠️ You have no active gagstock tracking.', event.threadID, event.messageID);
    }
  }

  if (activeSessions.has(senderId)) {
    return api.sendMessage('📡 You\'re already tracking Gagstock. Use `gagstock off` to stop.', event.threadID, event.messageID);
  }

  await api.sendMessage('✅ Gagstock tracking started! You\'ll be notified on stock/weather changes.', event.threadID, event.messageID);

  const sessionData = {
    interval: null,
    lastKey: null,
    lastMsg: ''
  };

  const countdown = (updatedAt, intervalSec) => {
    const now = Date.now();
    const diff = Math.max(intervalSec - Math.floor((now - updatedAt) / 1000), 0);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${m}m ${s}s`;
  };

  const honeyCountdown = () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const m = 59 - now.getMinutes();
    const s = 60 - now.getSeconds();
    return `${m}m ${s < 10 ? `0${s}` : s}s`;
  };

  const fetchAndNotify = async () => {
    try {
      const [
        gearRes, eggRes, weatherRes, honeyRes, cosmeticsRes, emojiRes
      ] = await Promise.all([
        axios.get('https://growagardenstock.com/api/stock?type=gear-seeds'),
        axios.get('https://growagardenstock.com/api/stock?type=egg'),
        axios.get('https://growagardenstock.com/api/stock/weather'),
        axios.get('http://65.108.103.151:22377/api/stocks?type=honeyStock'),
        axios.get('https://growagardenstock.com/api/special-stock?type=cosmetics'),
        axios.get('http://65.108.103.151:22377/api/stocks?type=seedsStock')
      ]);

      const gear = gearRes.data;
      const egg = eggRes.data;
      const weather = weatherRes.data;
      const honey = honeyRes.data;
      const cosmetics = cosmeticsRes.data;
      const emojis = emojiRes.data?.seedsStock || [];

      const key = JSON.stringify({
        gear: gear.gear,
        seeds: gear.seeds,
        egg: egg.egg,
        weather: weather.updatedAt,
        honey: honey.honeyStock,
        cosmetics: cosmetics.cosmetics
      });

      if (key === sessionData.lastKey) return;
      sessionData.lastKey = key;

      const cosmeticsTimer = countdown(cosmetics.updatedAt, 14400);
      const gearTimer = countdown(gear.updatedAt, 300);
      const eggTimer = countdown(egg.updatedAt, 600);
      const honeyTimer = honeyCountdown();

      const gearText = gear.gear?.map(g => `- ${g}`).join("\n") || "None";
      const seedText = gear.seeds?.map(s => {
        const name = s.split(" **")[0];
        const emoji = emojis.find(e => e.name.toLowerCase() === name.toLowerCase())?.emoji || "";
        return `- ${emoji} ${s}`;
      }).join("\n") || "None";

      const eggText = egg.egg?.map(e => `- ${e}`).join("\n") || "None";
      const honeyText = honey.honeyStock?.map(h => `- ${h.name}: ${h.value}`).join("\n") || "None";
      const cosmeticsText = cosmetics.cosmetics?.map(c => `- ${c}`).join("\n") || "None";
      const weatherText = `${weather.icon || "☁️"} ${weather.currentWeather || "Unknown"}`;
      const cropBonus = weather.cropBonuses || "None";

      const msg = `🌿 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 — 𝗦𝘁𝗼𝗰𝗸 𝗨𝗽𝗱𝗮𝘁𝗲\n\n` +
        `🛠️ 𝗚𝗲𝗮𝗿:\n${gearText}\n\n🌱 𝗦𝗲𝗲𝗱𝘀:\n${seedText}\n\n🥚 𝗘𝗴𝗴𝘀:\n${eggText}\n\n` +
        `🎨 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀:\n${cosmeticsText}\n⏳ 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰 𝗿𝗲𝘀𝘁𝗼𝗰𝗸: ${cosmeticsTimer}\n\n` +
        `🍯 𝗛𝗼𝗻𝗲𝘆:\n${honeyText}\n⏳ 𝗛𝗼𝗻𝗲𝘆 𝗿𝗲𝘀𝘁𝗼𝗰𝗸: ${honeyTimer}\n\n` +
        `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿: ${weatherText}\n🪴 𝗖𝗿𝗼𝗽 𝗕𝗼𝗻𝘂𝘀: ${cropBonus}\n\n` +
        `📅 𝗚𝗲𝗮𝗿/𝗦𝗲𝗲𝗱 𝗿𝗲𝘀𝘁𝗼𝗰𝗸: ${gearTimer}\n📅 𝗘𝗴𝗴 𝗿𝗲𝘀𝘁𝗼𝗰𝗸: ${eggTimer}`;

      if (msg !== sessionData.lastMsg) {
        sessionData.lastMsg = msg;
        await api.sendMessage(msg, event.threadID);
      }

    } catch (err) {
      console.error('gagstock error:', err.message);
    }
  };

  sessionData.interval = setInterval(fetchAndNotify, 10000);
  activeSessions.set(senderId, sessionData);
  await fetchAndNotify();
};

module.exports.config = {
  name: 'gagstock',
  version: '1.0.0',
  hasPermission: 0,
  credits: 'Jerome',
  description: 'Track Grow A Garden stocks, weather, and cosmetics in real time.',
  usage: 'gagstock on | gagstock off',
  cooldown: 5
};
