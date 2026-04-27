require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// ========================
// KONFIGURATSIYA
// ========================
const BOT_TOKEN   = '8679225810:AAE-u-SX3esTae23LY09dYyAz_cgIPH4j_4';
const CHANNEL_ID  = '-1003920803109';
const SUPABASE_URL = 'https://vxpvgeyktgyasegvycfp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pXpHGuZFzmhJUD6FkQeapQ__7D78i4w';

// O'zbekiston vaqt zonasi offset (UTC+5) — daqiqada
const UZT_OFFSET_MS = 5 * 60 * 60 * 1000;

// ========================
// INIT
// ========================
const bot      = new TelegramBot(BOT_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SITE_LABELS = { a: '🅰️ A Sayt', b: '🅱️ B Sayt', c: '🅾️ C Sayt', d: '🔷 D Sayt' };
const SITE_KEYS   = ['a', 'b', 'c', 'd'];

// Temp papka
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// ========================
// VAQT FUNKSIYALARI (UTC+5 — O'zbekiston)
// ========================

// ISO string yoki Date -> UTC+5 da { year, month, day, hours, minutes }
function toUZT(val) {
  const utcMs = (val instanceof Date ? val : new Date(val)).getTime();
  const uzt   = new Date(utcMs + UZT_OFFSET_MS);
  return {
    year:    uzt.getUTCFullYear(),
    month:   uzt.getUTCMonth() + 1,
    day:     uzt.getUTCDate(),
    hours:   uzt.getUTCHours(),
    minutes: uzt.getUTCMinutes(),
  };
}

function pad(n) { return String(n).padStart(2, '0'); }

// "28.04.2026 00:30" (UZT)
function formatDate(isoStr) {
  if (!isoStr) return '';
  const t = toUZT(isoStr);
  return `${pad(t.day)}.${pad(t.month)}.${t.year} ${pad(t.hours)}:${pad(t.minutes)}`;
}

// "28.04.2026" (UZT)
function formatDateOnly(isoStr) {
  if (!isoStr) return '';
  const t = toUZT(isoStr);
  return `${pad(t.day)}.${pad(t.month)}.${t.year}`;
}

// Hozirgi O'zbekiston vaqti "28.04.2026 00:30"
function nowUZT() {
  return formatDate(new Date().toISOString());
}

// Hozirgi O'zbekiston sanasi "28.04.2026"
function todayUZT() {
  return formatDateOnly(new Date().toISOString());
}

// Saralash uchun: "28.04.2026" -> "2026.04.28"
function sortableDate(ddmmyyyy) {
  return ddmmyyyy.split('.').reverse().join('.');
}

// ========================
// SUPABASE FUNKSIYALAR
// ========================

async function getWebinarLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Webinar leads xatosi: ${error.message}`);
  return data || [];
}

async function getHuzurLeads() {
  const { data, error } = await supabase
    .from('huzur')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Huzur leads xatosi: ${error.message}`);
  return data || [];
}

