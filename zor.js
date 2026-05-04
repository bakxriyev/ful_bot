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

// Timeoutlar (ms)
const DB_TIMEOUT      = 60_000;  // 60 sekund
const EXCEL_TIMEOUT   = 120_000; // 2 daqiqa
const SEND_TIMEOUT    = 90_000;  // 1.5 daqiqa

// ========================
// INIT
// ========================
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 },
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

const SITE_LABELS = { a: '🅰️ A Sayt', b: '🅱️ B Sayt', c: '🅾️ C Sayt', d: '🔷 D Sayt' };
const SITE_KEYS   = ['a', 'b', 'c', 'd'];

// Temp papka
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ========================
// YORDAMCHI: TIMEOUT WRAPPER
// ========================
function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`⏱ ${label} timeout (${ms / 1000}s)`)), ms)
    ),
  ]);
}

// ========================
// YORDAMCHI: XAVFSIZ TELEGRAM YUBORISH
// ========================
async function safeSend(fn, fallbackChatId = null, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await withTimeout(fn(), SEND_TIMEOUT, 'Telegram send');
    } catch (err) {
      if (i === retries) {
        console.error(`❌ safeSend xato (${retries} urinishdan keyin):`, err.message);
        if (fallbackChatId) {
          try {
            await bot.sendMessage(fallbackChatId, `❌ Xato yuz berdi: ${err.message}`);
          } catch (_) {}
        }
      } else {
        await sleep(1500 * (i + 1));
      }
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================
// VAQT FUNKSIYALARI
// ========================
function parseSupabaseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  let str = String(val).trim().replace(' ', 'T');
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
// SUPABASE — BARCHA QATORLARNI OLISH (pagination + timeout)
// ========================
async function fetchAllRows(tableName, filters = [], orderColumn = 'created_at', ascending = false) {
  const PAGE_SIZE = 1000;
  let allData     = [];
  let from        = 0;

  while (true) {
    const fetchPage = async () => {
      let query = supabase
        .from(tableName)
        .select('*')
        .order(orderColumn, { ascending })
        .range(from, from + PAGE_SIZE - 1);

      for (const f of filters) {
        query = query.eq(f.column, f.value);
      }

      const { data, error } = await query;
      if (error) throw new Error(`${tableName} xatosi: ${error.message}`);
      return data;
    };

    const data = await withTimeout(fetchPage(), DB_TIMEOUT, `${tableName} DB query`);

    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    console.log(`📥 ${tableName}: ${allData.length} ta olindi`);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

async function getWebinarLeads() { return fetchAllRows('leads', [], 'created_at', false); }
async function getHuzurLeads()   { return fetchAllRows('huzur', [], 'created_at', false); }
async function getVslLeads()     { return fetchAllRows('vsl',   [], 'created_at', false); }
async function getWebinarBySite(site) {
  return fetchAllRows('leads', [{ column: 'type', value: site }], 'created_at', false);
}

// ========================
// REAL-TIME SUBSCRIPTIONS
// ========================
supabase
  .channel('leads-realtime')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, async (payload) => {
    try {
      const l    = payload.new;
      const site = (l.type || '').toUpperCase();
      const time = formatDate(l.created_at);
      const msg  =
        `🔔 *YANGI WEBINAR LEAD!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Ism: *${l.full_name    || "Ism yo'q"}*\n` +
        `📞 Tel: \`${l.phone_number || "Tel yo'q"}\`\n` +
        `🌐 Sayt: *${site || '—'}*\n` +
        `📅 Vaqt: ${time} (UZT)`;
      await safeSend(() => bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' }));
    } catch (err) {
      console.error('❌ Webinar real-time:', err.message);
    }
  })
  .subscribe(status => console.log('📡 Webinar real-time:', status));

supabase
  .channel('huzur-realtime')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'huzur' }, async (payload) => {
    try {
      const l    = payload.new;
      const time = formatDate(l.created_at);
      const msg  =
        `🔔 *YANGI HUZUR KURSI LEAD!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Ism: *${l.full_name    || "Ism yo'q"}*\n` +
        `📞 Tel: \`${l.phone_number || "Tel yo'q"}\`\n` +
        `📍 Manzil: ${l.address    || "Manzil yo'q"}\n` +
        `📅 Vaqt: ${time} (UZT)`;
      await safeSend(() => bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' }));
    } catch (err) {
      console.error('❌ Huzur real-time:', err.message);
    }
  })
  .subscribe(status => console.log('📡 Huzur real-time:', status));

supabase
  .channel('vsl-realtime')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vsl' }, async (payload) => {
    try {
      const l    = payload.new;
      const time = formatDate(l.created_at);
      const msg  =
        `🔔 *YANGI VSL LEAD!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Ism: *${l.full_name    || "Ism yo'q"}*\n` +
        `📞 Tel: \`${l.phone_number || "Tel yo'q"}\`\n` +
        `📅 Vaqt: ${time} (UZT)`;
      await safeSend(() => bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' }));
    } catch (err) {
      console.error('❌ VSL real-time:', err.message);
    }
  })
  .subscribe(status => console.log('📡 VSL real-time:', status));

// ========================
// EXCEL YARATUVCHI FUNKSIYALAR
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

async function createWebinarExcel(leads, filename = 'webinar_leads.xlsx') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leads Bot';
  wb.created = new Date();

  const wsAll = wb.addWorksheet('Barcha Userlar');
  wsAll.columns = [
    { header: '№',          key: 'num',          width: 6  },
    { header: "To'liq Ism", key: 'full_name',     width: 25 },
    { header: 'Telefon',    key: 'phone_number',  width: 18 },
    { header: 'Sayt',       key: 'type',          width: 12 },
    { header: 'Sana (UZT)', key: 'created_at',    width: 22 },
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
      { header: '№',          key: 'num',         width: 6  },
      { header: "To'liq Ism", key: 'full_name',    width: 25 },
      { header: 'Telefon',    key: 'phone_number', width: 18 },
      { header: 'Sana (UZT)', key: 'created_at',   width: 22 },
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
  await withTimeout(wb.xlsx.writeFile(filePath), EXCEL_TIMEOUT, 'Excel write');
  return filePath;
}

async function createHuzurExcel(leads, filename = 'huzur_leads.xlsx') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leads Bot';
  wb.created = new Date();

  const wsAll = wb.addWorksheet('Barcha Userlar');
  wsAll.columns = [
    { header: '№',          key: 'num',          width: 6  },
    { header: "To'liq Ism", key: 'full_name',     width: 25 },
    { header: 'Telefon',    key: 'phone_number',  width: 18 },
    { header: 'Manzil',     key: 'address',       width: 30 },
    { header: 'Sana (UZT)', key: 'created_at',    width: 22 },
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
  await withTimeout(wb.xlsx.writeFile(filePath), EXCEL_TIMEOUT, 'Excel write');
  return filePath;
}

async function createVslExcel(leads, filename = 'vsl_leads.xlsx') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leads Bot';
  wb.created = new Date();

  const wsAll = wb.addWorksheet('Barcha Userlar');
  wsAll.columns = [
    { header: '№',          key: 'num',          width: 6  },
    { header: "To'liq Ism", key: 'full_name',     width: 25 },
    { header: 'Telefon',    key: 'phone_number',  width: 18 },
    { header: 'Sana (UZT)', key: 'created_at',    width: 22 },
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
  await withTimeout(wb.xlsx.writeFile(filePath), EXCEL_TIMEOUT, 'Excel write');
  return filePath;
}

// ========================
// EXCEL FAYLNI XAVFSIZ YUBORISH (buffer orqali)
// ========================
async function sendExcelDocument(chatId, filePath, caption) {
  // Faylni buffer sifatida o'qiymiz — stream muammolaridan xoli
  const fileBuffer = await withTimeout(
    fs.promises.readFile(filePath),
    30_000,
    'File read'
  );

  await withTimeout(
    bot.sendDocument(chatId, fileBuffer, { caption, parse_mode: 'Markdown' }, {
      filename:    path.basename(filePath),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    SEND_TIMEOUT,
    'sendDocument'
  );
}

function deleteFile(filePath) {
  try { fs.unlinkSync(filePath); } catch (_) {}
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
// XABAR HANDLERLARI — fire-and-forget (botni qotirmaydi)
// ========================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userState[chatId] = 'main';
  bot.sendMessage(
    chatId,
    `👋 *Assalomu alaykum!*\n\nBu bot Supabase bazasidagi ma'lumotlarni ko'rish va Excel yuklab olish uchun yaratilgan.\n\n🕐 Barcha vaqtlar *O'zbekiston vaqti (UTC+5)* da ko'rsatiladi.\n📡 *Real-time* yangilanishlar yoqilgan!\n\n*Bo'limni tanlang:*`,
    { parse_mode: 'Markdown', ...mainMenu }
  ).catch(e => console.error('start xato:', e.message));
});

bot.on('message', (msg) => {
  // MUHIM: async handler ichida catch bilan — event loop bloklanmaydi
  handleMessage(msg).catch(err => {
    console.error('❌ handleMessage umumiy xato:', err.message);
  });
});

async function handleMessage(msg) {
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
    if (text === '👥 Barcha Userlar')     { handleHuzurAllUsers(chatId);    return; }
    if (text === '📅 Kunlik Statistika')  { handleHuzurDailyStats(chatId);  return; }
    if (text === '📥 Excel Yuklab Olish') { handleHuzurExcel(chatId);       return; }
  }

  // ===== WEBINAR =====
  if (userState[chatId] === 'webinar') {
    if (text === '📋 Barcha Userlar')   { handleWebinarAllUsers(chatId);         return; }
    if (text === '📊 Statistika')       { handleWebinarStats(chatId);            return; }
    if (text === '🅰️ A Sayt')          { handleWebinarBySite(chatId, 'a');      return; }
    if (text === '🅱️ B Sayt')          { handleWebinarBySite(chatId, 'b');      return; }
    if (text === '🅾️ C Sayt')          { handleWebinarBySite(chatId, 'c');      return; }
    if (text === '🔷 D Sayt')           { handleWebinarBySite(chatId, 'd');      return; }
    if (text === '📥 Excel (Barchasi)') { handleWebinarExcel(chatId, 'all');     return; }
    if (text === '📥 Excel (Kunlik)')   { handleWebinarExcel(chatId, 'daily');   return; }
  }

  // ===== VSL =====
  if (userState[chatId] === 'vsl') {
    if (text === '👥 VSL Userlar')    { handleVslAllUsers(chatId);    return; }
    if (text === '📅 VSL Statistika') { handleVslDailyStats(chatId);  return; }
    if (text === '📥 VSL Excel')      { handleVslExcel(chatId);       return; }
  }

  bot.sendMessage(chatId, "❓ Noma'lum buyruq. /start bosing yoki menyudan tanlang.", mainMenu)
    .catch(e => console.error('unknown cmd xato:', e.message));
}

// ========================
// HUZUR HANDLERLARI
// ========================
async function handleHuzurAllUsers(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(chatId,
      "⏳ *Barcha ma'lumotlar yuklanmoqda...*",
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
      msg += `_Sahifa 1/${totalPages} — faqat birinchi ${PAGE_SIZE} ta_\n`;
      msg += `_To'liq ro'yxat uchun 📥 Excel yuklab oling_ ⬇️`;
    }

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleHuzurAllUsers:', err.message);
    const errMsg = `❌ Xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {});
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
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

    const sorted   = Object.entries(dailyMap).sort((a, b) => sortableDate(a[0]).localeCompare(sortableDate(b[0])));
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
    console.error('handleHuzurDailyStats:', err.message);
    const errMsg = `❌ Xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {});
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
  }
}

