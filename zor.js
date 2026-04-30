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
const BOT_TOKEN    = '8679225810:AAG-wo6seWBQTAxBkfb0rD1c0L0Kdul49fE';
const CHANNEL_ID   = '-1003920803109';
const SUPABASE_URL = 'https://vxpvgeyktgyasegvycfp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_pXpHGuZFzmhJUD6FkQeapQ__7D78i4w';

// O'zbekiston UTC+5
const UZT_OFFSET_MS = 5 * 60 * 60 * 1000;

// ========================
// INIT
// ========================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

const SITE_LABELS = { a: '🅰️ A Sayt', b: '🅱️ B Sayt', c: '🅾️ C Sayt', d: '🔷 D Sayt' };
const SITE_KEYS   = ['a', 'b', 'c', 'd'];

// Temp papka
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// ========================
// VAQT FUNKSIYALARI
// ========================

function parseSupabaseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  let str = String(val).trim();
  str = str.replace(' ', 'T');
  str = str.replace(/([+-]\d{2})$/, '$1:00');
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  const d2 = new Date(val);
  return isNaN(d2.getTime()) ? null : d2;
}

function pad(n) { return String(n).padStart(2, '0'); }

function toUZT(val) {
  const date = parseSupabaseDate(val);
  if (!date) return { year: 0, month: 0, day: 0, hours: 0, minutes: 0 };
  const uzt = new Date(date.getTime() + UZT_OFFSET_MS);
  return {
    year:    uzt.getUTCFullYear(),
    month:   uzt.getUTCMonth() + 1,
    day:     uzt.getUTCDate(),
    hours:   uzt.getUTCHours(),
    minutes: uzt.getUTCMinutes(),
  };
}

function formatDate(val) {
  if (!val) return '—';
  const t = toUZT(val);
  if (!t.year) return '—';
  return `${pad(t.day)}.${pad(t.month)}.${t.year} ${pad(t.hours)}:${pad(t.minutes)}`;
}

function formatDateOnly(val) {
  if (!val) return '';
  const t = toUZT(val);
  if (!t.year) return '';
  return `${pad(t.day)}.${pad(t.month)}.${t.year}`;
}

function nowUZT()   { return formatDate(new Date()); }
function todayUZT() { return formatDateOnly(new Date()); }

function sortableDate(ddmmyyyy) {
  if (!ddmmyyyy) return '';
  return ddmmyyyy.split('.').reverse().join('.');
}

function lastNDaysUZT(n) {
  const days  = [];
  const nowMs = Date.now() + UZT_OFFSET_MS;
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * 86400000);
    days.push(`${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`);
  }
  return days;
}

// ========================
// SUPABASE — BARCHA QATORLARNI OLISH (pagination)
// ========================

async function fetchAllRows(tableName, filters = [], orderColumn = 'created_at', ascending = false) {
  const PAGE_SIZE = 1000;
  let allData     = [];
  let from        = 0;

  while (true) {
    let query = supabase
      .from(tableName)
      .select('*')
      .order(orderColumn, { ascending })
      .range(from, from + PAGE_SIZE - 1);

    for (const f of filters) {
      query = query.eq(f.column, f.value);
    }

    const { data, error } = await query;

    if (error) throw new Error(`${tableName} fetchAllRows xatosi: ${error.message}`);
    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    console.log(`📥 ${tableName}: ${allData.length} ta olindi (sahifa: ${from}–${from + data.length - 1})`);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

async function getWebinarLeads() {
  return fetchAllRows('leads', [], 'created_at', false);
}

async function getHuzurLeads() {
  return fetchAllRows('huzur', [], 'created_at', false);
}

async function getVslLeads() {
  return fetchAllRows('vsl', [], 'created_at', false);
}

async function getWebinarBySite(site) {
  return fetchAllRows('leads', [{ column: 'type', value: site }], 'created_at', false);
}

// ========================
// REAL-TIME SUBSCRIPTIONS
// ========================

// Webinar real-time
supabase
  .channel('leads-realtime')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'leads' },
    async (payload) => {
      try {
        const l    = payload.new;
        const site = (l.type || '').toUpperCase();
        const time = formatDate(l.created_at);

        const msg =
          `🔔 *YANGI WEBINAR LEAD!*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 Ism: *${l.full_name    || "Ism yo'q"}*\n` +
          `📞 Tel: \`${l.phone_number || "Tel yo'q"}\`\n` +
          `🌐 Sayt: *${site || '—'}*\n` +
          `📅 Vaqt: ${time} (UZT)`;

        await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
        console.log(`✅ Yangi webinar lead: ${l.full_name} [${site}] — ${time}`);
      } catch (err) {
        console.error('❌ Webinar real-time xabari xatosi:', err.message);
      }
    }
  )
  .subscribe((status) => {
    console.log('📡 Webinar real-time status:', status);
  });