async function getWebinarBySite(site) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('type', site)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Webinar site xatosi: ${error.message}`);
  return data || [];
}

// ========================
// EXCEL YARATUVCHI FUNKSIYALAR
// ========================

async function createWebinarExcel(leads, filename = 'webinar_leads.xlsx') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leads Bot';
  wb.created = new Date();

  // Sheet 1: Barcha userlar
  const wsAll = wb.addWorksheet('Barcha Userlar');
  wsAll.columns = [
    { header: '№',           key: 'num',          width: 6  },
    { header: "To'liq Ism",  key: 'full_name',     width: 25 },
    { header: 'Telefon',     key: 'phone_number',  width: 18 },
    { header: 'Sayt',        key: 'type',          width: 12 },
    { header: 'Sana (UZT)',  key: 'created_at',    width: 22 },
  ];
  styleHeader(wsAll);
  leads.forEach((l, i) => {
    wsAll.addRow({
      num:          i + 1,
      full_name:    l.full_name    || '',
      phone_number: l.phone_number || '',
      type:         (l.type || '').toUpperCase(),
      created_at:   formatDate(l.created_at),
    });
  });
  autoStyle(wsAll);

  // Sheet 2-5: Har bir sayt bo'yicha
  for (const site of SITE_KEYS) {
    const siteLeads = leads.filter(l => (l.type || '').toLowerCase() === site);
    const ws = wb.addWorksheet(`${site.toUpperCase()} Sayt`);
    ws.columns = [
      { header: '№',          key: 'num',          width: 6  },
      { header: "To'liq Ism", key: 'full_name',     width: 25 },
      { header: 'Telefon',    key: 'phone_number',  width: 18 },
      { header: 'Sana (UZT)', key: 'created_at',    width: 22 },
    ];
    styleHeader(ws);
    siteLeads.forEach((l, i) => {
      ws.addRow({
        num:          i + 1,
        full_name:    l.full_name    || '',
        phone_number: l.phone_number || '',
        created_at:   formatDate(l.created_at),
      });
    });
    autoStyle(ws);
  }

  // Sheet 6: Kunlik statistika
  const wsStats = wb.addWorksheet('Kunlik Statistika');
  wsStats.columns = [
    { header: 'Sana (UZT)', key: 'date',  width: 15 },
    { header: 'A Sayt',     key: 'a',     width: 12 },
    { header: 'B Sayt',     key: 'b',     width: 12 },
    { header: 'C Sayt',     key: 'c',     width: 12 },
    { header: 'D Sayt',     key: 'd',     width: 12 },
    { header: 'Jami',       key: 'total', width: 12 },
  ];
  styleHeader(wsStats);
  getDailyStats(leads).forEach(row => wsStats.addRow(row));
  autoStyle(wsStats);

  const filePath = path.join(TEMP_DIR, filename);
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

async function createHuzurExcel(leads, filename = 'huzur_leads.xlsx') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leads Bot';
  wb.created = new Date();

  // Sheet 1: Barcha userlar
  const wsAll = wb.addWorksheet('Barcha Userlar');
  wsAll.columns = [
    { header: '№',           key: 'num',          width: 6  },
    { header: "To'liq Ism",  key: 'full_name',     width: 25 },
    { header: 'Telefon',     key: 'phone_number',  width: 18 },
    { header: 'Manzil',      key: 'address',       width: 30 },
    { header: 'Sana (UZT)',  key: 'created_at',    width: 22 },
  ];
  styleHeader(wsAll);
  leads.forEach((l, i) => {
    wsAll.addRow({
      num:          i + 1,
      full_name:    l.full_name    || '',
      phone_number: l.phone_number || '',
      address:      l.address      || '',
      created_at:   formatDate(l.created_at),
    });
  });
  autoStyle(wsAll);

  // Sheet 2: Kunlik statistika
  const wsDaily = wb.addWorksheet('Kunlik Statistika');
  wsDaily.columns = [
    { header: 'Sana (UZT)',           key: 'date',  width: 15 },
    { header: "Ro'yxatdan o'tganlar", key: 'count', width: 22 },
  ];
  styleHeader(wsDaily);

  const dailyMap = {};
  leads.forEach(l => {
    const d = formatDateOnly(l.created_at); // UZT
    dailyMap[d] = (dailyMap[d] || 0) + 1;
  });
  Object.entries(dailyMap)
    .sort((a, b) => sortableDate(a[0]).localeCompare(sortableDate(b[0])))
    .forEach(([date, count]) => wsDaily.addRow({ date, count }));
  autoStyle(wsDaily);

  const filePath = path.join(TEMP_DIR, filename);
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

// ========================
// YORDAMCHI FUNKSIYALAR
// ========================

function styleHeader(ws) {
  const headerRow     = ws.getRow(1);
  headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4057' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height    = 20;
}

function autoStyle(ws) {
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell(cell => {
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });
    if (rowNumber % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      });
    }
  });
}

function getDailyStats(leads) {
  const map = {};
  leads.forEach(l => {
    const d    = formatDateOnly(l.created_at); // UZT sana
    const site = (l.type || 'unknown').toLowerCase();
    if (!map[d]) map[d] = { date: d, a: 0, b: 0, c: 0, d: 0, total: 0 };
    if (SITE_KEYS.includes(site)) map[d][site]++;
    map[d].total++;
  });
  return Object.entries(map)
    .sort((a, b) => sortableDate(a[0]).localeCompare(sortableDate(b[0])))
    .map(([, v]) => v);
}

function deleteFile(filePath) {
  try { fs.unlinkSync(filePath); } catch {}
}

// So'nggi N kunning UZT sanalarini qaytaradi ["28.04.2026", ...]
function lastNDaysUZT(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() + UZT_OFFSET_MS - i * 86400000);
    days.push(`${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`);
  }
  return days;
}

// ========================
// KLAVIATURA MENULARI
// ========================

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📚 Huzur Kursi', '🎯 Webinar'],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  }
};

const webinarMenu = {
  reply_markup: {
    keyboard: [
      ['📋 Barcha Userlar', '📊 Statistika'],
      ['🅰️ A Sayt', '🅱️ B Sayt'],
      ['🅾️ C Sayt', '🔷 D Sayt'],
      ['📥 Excel (Barchasi)', '📥 Excel (Kunlik)'],
      ['🏠 Bosh Menu'],
    ],
    resize_keyboard: true,
  }
};

const huzurMenu = {
  reply_markup: {
    keyboard: [
      ['👥 Barcha Userlar', '📅 Kunlik Statistika'],
      ['📥 Excel Yuklab Olish'],
      ['🏠 Bosh Menu'],
    ],
    resize_keyboard: true,
  }
};

// ========================
// BOT STATE
// ========================
const userState = {};

// ========================
// XABAR HANDLERLARI
// ========================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userState[chatId] = 'main';
  bot.sendMessage(chatId,
    `👋 *Assalomu alaykum!*\n\nBu bot Supabase bazasidagi ma'lumotlarni ko'rish va Excel yuklab olish uchun yaratilgan.\n\n🕐 Barcha vaqtlar *O'zbekiston vaqti (UTC+5)* da ko'rsatiladi.\n\n*Quyidagi bo'limlardan birini tanlang:*`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text   = msg.text;
  if (!text || text.startsWith('/')) return;

  // ===== MAIN =====
  if (text === '🏠 Bosh Menu') {
    userState[chatId] = 'main';
    return bot.sendMessage(chatId, "🏠 *Bosh Menu*\n\nBo'limni tanlang:", { parse_mode: 'Markdown', ...mainMenu });
  }
  if (text === '📚 Huzur Kursi') {
    userState[chatId] = 'huzur';
    return bot.sendMessage(chatId, "📚 *Huzur Kursi Bo'limi*\n\nQuyidagi amallardan birini tanlang:", { parse_mode: 'Markdown', ...huzurMenu });
  }
  if (text === '🎯 Webinar') {
    userState[chatId] = 'webinar';
    return bot.sendMessage(chatId, "🎯 *Webinar Bo'limi*\n\nQuyidagi amallardan birini tanlang:", { parse_mode: 'Markdown', ...webinarMenu });
  }

  // ===== HUZUR =====
  if (userState[chatId] === 'huzur') {
    if (text === '👥 Barcha Userlar')     return handleHuzurAllUsers(chatId);
    if (text === '📅 Kunlik Statistika')  return handleHuzurDailyStats(chatId);
    if (text === '📥 Excel Yuklab Olish') return handleHuzurExcel(chatId);
  }

  // ===== WEBINAR =====
  if (userState[chatId] === 'webinar') {
    if (text === '📋 Barcha Userlar')   return handleWebinarAllUsers(chatId);
    if (text === '📊 Statistika')       return handleWebinarStats(chatId);
    if (text === '🅰️ A Sayt')          return handleWebinarBySite(chatId, 'a');
    if (text === '🅱️ B Sayt')          return handleWebinarBySite(chatId, 'b');
    if (text === '🅾️ C Sayt')          return handleWebinarBySite(chatId, 'c');
    if (text === '🔷 D Sayt')           return handleWebinarBySite(chatId, 'd');
    if (text === '📥 Excel (Barchasi)') return handleWebinarExcel(chatId, 'all');
    if (text === '📥 Excel (Kunlik)')   return handleWebinarExcel(chatId, 'daily');
  }

  bot.sendMessage(chatId, "❓ Noma'lum buyruq. /start bosing yoki menyudan tanlang.", mainMenu);
});