async function handleHuzurExcel(chatId) {
  let loadMsg;
  let filePath = null;
  try {
    loadMsg = await bot.sendMessage(chatId,
      "⏳ *Excel fayl yaratilmoqda...*\n_(Biroz kuting)_",
      { parse_mode: 'Markdown' }
    );

    const leads = await getHuzurLeads();
    if (leads.length === 0) {
      return bot.editMessageText("📭 Huzur kursida hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    await bot.editMessageText('📊 Ma\'lumotlar tayyorlanmoqda...', {
      chat_id: chatId, message_id: loadMsg.message_id,
    });

    filePath = await createHuzurExcel(leads, `huzur_${Date.now()}.xlsx`);

    const todayStr   = todayUZT();
    const todayCount = leads.filter(l => formatDateOnly(l.created_at) === todayStr).length;
    const caption    =
      `📚 *Huzur Kursi — To'liq Baza*\n` +
      `📊 Jami: *${leads.length}* ta user\n` +
      `📅 Bugun (${todayStr}): *${todayCount}* ta\n` +
      `🕐 ${nowUZT()} (UZT)`;

    await bot.deleteMessage(chatId, loadMsg.message_id).catch(() => {});
    loadMsg = null;

    await sendExcelDocument(chatId, filePath, caption);
    console.log(`✅ Huzur Excel yuborildi: ${chatId}`);
  } catch (err) {
    console.error('handleHuzurExcel:', err.message);
    const errMsg = `❌ Excel xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {
        bot.sendMessage(chatId, errMsg).catch(() => {});
      });
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
  } finally {
    if (filePath) deleteFile(filePath);
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
    console.error('handleWebinarAllUsers:', err.message);
    const errMsg = `❌ Xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {});
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
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
    console.error('handleWebinarStats:', err.message);
    const errMsg = `❌ Xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {});
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
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
      msg += `_Faqat birinchi ${PAGE_SIZE} ta. To'liq uchun Excel yuklab oling._ ⬇️`;
    }

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleWebinarBySite:', err.message);
    const errMsg = `❌ Xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {});
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
  }
}

async function handleWebinarExcel(chatId, type) {
  let loadMsg;
  let filePath = null;
  try {
    loadMsg = await bot.sendMessage(chatId, '⏳ Excel fayl yaratilmoqda...');
    const leads = await getWebinarLeads();

    if (leads.length === 0) {
      return bot.editMessageText("📭 Webinarda hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    await bot.editMessageText('📊 Excel formatlanmoqda...', {
      chat_id: chatId, message_id: loadMsg.message_id,
    });

    filePath = await createWebinarExcel(leads, `webinar_${type}_${Date.now()}.xlsx`);

    const siteCounts = {};
    SITE_KEYS.forEach(s => (siteCounts[s] = 0));
    leads.forEach(l => {
      const s = (l.type || '').toLowerCase();
      if (SITE_KEYS.includes(s)) siteCounts[s]++;
    });
    const siteStr = SITE_KEYS.map(s => `${SITE_LABELS[s]}: ${siteCounts[s]}`).join('\n');
    const caption =
      `🎯 *Webinar Leads — To'liq Baza*\n` +
      `📊 Jami: *${leads.length}* ta\n\n` +
      `${siteStr}\n\n` +
      `📅 ${nowUZT()} (UZT)`;

    await bot.deleteMessage(chatId, loadMsg.message_id).catch(() => {});
    loadMsg = null;

    await sendExcelDocument(chatId, filePath, caption);
    console.log(`✅ Webinar Excel yuborildi: ${chatId}`);
  } catch (err) {
    console.error('handleWebinarExcel:', err.message);
    const errMsg = `❌ Excel xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {
        bot.sendMessage(chatId, errMsg).catch(() => {});
      });
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
  } finally {
    if (filePath) deleteFile(filePath);
  }
}

// ========================
// VSL HANDLERLARI
// ========================
async function handleVslAllUsers(chatId) {
  let loadMsg;
  try {
    loadMsg = await bot.sendMessage(chatId,
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
      msg += `_Sahifa 1/${totalPages} — faqat birinchi ${PAGE_SIZE} ta_\n`;
      msg += `_To'liq ro'yxat uchun 📥 Excel yuklab oling_ ⬇️`;
    }

    await bot.editMessageText(msg, {
      chat_id: chatId, message_id: loadMsg.message_id, parse_mode: 'Markdown',
    });
  } catch (err) {
    console.error('handleVslAllUsers:', err.message);
    const errMsg = `❌ Xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {});
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
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

    const sorted   = Object.entries(dailyMap).sort((a, b) => sortableDate(a[0]).localeCompare(sortableDate(b[0])));
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
    console.error('handleVslDailyStats:', err.message);
    const errMsg = `❌ Xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {});
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
  }
}

async function handleVslExcel(chatId) {
  let loadMsg;
  let filePath = null;
  try {
    loadMsg = await bot.sendMessage(chatId,
      "⏳ *VSL Excel fayl yaratilmoqda...*",
      { parse_mode: 'Markdown' }
    );
    const leads = await getVslLeads();

    if (leads.length === 0) {
      return bot.editMessageText("📭 VSL bo'limida hali user yo'q.", {
        chat_id: chatId, message_id: loadMsg.message_id,
      });
    }

    await bot.editMessageText('📊 VSL Excel formatlanmoqda...', {
      chat_id: chatId, message_id: loadMsg.message_id,
    });

    filePath = await createVslExcel(leads, `vsl_${Date.now()}.xlsx`);

    const todayStr   = todayUZT();
    const todayCount = leads.filter(l => formatDateOnly(l.created_at) === todayStr).length;
    const caption    =
      `💻 *VSL — To'liq Baza*\n` +
      `📊 Jami: *${leads.length}* ta user\n` +
      `📅 Bugun (${todayStr}): *${todayCount}* ta\n` +
      `🕐 ${nowUZT()} (UZT)`;

    await bot.deleteMessage(chatId, loadMsg.message_id).catch(() => {});
    loadMsg = null;

    await sendExcelDocument(chatId, filePath, caption);
    console.log(`✅ VSL Excel yuborildi: ${chatId}`);
  } catch (err) {
    console.error('handleVslExcel:', err.message);
    const errMsg = `❌ Excel xato: ${err.message}`;
    if (loadMsg) {
      bot.editMessageText(errMsg, { chat_id: chatId, message_id: loadMsg.message_id }).catch(() => {
        bot.sendMessage(chatId, errMsg).catch(() => {});
      });
    } else {
      bot.sendMessage(chatId, errMsg).catch(() => {});
    }
  } finally {
    if (filePath) deleteFile(filePath);
  }
}