// Huzur real-time
supabase
  .channel('huzur-realtime')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'huzur' },
    async (payload) => {
      try {
        const l    = payload.new;
        const time = formatDate(l.created_at);

        const msg =
          `🔔 *YANGI HUZUR KURSI LEAD!*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 Ism: *${l.full_name    || "Ism yo'q"}*\n` +
          `📞 Tel: \`${l.phone_number || "Tel yo'q"}\`\n` +
          `📍 Manzil: ${l.address    || "Manzil yo'q"}\n` +
          `📅 Vaqt: ${time} (UZT)`;

        await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
        console.log(`✅ Yangi huzur lead: ${l.full_name} — ${time}`);
      } catch (err) {
        console.error('❌ Huzur real-time xabari xatosi:', err.message);
      }
    }
  )
  .subscribe((status) => {
    console.log('📡 Huzur real-time status:', status);
  });

// VSL real-time
supabase
  .channel('vsl-realtime')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'vsl' },
    async (payload) => {
      try {
        const l    = payload.new;
        const time = formatDate(l.created_at);

        const msg =
          `🔔 *YANGI VSL LEAD!*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 Ism: *${l.full_name    || "Ism yo'q"}*\n` +
          `📞 Tel: \`${l.phone_number || "Tel yo'q"}\`\n` +
          `📅 Vaqt: ${time} (UZT)`;

        await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
        console.log(`✅ Yangi VSL lead: ${l.full_name} — ${time}`);
      } catch (err) {
        console.error('❌ VSL real-time xabari xatosi:', err.message);
      }
    }
  )
  .subscribe((status) => {
    console.log('📡 VSL real-time status:', status);
  });

// ========================
// EXCEL YARATUVCHI FUNKSIYALAR
// ========================