// ========================
// HUZUR HANDLERLARI
// ========================

async function handleHuzurAllUsers(chatId) {
  try {
    const loadMsg = await bot.sendMessage(chatId, "⏳ Ma'lumotlar yuklanmoqda...");
    const leads   = await getHuzurLeads();

    if (leads.length === 0) {
      return bot.editMessageText("📭 Huzur kursida hali user yo'q.", { chat_id: chatId, message_id: loadMsg.message_id });
    }

    const PAGE_SIZE  = 20;
    const totalPages = Math.ceil(leads.length / PAGE_SIZE);

    let msg = `📚 *HUZUR KURSI — BARCHA USERLAR*\n`;
    msg += `📊 Jami: *${leads.length}* ta\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    leads.slice(0, PAGE_SIZE).forEach((l, i) => {
      msg += `*${i + 1}.* ${l.full_name    || "Ism yo'q"}\n`;
      msg += `📞 ${l.phone_number || "Tel yo'q"}\n`;
      msg += `📍 ${l.address      || "Manzil yo'q"}\n`;
      msg += `📅 ${formatDate(l.created_at)}\n\n`;
    });

    if (totalPages > 1) {
      msg += `\n_Sahifa 1/${totalPages} — faqat birinchi ${PAGE_SIZE} ta ko'rsatildi_\n`;
      msg += `_To'liq ro'yxat uchun Excel yuklab oling_ ⬇️`;
    }

    bot.editMessageText(msg, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown' });
  } catch (err) {
    console.error('handleHuzurAllUsers:', err);
    bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

async function handleHuzurDailyStats(chatId) {
  try {
    const loadMsg = await bot.sendMessage(chatId, '⏳ Statistika hisoblanmoqda...');
    const leads   = await getHuzurLeads();

    if (leads.length === 0) {
      return bot.editMessageText("📭 Huzur kursida hali user yo'q.", { chat_id: chatId, message_id: loadMsg.message_id });
    }

    // UZT bo'yicha kunlik hisob
    const dailyMap = {};
    leads.forEach(l => {
      const d = formatDateOnly(l.created_at);
      dailyMap[d] = (dailyMap[d] || 0) + 1;
    });

    const sorted = Object.entries(dailyMap)
      .sort((a, b) => sortableDate(a[0]).localeCompare(sortableDate(b[0])));

    let msg = `📚 *HUZUR KURSI — KUNLIK STATISTIKA*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    sorted.forEach(([date, count]) => {
      msg += `📅 *${date}* — ${count} ta user\n`;
    });
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *Jami: ${leads.length} ta*`;

    bot.editMessageText(msg, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown' });
  } catch (err) {
    console.error('handleHuzurDailyStats:', err);
    bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

async function handleHuzurExcel(chatId) {
  try {
    const loadMsg = await bot.sendMessage(chatId, '⏳ Excel fayl yaratilmoqda...');
    const leads   = await getHuzurLeads();

    if (leads.length === 0) {
      return bot.editMessageText("📭 Huzur kursida hali user yo'q.", { chat_id: chatId, message_id: loadMsg.message_id });
    }

    const filePath = await createHuzurExcel(leads, `huzur_${Date.now()}.xlsx`);
    await bot.deleteMessage(chatId, loadMsg.message_id);
    await bot.sendDocument(chatId, filePath, {
      caption: `📚 *Huzur Kursi*\n📊 Jami: ${leads.length} ta user\n📅 ${nowUZT()} (UZT)`,
      parse_mode: 'Markdown',
    });
    deleteFile(filePath);
  } catch (err) {
    console.error('handleHuzurExcel:', err);
    bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

// ========================
// WEBINAR HANDLERLARI
// ========================

async function handleWebinarAllUsers(chatId) {
  try {
    const loadMsg = await bot.sendMessage(chatId, "⏳ Ma'lumotlar yuklanmoqda...");
    const leads   = await getWebinarLeads();

    if (leads.length === 0) {
      return bot.editMessageText("📭 Webinarda hali user yo'q.", { chat_id: chatId, message_id: loadMsg.message_id });
    }

    const PAGE_SIZE  = 20;
    const totalPages = Math.ceil(leads.length / PAGE_SIZE);
    const siteCounts = {};
    SITE_KEYS.forEach(s => siteCounts[s] = 0);
    leads.forEach(l => {
      const s = (l.type || '').toLowerCase();
      if (SITE_KEYS.includes(s)) siteCounts[s]++;
    });

    let msg = `🎯 *WEBINAR — BARCHA USERLAR*\n`;
    msg += `📊 Jami: *${leads.length}* ta\n`;
    SITE_KEYS.forEach(s => { msg += `${SITE_LABELS[s]}: ${siteCounts[s]} ta\n`; });
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    leads.slice(0, PAGE_SIZE).forEach((l, i) => {
      msg += `*${i + 1}.* ${l.full_name    || "Ism yo'q"}\n`;
      msg += `📞 ${l.phone_number || "Tel yo'q"}\n`;
      msg += `🌐 Sayt: *${(l.type || '-').toUpperCase()}*\n`;
      msg += `📅 ${formatDate(l.created_at)}\n\n`;
    });

    if (totalPages > 1) {
      msg += `_Sahifa 1/${totalPages} — faqat birinchi ${PAGE_SIZE} ta_\n`;
      msg += `_To'liq ro'yxat uchun Excel yuklab oling_ ⬇️`;
    }

    bot.editMessageText(msg, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown' });
  } catch (err) {
    console.error('handleWebinarAllUsers:', err);
    bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

async function handleWebinarStats(chatId) {
  try {
    const loadMsg = await bot.sendMessage(chatId, '⏳ Statistika hisoblanmoqda...');
    const leads   = await getWebinarLeads();

    const siteCounts = {};
    SITE_KEYS.forEach(s => siteCounts[s] = 0);
    leads.forEach(l => {
      const s = (l.type || '').toLowerCase();
      if (SITE_KEYS.includes(s)) siteCounts[s]++;
    });

    let msg = `📊 *WEBINAR — UMUMIY STATISTIKA*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `👥 *Jami userlar: ${leads.length} ta*\n\n`;
    msg += `*Saytlar bo'yicha:*\n`;
    SITE_KEYS.forEach(s => {
      const count   = siteCounts[s];
      const percent = leads.length ? ((count / leads.length) * 100).toFixed(1) : '0.0';
      const bar     = '▓'.repeat(Math.round((count / Math.max(leads.length, 1)) * 10));
      msg += `${SITE_LABELS[s]}: *${count}* ta (${percent}%) ${bar}\n`;
    });

    // So'nggi 7 kun (UZT bo'yicha)
    const last7 = lastNDaysUZT(7);
    msg += `\n*So'nggi 7 kunlik:*\n`;
    last7.forEach(date => {
      const dayLeads = leads.filter(l => formatDateOnly(l.created_at) === date);
      if (dayLeads.length > 0) {
        const bySite = {};
        SITE_KEYS.forEach(s => bySite[s] = 0);
        dayLeads.forEach(l => {
          const s = (l.type || '').toLowerCase();
          if (SITE_KEYS.includes(s)) bySite[s]++;
        });
        const siteStr = SITE_KEYS.map(s => `${s.toUpperCase()}:${bySite[s]}`).join(' ');
        msg += `📅 ${date}: *${dayLeads.length}* ta | ${siteStr}\n`;
      }
    });

    bot.editMessageText(msg, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown' });
  } catch (err) {
    console.error('handleWebinarStats:', err);
    bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

async function handleWebinarBySite(chatId, site) {
  try {
    const loadMsg = await bot.sendMessage(chatId, `⏳ ${SITE_LABELS[site]} ma'lumotlari yuklanmoqda...`);
    const leads   = await getWebinarBySite(site);

    if (leads.length === 0) {
      return bot.editMessageText(`📭 ${SITE_LABELS[site]} da hali user yo'q.`, { chat_id: chatId, message_id: loadMsg.message_id });
    }

    const PAGE_SIZE = 20;
    let msg = `${SITE_LABELS[site]} *— USERLAR RO'YXATI*\n`;
    msg += `📊 Jami: *${leads.length}* ta\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    leads.slice(0, PAGE_SIZE).forEach((l, i) => {
      msg += `*${i + 1}.* ${l.full_name    || "Ism yo'q"}\n`;
      msg += `📞 ${l.phone_number || "Tel yo'q"}\n`;
      msg += `📅 ${formatDate(l.created_at)}\n\n`;
    });

    if (leads.length > PAGE_SIZE) {
      msg += `_Faqat birinchi ${PAGE_SIZE} ta ko'rsatildi. To'liq uchun Excel yuklab oling._ ⬇️`;
    }

    bot.editMessageText(msg, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown' });
  } catch (err) {
    console.error('handleWebinarBySite:', err);
    bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

async function handleWebinarExcel(chatId, type) {
  try {
    const loadMsg = await bot.sendMessage(chatId, '⏳ Excel fayl yaratilmoqda...');
    const leads   = await getWebinarLeads();

    if (leads.length === 0) {
      return bot.editMessageText("📭 Webinarda hali user yo'q.", { chat_id: chatId, message_id: loadMsg.message_id });
    }

    const filePath = await createWebinarExcel(leads, `webinar_${type}_${Date.now()}.xlsx`);

    const siteCounts = {};
    SITE_KEYS.forEach(s => siteCounts[s] = 0);
    leads.forEach(l => {
      const s = (l.type || '').toLowerCase();
      if (SITE_KEYS.includes(s)) siteCounts[s]++;
    });
    const siteStr = SITE_KEYS.map(s => `${SITE_LABELS[s]}: ${siteCounts[s]}`).join('\n');

    await bot.deleteMessage(chatId, loadMsg.message_id);
    await bot.sendDocument(chatId, filePath, {
      caption: `🎯 *Webinar Leads*\n📊 Jami: ${leads.length} ta\n\n${siteStr}\n\n📅 ${nowUZT()} (UZT)`,
      parse_mode: 'Markdown',
    });
    deleteFile(filePath);
  } catch (err) {
    console.error('handleWebinarExcel:', err);
    bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
  }
}

// ========================
// AVTOMATIK 10 DAQIQALIK XABAR
// ========================

async function sendAutoReport() {
  let excelPath = null;
  try {
    const [webinarLeads, huzurLeads] = await Promise.all([
      getWebinarLeads(),
      getHuzurLeads(),
    ]);

    const siteCounts = {};
    SITE_KEYS.forEach(s => siteCounts[s] = 0);
    webinarLeads.forEach(l => {
      const s = (l.type || '').toLowerCase();
      if (SITE_KEYS.includes(s)) siteCounts[s]++;
    });

    const nowStr   = nowUZT();
    const todayStr = todayUZT();

    const todayWebinar = webinarLeads.filter(l => formatDateOnly(l.created_at) === todayStr);
    const todayHuzur   = huzurLeads.filter(l   => formatDateOnly(l.created_at) === todayStr);

    // 1) Matnli hisobot xabari
    let msg = `🤖 *AVTOMATIK HISOBOT*\n`;
    msg += `🕐 ${nowStr} (UZT)\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    msg += `🎯 *WEBINAR*\n`;
    msg += `👥 Jami: *${webinarLeads.length}* ta\n`;
    SITE_KEYS.forEach(s => { msg += `${SITE_LABELS[s]}: ${siteCounts[s]} ta\n`; });
    msg += `📅 Bugun (${todayStr}): *${todayWebinar.length}* ta\n\n`;

    msg += `📚 *HUZUR KURSI*\n`;
    msg += `👥 Jami: *${huzurLeads.length}* ta\n`;
    msg += `📅 Bugun (${todayStr}): *${todayHuzur.length}* ta\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📎 _Quyida webinar to'liq bazasi (Excel)_`;

    await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

    // 2) Webinar barcha userlar — Excel fayl
    if (webinarLeads.length > 0) {
      const siteStr   = SITE_KEYS.map(s => `${SITE_LABELS[s]}: ${siteCounts[s]}`).join(' | ');
      excelPath = await createWebinarExcel(webinarLeads, `auto_webinar_${Date.now()}.xlsx`);
      await bot.sendDocument(CHANNEL_ID, excelPath, {
        caption: `📊 *WEBINAR — TO'LIQ BAZA*\n👥 Jami: ${webinarLeads.length} ta\n${siteStr}\n📅 ${nowStr} (UZT)`,
        parse_mode: 'Markdown',
      });
      deleteFile(excelPath);
      excelPath = null;
    }

    console.log(`✅ Avtomatik hisobot + Excel yuborildi: ${nowStr}`);
  } catch (err) {
    if (excelPath) deleteFile(excelPath);
    console.error('❌ Avtomatik hisobot xatosi:', err.message);
  }
}

// Har 10 daqiqada
cron.schedule('*/10 * * * *', () => {
  console.log('⏰ Avtomatik hisobot yuborilmoqda...');
  sendAutoReport();
});

// ========================
// XATO USHLASH
// ========================
bot.on('polling_error', (error) => {
  console.error('Polling xato:', error.code, error.message);
});
bot.on('error', (error) => {
  console.error('Bot xato:', error.message);
});

// ========================
// START
// ========================
console.log('🚀 Bot ishga tushdi!');
console.log('📊 Supabase:', SUPABASE_URL);
console.log("🕐 Vaqt zonasi: UTC+5 (O'zbekiston)");
console.log('🔄 Har 10 daqiqada avtomatik hisobot');
console.log('💡 Kanal ID:', CHANNEL_ID);
sendAutoReport();