// ========================
// AVTOMATIK 10 DAQIQALIK HISOBOT
// ========================
let autoReportRunning = false; // parallel hisobotlarni oldini olish

async function sendAutoReport() {
  if (autoReportRunning) {
    console.log('⚠️ Avvalgi auto-report hali tugamagan, o\'tkazib yuborildi.');
    return;
  }
  autoReportRunning = true;
  let excelPath = null;

  try {
    console.log('🔄 Auto-report boshlanmoqda...');

    const [webinarLeads, huzurLeads, vslLeads] = await Promise.all([
      withTimeout(getWebinarLeads(), DB_TIMEOUT, 'webinar DB'),
      withTimeout(getHuzurLeads(),   DB_TIMEOUT, 'huzur DB'),
      withTimeout(getVslLeads(),     DB_TIMEOUT, 'vsl DB'),
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
    msg += `📎 _Webinar to'liq bazasi biriktirildi_`;

    await safeSend(() => bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' }));

    if (webinarLeads.length > 0) {
      const siteStr = SITE_KEYS.map(s => `${SITE_LABELS[s]}: ${siteCounts[s]}`).join(' | ');
      excelPath = await withTimeout(
        createWebinarExcel(webinarLeads, `auto_webinar_${Date.now()}.xlsx`),
        EXCEL_TIMEOUT,
        'auto Excel create'
      );

      const caption =
        `📊 *WEBINAR — TO'LIQ BAZA*\n` +
        `👥 Jami: ${webinarLeads.length} ta\n` +
        `${siteStr}\n` +
        `📅 ${nowStr} (UZT)`;

      await sendExcelDocument(CHANNEL_ID, excelPath, caption);
      deleteFile(excelPath);
      excelPath = null;
    }

    console.log(`✅ Avtomatik hisobot yuborildi: ${nowStr}`);
  } catch (err) {
    console.error('❌ Avtomatik hisobot xatosi:', err.message);
    try {
      await bot.sendMessage(CHANNEL_ID, `⚠️ Auto-hisobot xatosi: ${err.message}`);
    } catch (_) {}
  } finally {
    if (excelPath) deleteFile(excelPath);
    autoReportRunning = false;
  }
}

// Har 10 daqiqada
cron.schedule('*/10 * * * *', () => {
  console.log('⏰ Avtomatik hisobot yuborilmoqda...');
  sendAutoReport().catch(err => console.error('cron xato:', err.message));
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

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// ========================
// START
// ========================
console.log('🚀 Bot ishga tushdi!');
console.log('📊 Supabase:', SUPABASE_URL);
console.log("🕐 Vaqt zonasi: UTC+5 (O'zbekiston)");
console.log('🔄 Har 10 daqiqada avtomatik hisobot');
console.log('📡 Real-time: leads, huzur, vsl kuzatilmoqda');
console.log('⚡ Bir vaqtda ko\'p so\'rovlar: YOQILGAN');

// Birinchi hisobotni 5 soniyadan keyin yuborish (bot to'liq ishga tushsin)
setTimeout(() => {
  sendAutoReport().catch(err => console.error('Boshlang\'ich hisobot xatosi:', err.message));
}, 5000);