async function createWebinarExcel(leads, filename = 'webinar_leads.xlsx') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leads Bot';
  wb.created = new Date();

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

  const wsDaily = wb.addWorksheet('Kunlik Statistika');
  wsDaily.columns = [
    { header: 'Sana (UZT)',           key: 'date',  width: 15 },
    { header: "Ro'yxatdan o'tganlar", key: 'count', width: 22 },
  ];
  styleHeader(wsDaily);

  const dailyMap = {};
  leads.forEach(l => {
    const d = formatDateOnly(l.created_at);
    if (!d) return;
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

async function createVslExcel(leads, filename = 'vsl_leads.xlsx') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leads Bot';
  wb.created = new Date();

  const wsAll = wb.addWorksheet('Barcha Userlar');
  wsAll.columns = [
    { header: '№',           key: 'num',          width: 6  },
    { header: "To'liq Ism",  key: 'full_name',     width: 25 },
    { header: 'Telefon',     key: 'phone_number',  width: 18 },
    { header: 'Sana (UZT)',  key: 'created_at',    width: 22 },
  ];
  styleHeader(wsAll);
  leads.forEach((l, i) => {
    wsAll.addRow({
      num:          i + 1,
      full_name:    l.full_name    || '',
      phone_number: l.phone_number || '',
      created_at:   formatDate(l.created_at),
    });
  });
  autoStyle(wsAll);

  const wsDaily = wb.addWorksheet('Kunlik Statistika');
  wsDaily.columns = [
    { header: 'Sana (UZT)',           key: 'date',  width: 15 },
    { header: "Ro'yxatdan o'tganlar", key: 'count', width: 22 },
  ];
  styleHeader(wsDaily);

  const dailyMap = {};
  leads.forEach(l => {
    const d = formatDateOnly(l.created_at);
    if (!d) return;
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
    const d    = formatDateOnly(l.created_at);
    if (!d) return;
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

// ========================
// KLAVIATURA MENULARI
// ========================

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📚 Huzur Kursi', '🎯 Webinar'],
      ['💻 VSL'],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
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
  },
};

const huzurMenu = {
  reply_markup: {
    keyboard: [
      ['👥 Barcha Userlar', '📅 Kunlik Statistika'],
      ['📥 Excel Yuklab Olish'],
      ['🏠 Bosh Menu'],
    ],
    resize_keyboard: true,
  },
};

const vslMenu = {
  reply_markup: {
    keyboard: [
      ['👥 VSL Userlar', '📅 VSL Statistika'],
      ['📥 VSL Excel'],
      ['🏠 Bosh Menu'],
    ],
    resize_keyboard: true,
  },
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
  bot.sendMessage(
    chatId,
    `👋 *Assalomu alaykum!*\n\nBu bot Supabase bazasidagi ma'lumotlarni ko'rish va Excel yuklab olish uchun yaratilgan.\n\n🕐 Barcha vaqtlar *O'zbekiston vaqti (UTC+5)* da ko'rsatiladi.\n📡 *Real-time* yangilanishlar yoqilgan!\n\n*Bo'limni tanlang:*`,
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
  if (text === '💻 VSL') {
    userState[chatId] = 'vsl';
    return bot.sendMessage(chatId, "💻 *VSL Bo'limi*\n\nQuyidagi amallardan birini tanlang:", { parse_mode: 'Markdown', ...vslMenu });
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

  // ===== VSL =====
  if (userState[chatId] === 'vsl') {
    if (text === '👥 VSL Userlar')     return handleVslAllUsers(chatId);
    if (text === '📅 VSL Statistika')  return handleVslDailyStats(chatId);
    if (text === '📥 VSL Excel')       return handleVslExcel(chatId);
  }

  bot.sendMessage(chatId, "❓ Noma'lum buyruq. /start bosing yoki menyudan tanlang.", mainMenu);
});

// ========================
// HUZUR HANDLERLARI
// ========================

async function handleHuzurAllUsers(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(
      chatId,
      "⏳ *Barcha ma'lumotlar yuklanmoqda...*\n_(Jami userlar ko'p bo'lsa biroz vaqt ketishi mumkin)_",
      { parse_mode: 'Markdown' }
    );
    const leads = await getHuzurLeads();
    if (leads.length === 0) {
      return bot.editMessageText("📭 Huzur kursida hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    const PAGE_SIZE  = 20;
    const totalPages = Math.ceil(leads.length / PAGE_SIZE);
    const todayStr   = todayUZT();
    const todayCount = leads.filter(l => formatDateOnly(l.created_at) === todayStr).length;

    let msg = `📚 *HUZUR KURSI — BARCHA USERLAR*\n`;
    msg += `📊 Jami: *${leads.length}* ta\n`;
    msg += `📅 Bugun (${todayStr}): *${todayCount}* ta\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    leads.slice(0, PAGE_SIZE).forEach((l, i) => {
      msg += `*${i + 1}.* ${l.full_name    || "Ism yo'q"}\n`;
      msg += `📞 ${l.phone_number || "Tel yo'q"}\n`;
      msg += `📍 ${l.address      || "Manzil yo'q"}\n`;
      msg += `📅 ${formatDate(l.created_at)}\n\n`;
    });

    if (totalPages > 1) {
      msg += `_Sahifa 1/${totalPages} — faqat birinchi ${PAGE_SIZE} ta ko'rsatildi_\n`;
      msg += `_To'liq ro'yxat uchun 📥 Excel yuklab oling_ ⬇️`;
    }

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleHuzurAllUsers:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    loadMsg
      ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
      : bot.sendMessage(chatId, errMsg);
  }
}

async function handleHuzurDailyStats(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(chatId, '⏳ Statistika hisoblanmoqda...');
    const leads = await getHuzurLeads();

    if (leads.length === 0) {
      return bot.editMessageText("📭 Huzur kursida hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    const dailyMap = {};
    leads.forEach(l => {
      const d = formatDateOnly(l.created_at);
      if (!d) return;
      dailyMap[d] = (dailyMap[d] || 0) + 1;
    });

    const sorted = Object.entries(dailyMap)
      .sort((a, b) => sortableDate(a[0]).localeCompare(sortableDate(b[0])));

    const maxCount = Math.max(...Object.values(dailyMap), 1);

    let msg = `📚 *HUZUR KURSI — KUNLIK STATISTIKA*\n`;
    msg += `📊 Jami: *${leads.length}* ta\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    sorted.forEach(([date, count]) => {
      const bar = '▓'.repeat(Math.round((count / maxCount) * 10));
      msg += `📅 *${date}* — ${count} ta ${bar}\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *Jami: ${leads.length} ta*`;

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleHuzurDailyStats:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    loadMsg
      ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
      : bot.sendMessage(chatId, errMsg);
  }
}

async function handleHuzurExcel(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(
      chatId,
      "⏳ *Excel fayl yaratilmoqda...*\n_(Barcha ma'lumotlar yuklanmoqda)_",
      { parse_mode: 'Markdown' }
    );
    const leads = await getHuzurLeads();
    if (leads.length === 0) {
      return bot.editMessageText("📭 Huzur kursida hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    const filePath   = await createHuzurExcel(leads, `huzur_${Date.now()}.xlsx`);
    const todayStr   = todayUZT();
    const todayCount = leads.filter(l => formatDateOnly(l.created_at) === todayStr).length;

    await bot.deleteMessage(chatId, loadMsg.message_id);
    await bot.sendDocument(chatId, filePath, {
      caption:
        `📚 *Huzur Kursi — To'liq Baza*\n` +
        `📊 Jami: *${leads.length}* ta user\n` +
        `📅 Bugun (${todayStr}): *${todayCount}* ta\n` +
        `🕐 ${nowUZT()} (UZT)`,
      parse_mode: 'Markdown',
    });
    deleteFile(filePath);
  } catch (err) {
    console.error('handleHuzurExcel:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    try {
      loadMsg
        ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
        : bot.sendMessage(chatId, errMsg);
    } catch (_) {
      bot.sendMessage(chatId, errMsg);
    }
  }
}

// ========================
// WEBINAR HANDLERLARI
// ========================

async function handleWebinarAllUsers(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(chatId, "⏳ Barcha ma'lumotlar yuklanmoqda...");
    const leads = await getWebinarLeads();
    if (leads.length === 0) {
      return bot.editMessageText("📭 Webinarda hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    const PAGE_SIZE  = 20;
    const totalPages = Math.ceil(leads.length / PAGE_SIZE);
    const siteCounts = {};
    SITE_KEYS.forEach(s => (siteCounts[s] = 0));
    leads.forEach(l => {
      const s = (l.type || '').toLowerCase();
      if (SITE_KEYS.includes(s)) siteCounts[s]++;
    });

    const todayStr   = todayUZT();
    const todayCount = leads.filter(l => formatDateOnly(l.created_at) === todayStr).length;

    let msg = `🎯 *WEBINAR — BARCHA USERLAR*\n`;
    msg += `📊 Jami: *${leads.length}* ta\n`;
    msg += `📅 Bugun (${todayStr}): *${todayCount}* ta\n`;
    SITE_KEYS.forEach(s => { msg += `${SITE_LABELS[s]}: ${siteCounts[s]} ta\n`; });
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    leads.slice(0, PAGE_SIZE).forEach((l, i) => {
      msg += `*${i + 1}.* ${l.full_name    || "Ism yo'q"}\n`;
      msg += `📞 ${l.phone_number || "Tel yo'q"}\n`;
      msg += `🌐 Sayt: *${(l.type || '—').toUpperCase()}*\n`;
      msg += `📅 ${formatDate(l.created_at)}\n\n`;
    });

    if (totalPages > 1) {
      msg += `_Sahifa 1/${totalPages} — faqat birinchi ${PAGE_SIZE} ta_\n`;
      msg += `_To'liq ro'yxat uchun 📥 Excel yuklab oling_ ⬇️`;
    }

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleWebinarAllUsers:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    loadMsg
      ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
      : bot.sendMessage(chatId, errMsg);
  }
}

async function handleWebinarStats(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(chatId, '⏳ Statistika hisoblanmoqda...');
    const leads = await getWebinarLeads();
    const siteCounts = {};
    SITE_KEYS.forEach(s => (siteCounts[s] = 0));
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

    const last7 = lastNDaysUZT(7);
    msg += `\n*So'nggi 7 kunlik:*\n`;
    last7.forEach(date => {
      const dayLeads = leads.filter(l => formatDateOnly(l.created_at) === date);
      if (dayLeads.length > 0) {
        const bySite = {};
        SITE_KEYS.forEach(s => (bySite[s] = 0));
        dayLeads.forEach(l => {
          const s = (l.type || '').toLowerCase();
          if (SITE_KEYS.includes(s)) bySite[s]++;
        });
        const siteStr = SITE_KEYS.map(s => `${s.toUpperCase()}:${bySite[s]}`).join(' ');
        msg += `📅 ${date}: *${dayLeads.length}* ta | ${siteStr}\n`;
      }
    });

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleWebinarStats:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    loadMsg
      ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
      : bot.sendMessage(chatId, errMsg);
  }
}

async function handleWebinarBySite(chatId, site) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(chatId, `⏳ ${SITE_LABELS[site]} ma'lumotlari yuklanmoqda...`);
    const leads = await getWebinarBySite(site);
    if (leads.length === 0) {
      return bot.editMessageText(`📭 ${SITE_LABELS[site]} da hali user yo'q.`, {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
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

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleWebinarBySite:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    loadMsg
      ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
      : bot.sendMessage(chatId, errMsg);
  }
}

async function handleWebinarExcel(chatId, type) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(chatId, '⏳ Excel fayl yaratilmoqda...');
    const leads = await getWebinarLeads();
    if (leads.length === 0) {
      return bot.editMessageText("📭 Webinarda hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    const filePath   = await createWebinarExcel(leads, `webinar_${type}_${Date.now()}.xlsx`);
    const siteCounts = {};
    SITE_KEYS.forEach(s => (siteCounts[s] = 0));
    leads.forEach(l => {
      const s = (l.type || '').toLowerCase();
      if (SITE_KEYS.includes(s)) siteCounts[s]++;
    });
    const siteStr = SITE_KEYS.map(s => `${SITE_LABELS[s]}: ${siteCounts[s]}`).join('\n');

    await bot.deleteMessage(chatId, loadMsg.message_id);
    await bot.sendDocument(chatId, filePath, {
      caption:
        `🎯 *Webinar Leads — To'liq Baza*\n` +
        `📊 Jami: *${leads.length}* ta\n\n` +
        `${siteStr}\n\n` +
        `📅 ${nowUZT()} (UZT)`,
      parse_mode: 'Markdown',
    });
    deleteFile(filePath);
  } catch (err) {
    console.error('handleWebinarExcel:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    try {
      loadMsg
        ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
        : bot.sendMessage(chatId, errMsg);
    } catch (_) {
      bot.sendMessage(chatId, errMsg);
    }
  }
}

// ========================
// VSL HANDLERLARI
// ========================

async function handleVslAllUsers(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(
      chatId,
      "⏳ *VSL ma'lumotlari yuklanmoqda...*",
      { parse_mode: 'Markdown' }
    );
    const leads = await getVslLeads();
    if (leads.length === 0) {
      return bot.editMessageText("📭 VSL bo'limida hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    const PAGE_SIZE  = 20;
    const totalPages = Math.ceil(leads.length / PAGE_SIZE);
    const todayStr   = todayUZT();
    const todayCount = leads.filter(l => formatDateOnly(l.created_at) === todayStr).length;

    let msg = `💻 *VSL — BARCHA USERLAR*\n`;
    msg += `📊 Jami: *${leads.length}* ta\n`;
    msg += `📅 Bugun (${todayStr}): *${todayCount}* ta\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    leads.slice(0, PAGE_SIZE).forEach((l, i) => {
      msg += `*${i + 1}.* ${l.full_name    || "Ism yo'q"}\n`;
      msg += `📞 ${l.phone_number || "Tel yo'q"}\n`;
      msg += `📅 ${formatDate(l.created_at)}\n\n`;
    });

    if (totalPages > 1) {
      msg += `_Sahifa 1/${totalPages} — faqat birinchi ${PAGE_SIZE} ta ko'rsatildi_\n`;
      msg += `_To'liq ro'yxat uchun 📥 Excel yuklab oling_ ⬇️`;
    }

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleVslAllUsers:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    loadMsg
      ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
      : bot.sendMessage(chatId, errMsg);
  }
}

async function handleVslDailyStats(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(chatId, '⏳ VSL statistika hisoblanmoqda...');
    const leads = await getVslLeads();
    if (leads.length === 0) {
      return bot.editMessageText("📭 VSL bo'limida hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    const dailyMap = {};
    leads.forEach(l => {
      const d = formatDateOnly(l.created_at);
      if (!d) return;
      dailyMap[d] = (dailyMap[d] || 0) + 1;
    });

    const sorted = Object.entries(dailyMap)
      .sort((a, b) => sortableDate(a[0]).localeCompare(sortableDate(b[0])));
    const maxCount = Math.max(...Object.values(dailyMap), 1);

    let msg = `💻 *VSL — KUNLIK STATISTIKA*\n`;
    msg += `📊 Jami: *${leads.length}* ta\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    sorted.forEach(([date, count]) => {
      const bar = '▓'.repeat(Math.round((count / maxCount) * 10));
      msg += `📅 *${date}* — ${count} ta ${bar}\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *Jami: ${leads.length} ta*`;

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleVslDailyStats:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    loadMsg
      ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
      : bot.sendMessage(chatId, errMsg);
  }
}

async function handleVslExcel(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(
      chatId,
      "⏳ *VSL Excel fayl yaratilmoqda...*",
      { parse_mode: 'Markdown' }
    );
    const leads = await getVslLeads();
    if (leads.length === 0) {
      return bot.editMessageText("📭 VSL bo'limida hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    const filePath   = await createVslExcel(leads, `vsl_${Date.now()}.xlsx`);
    const todayStr   = todayUZT();
    const todayCount = leads.filter(l => formatDateOnly(l.created_at) === todayStr).length;

    await bot.deleteMessage(chatId, loadMsg.message_id);
    await bot.sendDocument(chatId, filePath, {
      caption:
        `💻 *VSL — To'liq Baza*\n` +
        `📊 Jami: *${leads.length}* ta user\n` +
        `📅 Bugun (${todayStr}): *${todayCount}* ta\n` +
        `🕐 ${nowUZT()} (UZT)`,
      parse_mode: 'Markdown',
    });
    deleteFile(filePath);
  } catch (err) {
    console.error('handleVslExcel:', err);
    const errMsg = `❌ Xato: ${err.message}`;
    try {
      loadMsg
        ? bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id })
        : bot.sendMessage(chatId, errMsg);
    } catch (_) {
      bot.sendMessage(chatId, errMsg);
    }
  }
}

// ========================
// AVTOMATIK 10 DAQIQALIK HISOBOT
// ========================

async function sendAutoReport() {
  let excelPath = null;
  try {
    const [webinarLeads, huzurLeads, vslLeads] = await Promise.all([
      getWebinarLeads(),
      getHuzurLeads(),
      getVslLeads(),
    ]);

    const siteCounts = {};
    SITE_KEYS.forEach(s => (siteCounts[s] = 0));
    webinarLeads.forEach(l => {
      const s = (l.type || '').toLowerCase();
      if (SITE_KEYS.includes(s)) siteCounts[s]++;
    });

    const nowStr   = nowUZT();
    const todayStr = todayUZT();

    const todayWebinar = webinarLeads.filter(l => formatDateOnly(l.created_at) === todayStr);
    const todayHuzur   = huzurLeads.filter(l   => formatDateOnly(l.created_at) === todayStr);
    const todayVsl     = vslLeads.filter(l     => formatDateOnly(l.created_at) === todayStr);

    let msg = `🤖 *AVTOMATIK HISOBOT*\n`;
    msg += `🕐 ${nowStr} (UZT)\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    msg += `🎯 *WEBINAR*\n`;
    msg += `👥 Jami: *${webinarLeads.length}* ta\n`;
    SITE_KEYS.forEach(s => { msg += `${SITE_LABELS[s]}: ${siteCounts[s]} ta\n`; });
    msg += `📅 Bugun (${todayStr}): *${todayWebinar.length}* ta\n\n`;

    msg += `📚 *HUZUR KURSI*\n`;
    msg += `👥 Jami: *${huzurLeads.length}* ta\n`;
    msg += `📅 Bugun (${todayStr}): *${todayHuzur.length}* ta\n\n`;

    msg += `💻 *VSL*\n`;
    msg += `👥 Jami: *${vslLeads.length}* ta\n`;
    msg += `📅 Bugun (${todayStr}): *${todayVsl.length}* ta\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📎 _Webinar to'liq bazasi (Excel) biriktirildi_`;

    await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

    if (webinarLeads.length > 0) {
      const siteStr = SITE_KEYS.map(s => `${SITE_LABELS[s]}: ${siteCounts[s]}`).join(' | ');
      excelPath = await createWebinarExcel(webinarLeads, `auto_webinar_${Date.now()}.xlsx`);
      await bot.sendDocument(CHANNEL_ID, excelPath, {
        caption:
          `📊 *WEBINAR — TO'LIQ BAZA*\n` +
          `👥 Jami: ${webinarLeads.length} ta\n` +
          `${siteStr}\n` +
          `📅 ${nowStr} (UZT)`,
        parse_mode: 'Markdown',
      });
      deleteFile(excelPath);
      excelPath = null;
    }

    console.log(`✅ Avtomatik hisobot yuborildi: ${nowStr}`);
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
console.log('📡 Real-time: leads, huzur, vsl jadvallar kuzatilmoqda');

sendAutoReport();