import { Telegraf, Markup } from 'telegraf'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BOT_TOKEN = '8783455246:AAGue6i2STwC7IXBLctEg50SmoYOw_JFVb4'
const ADMIN_LOGIN = 'admin'
const ADMIN_PASSWORD = 'admin123'

const CHANNEL_ID = '@botbazaiman'
const EXCEL_INTERVAL_MINUTES = 10

const USERS_CSV     = path.join(__dirname, 'users.csv')
const MESSAGES_JSON = path.join(__dirname, 'start_messages.json')
const ADMINS_JSON   = path.join(__dirname, 'admins.json')
const TEMP_DIR      = path.join(__dirname, 'temp_exports')

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const toTashkentDate = (isoStr) => {
  try {
    const d = new Date(isoStr)
    if (isNaN(d)) return null
    // Toshkent UTC+5
    const tzOffset = 5 * 60
    const local = new Date(d.getTime() + tzOffset * 60000)
    return local
  } catch { return null }
}

const formatTashkent = (isoStr) => {
  const d = toTashkentDate(isoStr)
  if (!d) return isoStr
  const day   = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year  = d.getUTCFullYear()
  const hh    = String(d.getUTCHours()).padStart(2, '0')
  const mm    = String(d.getUTCMinutes()).padStart(2, '0')
  const ss    = String(d.getUTCSeconds()).padStart(2, '0')
  return `${day}/${month}/${year}, ${hh}:${mm}:${ss}`
}

// Hozirgi Toshkent vaqti ISO formatda
const nowTashkentISO = () => {
  const now = new Date()
  const tzOffset = 5 * 60
  const local = new Date(now.getTime() + tzOffset * 60000)
  return local.toISOString().replace('Z', '+05:00')
}

// CSV satrdan sanani ISO ga o'girish
// Format: dd/mm/yyyy, hh:mm:ss  yoki ISO yoki boshqa
const parseDateToISO = (raw) => {
  if (!raw || raw.trim() === '' || raw.trim() === 'Invalid Date') return ''
  raw = raw.trim()

  // dd/mm/yyyy, hh:mm:ss
  const m1 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})/)
  if (m1) {
    const [, dd, MM, yyyy, hh, min, ss] = m1
    // UTC dan saqlash (Toshkent = UTC+5, shuning uchun -5 qilib UTC ga o'giramiz)
    const d = new Date(Date.UTC(
      parseInt(yyyy),
      parseInt(MM) - 1,
      parseInt(dd),
      parseInt(hh) - 5,
      parseInt(min),
      parseInt(ss)
    ))
    return isNaN(d) ? raw : d.toISOString()
  }

  // ISO format
  if (raw.includes('T') || raw.includes('-')) {
    const d = new Date(raw)
    return isNaN(d) ? raw : d.toISOString()
  }

  return raw
}

// ===== CSV FAYLLARNI YARATISH =====
const CSV_HEADER = "User ID,Username,Ism,Site turi,Qo'shilgan sana"

const ensureCSV = () => {
  if (!fs.existsSync(USERS_CSV)) {
    fs.writeFileSync(USERS_CSV, CSV_HEADER + '\n', 'utf8')
    console.log('✅ users.csv yaratildi')
  }
}
ensureCSV()

if (!fs.existsSync(MESSAGES_JSON)) {
  fs.writeFileSync(MESSAGES_JSON, JSON.stringify({ site1: [], site2: [], default: [] }, null, 2))
}
if (!fs.existsSync(ADMINS_JSON)) {
  fs.writeFileSync(ADMINS_JSON, JSON.stringify({}))
}

const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 60_000 })

// ===== SESSIYALAR =====
let sessions = {}
try { sessions = JSON.parse(fs.readFileSync(ADMINS_JSON, 'utf8')) } catch {}
const isAdmin = userId => sessions[String(userId)] === true
const saveSession = () => fs.writeFileSync(ADMINS_JSON, JSON.stringify(sessions, null, 2), 'utf8')

// ===== START XABARLAR =====
const readStartMessages = () => {
  try {
    const data = JSON.parse(fs.readFileSync(MESSAGES_JSON, 'utf8'))
    return { site1: data.site1 || [], site2: data.site2 || [], default: data.default || [] }
  } catch { return { site1: [], site2: [], default: [] } }
}
const writeStartMessages = data => fs.writeFileSync(MESSAGES_JSON, JSON.stringify(data, null, 2), 'utf8')

// ===== CSV O'QISH =====
// Format: User ID,Username,Ism,Site turi,Qo'shilgan sana
// Sana: dd/mm/yyyy, hh:mm:ss  (vergul ichida)
// Jami 5 ta ustun, lekin sana ichida vergul bor => split qilganda 6+ bo'lak

const parseCSVLine = (line) => {
  // 0: id, 1: username, 2: name, 3: siteType, 4+: date (vergul bilan)
  const parts = line.split(',')
  if (parts.length < 4) return null

  const id        = parts[0].trim()
  const username  = parts[1].trim()
  const name      = parts[2].trim()
  const siteType  = parts[3].trim()
  // Sana: qolgan qismlarni birlashtirish
  const dateRaw   = parts.slice(4).join(',').trim()

  if (!id || isNaN(Number(id))) return null

  let siteNorm = siteType
  if (!siteNorm || siteNorm === '') siteNorm = 'unknown'
  else if (['default', 'Oddiy start'].includes(siteNorm)) siteNorm = 'default'
  else if (['site1', 'Site1'].includes(siteNorm)) siteNorm = 'site1'
  else if (['site2', 'Site2'].includes(siteNorm)) siteNorm = 'site2'

  const dateISO = parseDateToISO(dateRaw)

  return { id, username, name, siteType: siteNorm, date: dateISO }
}

const getUsers = () => {
  try {
    ensureCSV()
    const content = fs.readFileSync(USERS_CSV, 'utf8')
    const lines = content.split('\n').filter(l => l.trim())
    // Header qatorini o'tkazib yuborish
    const dataLines = lines.filter(l => !l.startsWith('User ID') && !l.startsWith('STATISTIKA') && !l.startsWith('Sayt turi') && !l.startsWith('Jami') && !l.startsWith('Bugun') && !l.startsWith('Hisobot'))
    const users = dataLines.map(parseCSVLine).filter(Boolean)
    return users
  } catch (e) {
    console.error('❌ getUsers xatolik:', e.message)
    return []
  }
}

// ===== ATOMIK YOZISH =====
// Faqat data qismini saqlaydi (statistika yo'q)
const writeUsers = (users) => {
  ensureCSV()
  const rows = users.map(u => {
    const safeUsername = (u.username || '').replace(/\n/g, ' ')
    const safeName     = (u.name     || '').replace(/\n/g, ' ')
    const dateFmt      = u.date ? formatTashkent(u.date) : ''
    return `${u.id},${safeUsername},${safeName},${u.siteType},${dateFmt}`
  })
  const data = [CSV_HEADER, ...rows].join('\n') + '\n'
  const tmpFile = USERS_CSV + '.tmp'
  fs.writeFileSync(tmpFile, data, 'utf8')
  fs.renameSync(tmpFile, USERS_CSV)
}

const saveUser = (user, siteType) => {
  try {
    let users = getUsers()
    const existing = users.find(u => u.id === String(user.id))
    if (existing) {
      existing.siteType = siteType
      console.log(`🔄 Yangilandi: ${user.id} → ${siteType}`)
    } else {
      const safeUsername  = (user.username   || '').replace(/\n/g, ' ')
      const safeFirstName = (user.first_name || '').replace(/\n/g, ' ')
      // Hozirgi vaqtni UTC sifatida saqlash
      users.push({
        id: String(user.id),
        username: safeUsername,
        name: safeFirstName,
        date: new Date().toISOString(),
        siteType
      })
      console.log(`➕ Yangi: ${user.id} → ${siteType}`)
    }
    writeUsers(users)
  } catch (e) {
    console.error('saveUser xatosi:', e.message)
  }
}

// ===== STATISTIKA YORDAMCHILAR =====
// ISO date dan Toshkent bo'yicha YYYY-MM-DD olish
const getTashkentDateStr = (isoStr) => {
  const d = toTashkentDate(isoStr)
  if (!d) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const getTodayStr = () => {
  const now = new Date()
  const d = new Date(now.getTime() + 5 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const getYesterdayStr = () => {
  const now = new Date()
  const d = new Date(now.getTime() + 5 * 60 * 60 * 1000 - 86400000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const getTodayUsers = () => {
  const today = getTodayStr()
  const users = getUsers()
  return users.filter(u => getTashkentDateStr(u.date) === today)
}

// Kunlik breakdown: har bir kun nechta odam start bosgan
const getDailyStats = (users) => {
  const map = {}
  for (const u of users) {
    const ds = getTashkentDateStr(u.date)
    if (!ds) continue
    if (!map[ds]) map[ds] = 0
    map[ds]++
  }
  return map
}

// ===== EXPORT CSV =====
const generateExportCSV = (siteType = null) => {
  try {
    const users = getUsers()
    const filtered = siteType ? users.filter(u => u.siteType === siteType) : users

    const today = getTodayStr()
    const todayCount = filtered.filter(u => getTashkentDateStr(u.date) === today).length

    // Kunlik breakdown
    const daily = getDailyStats(filtered)
    const sortedDays = Object.keys(daily).sort().reverse()

    let csv = '\uFEFF'
    csv += CSV_HEADER + '\n'

    filtered.forEach(u => {
      const safeUsername = (u.username || "Yo'q")
      const safeName     = (u.name     || "Yo'q")
      const dateFmt      = u.date ? formatTashkent(u.date) : ''
      csv += `${u.id},${safeUsername},${safeName},${u.siteType},${dateFmt}\n`
    })

    csv += `\nSTATISTIKA\n`
    csv += `Sayt turi,${siteType || 'Barcha'}\n`
    csv += `Jami foydalanuvchilar,${filtered.length}\n`
    csv += `Bugun qo'shilganlar,${todayCount}\n`
    csv += `Hisobot sanasi,${formatTashkent(new Date().toISOString())}\n`

    // Kunlik hisobot
    csv += `\nKUNLIK TAQSIMOT\n`
    csv += `Sana,Yangi foydalanuvchilar\n`
    for (const ds of sortedDays) {
      // dd/mm/yyyy formatga o'tkazish
      const [y, m, d] = ds.split('-')
      csv += `${d}/${m}/${y},${daily[ds]}\n`
    }

    const filename = path.join(TEMP_DIR, `export_${siteType || 'all'}_${Date.now()}.csv`)
    fs.writeFileSync(filename, csv, 'utf8')
    return filename
  } catch (e) {
    console.error('generateExportCSV xatosi:', e.message)
    return null
  }
}

const safeDeleteTempFile = filepath => {
  try {
    if (!filepath) return
    const resolved = path.resolve(filepath)
    if (resolved.startsWith(path.resolve(TEMP_DIR)) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved)
    }
  } catch {}
}

// ===== NON-BLOCKING BROADCAST QUEUE =====
// Broadcast bot'ni qotirmasligi uchun background'da ishlaydi.
// Har bir xabar orasida setImmediate → event loop bo'shashadi →
// boshqa /start, admin buyruqlari ishlayveradi.

const broadcastQueue = [] // { users, chatId, msgId, fromChatId, stMsgId, resolve }
let broadcastRunning = false

const sleep = ms => new Promise(r => setTimeout(r, ms))

const runBroadcastQueue = async () => {
  if (broadcastRunning) return
  broadcastRunning = true
  while (broadcastQueue.length > 0) {
    const job = broadcastQueue.shift()
    await processBroadcastJob(job)
  }
  broadcastRunning = false
}

const processBroadcastJob = async (job) => {
  const { users, fromChatId, msgId, stMsgId, chatId } = job
  let ok = 0, err = 0
  const total = users.length

  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    try {
      await bot.telegram.copyMessage(u.id, fromChatId, msgId)
      ok++
    } catch {
      err++
    }

    const done = ok + err

    // Har 20 ta da progress yangilash
    if (done % 20 === 0 || done === total) {
      try {
        await bot.telegram.editMessageText(
          chatId, stMsgId, null,
          `📤 ${done}/${total} (✅${ok} ❌${err})`
        )
      } catch {}
    }

    // Event loop'ni bo'shatish uchun — bu asosiy trick
    // setImmediate boshqa pending callbacklarni ishlashiga ruxsat beradi
    await new Promise(r => setImmediate(r))

    // Telegram rate limit: 30 msg/sec, bir oz kutish
    if (i % 30 === 29) await sleep(1000)
  }

  try {
    await bot.telegram.editMessageText(
      chatId, stMsgId, null,
      `✅ Broadcast tugadi!\n📤 Jami: ${total}\n✅ Muvaffaqiyatli: ${ok}\n❌ Xatolik: ${err}`
    )
  } catch {}
}

// ===== ADMIN STATE =====
const adminState = {}

// ===== START XABARLARNI YUBORISH =====
const sendStartMessages = async (userId, siteType) => {
  try {
    const all = readStartMessages()
    const msgs = all[siteType] || []
    for (const msg of msgs) {
      await new Promise(resolve => setTimeout(resolve, msg.delay * 1000))
      const inlineKeyboard = msg.btn_text && msg.btn_url
        ? { reply_markup: { inline_keyboard: [[{ text: msg.btn_text, url: msg.btn_url }]] } }
        : {}
      try {
        if (msg.media_type === 'text') await bot.telegram.sendMessage(userId, msg.text, inlineKeyboard)
        else if (msg.media_type === 'photo') await bot.telegram.sendPhoto(userId, msg.media_file_id, { caption: msg.text, ...inlineKeyboard })
        else if (msg.media_type === 'video') await bot.telegram.sendVideo(userId, msg.media_file_id, { caption: msg.text, ...inlineKeyboard })
        else if (msg.media_type === 'video_note') {
          await bot.telegram.sendVideoNote(userId, msg.media_file_id, inlineKeyboard)
          if (msg.text) await bot.telegram.sendMessage(userId, msg.text)
        }
      } catch (e) { console.error(`Xabar yuborilmadi (${userId}):`, e.message) }
    }
    return msgs.length
  } catch { return 0 }
}

// ===== KLAVIATURA =====
const adminKeyboard = () => Markup.keyboard([
  ['➕ Site1 xabar', '📋 Site1 xabarlar'],
  ['➕ Site2 xabar', '📋 Site2 xabarlar'],
  ['➕ Oddiy start xabar', '📋 Oddiy start xabarlar'],
  ['📢 Hammaga xabar', '📊 Statistika'],
  ['👥 Barcha userlar', '📥 Excel yuklab olish'],
  ['📅 Kunlik taqsimot']
]).resize()

// ===== STATISTIKA XABARI =====
const buildStatsText = (users) => {
  const today     = getTodayStr()
  const yesterday = getYesterdayStr()
  const msgs      = readStartMessages()

  const todayCount     = users.filter(u => getTashkentDateStr(u.date) === today).length
  const yesterdayCount = users.filter(u => getTashkentDateStr(u.date) === yesterday).length
  const site1Count   = users.filter(u => u.siteType === 'site1').length
  const site2Count   = users.filter(u => u.siteType === 'site2').length
  const defCount     = users.filter(u => u.siteType === 'default').length
  const unknownCount = users.filter(u => u.siteType === 'unknown').length

  const tNow = formatTashkent(new Date().toISOString())
  return `📊 *STATISTIKA*\n📅 ${tNow}\n\n👥 *Jami: ${users.length}*\n📅 Bugun: ${todayCount}\n📅 Kecha: ${yesterdayCount}\n\n🌐 Site1: ${site1Count} (xabarlar: ${msgs.site1.length})\n🌐 Site2: ${site2Count} (xabarlar: ${msgs.site2.length})\n🟢 Oddiy start: ${defCount} (xabarlar: ${msgs.default.length})\n❓ Noma'lum: ${unknownCount}`
}

// ===== KUNLIK HISOBOT =====
const sendDailyReport = async () => {
  try {
    const admins = Object.entries(sessions).filter(([, v]) => v === true).map(([id]) => id)
    if (!admins.length) return
    const users = getUsers()
    const text = buildStatsText(users)
    const today = getTodayStr()
    const file = generateExportCSV(null)
    for (const id of admins) {
      await bot.telegram.sendMessage(id, text, { parse_mode: 'Markdown' })
      if (file) await bot.telegram.sendDocument(id, { source: file, filename: `daily_${today}.csv` }, { caption: `📎 Barcha foydalanuvchilar – ${users.length} ta` }).catch(() => {})
    }
    if (file) safeDeleteTempFile(file)
  } catch (e) { console.error('Kunlik hisobot xatosi:', e.message) }
}

// ===== KANALGA EXCEL YUBORISH =====
const sendExcelToChannel = async () => {
  try {
    const users = getUsers()
    if (!users || users.length === 0) return
    const filePath = generateExportCSV(null)
    if (!filePath) return
    const now = formatTashkent(new Date().toISOString())
    const caption = `📊 Avtomatik hisobot (har ${EXCEL_INTERVAL_MINUTES} daqiqa)\n👥 Jami foydalanuvchilar: ${users.length}\n📅 Sana: ${now}`
    await bot.telegram.sendDocument(
      CHANNEL_ID,
      { source: filePath, filename: `users_report_${Date.now()}.csv` },
      { caption }
    )
    console.log(`✅ Kanalga Excel yuborildi (${users.length} ta)`)
    safeDeleteTempFile(filePath)
  } catch (e) {
    console.error('❌ Kanalga yuborishda xatolik:', e.message)
  }
}

setInterval(sendExcelToChannel, EXCEL_INTERVAL_MINUTES * 60 * 1000)

// Kunlik hisobot Toshkent 00:00
let lastSentDate = ''
setInterval(() => {
  const today = getTodayStr()
  const tNow  = new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
  const h = tNow.getUTCHours()
  const min = tNow.getUTCMinutes()
  if (h === 0 && min === 0 && lastSentDate !== today) {
    lastSentDate = today
    sendDailyReport()
  }
}, 60_000)

// ===== /start =====
bot.start(async ctx => {
  try {
    const args = (ctx.message.text || '').split(' ')
    let site = 'default'
    if (args[1]?.toLowerCase().includes('site1')) site = 'site1'
    else if (args[1]?.toLowerCase().includes('site2')) site = 'site2'
    saveUser(ctx.from, site)
    const sent = await sendStartMessages(ctx.from.id, site)
    if (sent === 0) await ctx.reply('Botimizga xush kelibsiz!')
  } catch (e) { console.error('/start xatosi:', e.message) }
})

// ===== LOGIN/LOGOUT/ADMIN =====
bot.command('login', ctx => { adminState[ctx.from.id] = { step: 'login' }; ctx.reply('👤 Login kiriting:') })
bot.command('logout', ctx => {
  sessions[String(ctx.from.id)] = false; saveSession(); ctx.reply('👋 Tizimdan chiqdingiz')
})
bot.command('admin', ctx => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('⛔️ Sizda admin huquqi yo\'q')
  adminState[ctx.from.id] = { step: 'menu' }; ctx.reply('🛠 Admin panel', adminKeyboard())
})
bot.command('dailyreport', async ctx => {
  if (isAdmin(ctx.from.id)) { await ctx.reply('📊 Hisobot yuborilmoqda...'); await sendDailyReport() }
})
bot.command('dbcheck', ctx => {
  if (!isAdmin(ctx.from.id)) return
  const users = getUsers()
  ctx.reply(`🗃 Baza: ${USERS_CSV}\n👥 Jami: ${users.length}\n📅 Bugun: ${getTodayUsers().length}`)
})

// ===== TUGMALAR =====
const startAddMessage = (ctx, site) => {
  if (!isAdmin(ctx.from.id)) return
  adminState[ctx.from.id] = { step: 'wait_media', site }
  ctx.reply(`📨 ${site === 'default' ? 'Oddiy start' : site.toUpperCase()} uchun media yuboring yoki /skip`, Markup.keyboard([['/skip']]).resize())
}

const showMessagesList = async (ctx, site) => {
  if (!isAdmin(ctx.from.id)) return
  const list = readStartMessages()[site] || []
  if (!list.length) return ctx.reply(`❌ ${site === 'default' ? 'Oddiy start' : site.toUpperCase()} uchun start xabarlari yo'q`)
  for (const m of list) {
    try {
      if (m.media_type === 'text') await ctx.reply(`📝 ${m.text}`)
      else if (m.media_type === 'photo') await ctx.replyWithPhoto(m.media_file_id, { caption: m.text || '' })
      else if (m.media_type === 'video') await ctx.replyWithVideo(m.media_file_id, { caption: m.text || '' })
      else if (m.media_type === 'video_note') { await ctx.replyWithVideoNote(m.media_file_id); if (m.text) await ctx.reply(`📝 ${m.text}`) }
    } catch (e) { await ctx.reply(`⚠️ Xato: ${e.message}`) }
    await ctx.reply(
      `🆔 ID: ${m.id}\n📦 Turi: ${m.media_type}\n⏱ Kechikish: ${m.delay} sek\n🔘 Tugma: ${m.btn_text ? m.btn_text + ' → ' + m.btn_url : 'Yo\'q'}`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Matn', `edit_text_${site}_${m.id}`), Markup.button.callback('🖼 Media', `edit_media_${site}_${m.id}`)],
        [Markup.button.callback('🔘 Tugma matni', `edit_btn_text_${site}_${m.id}`), Markup.button.callback('🔗 Tugma link', `edit_btn_url_${site}_${m.id}`)],
        [Markup.button.callback('⏱ Kechikish', `edit_delay_${site}_${m.id}`), Markup.button.callback('❌ Tugmani o\'chir', `delete_btn_${site}_${m.id}`)],
        [Markup.button.callback('🗑 Xabarni o\'chirish', `delete_msg_${site}_${m.id}`)]
      ])
    )
  }
}

bot.hears('➕ Site1 xabar',        ctx => startAddMessage(ctx, 'site1'))
bot.hears('➕ Site2 xabar',        ctx => startAddMessage(ctx, 'site2'))
bot.hears('➕ Oddiy start xabar',  ctx => startAddMessage(ctx, 'default'))
bot.hears('📋 Site1 xabarlar',    ctx => showMessagesList(ctx, 'site1'))
bot.hears('📋 Site2 xabarlar',    ctx => showMessagesList(ctx, 'site2'))
bot.hears('📋 Oddiy start xabarlar', ctx => showMessagesList(ctx, 'default'))

bot.hears('📊 Statistika', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const users = getUsers()
  await ctx.reply(buildStatsText(users), { parse_mode: 'Markdown' })
})

bot.hears('👥 Barcha userlar', ctx => {
  if (!isAdmin(ctx.from.id)) return
  const users = getUsers()
  const site1Count   = users.filter(u => u.siteType === 'site1').length
  const site2Count   = users.filter(u => u.siteType === 'site2').length
  const defCount     = users.filter(u => u.siteType === 'default').length
  const unknownCount = users.filter(u => u.siteType === 'unknown').length
  ctx.reply(`👥 Jami: ${users.length}\n🌐 Site1: ${site1Count}\n🌐 Site2: ${site2Count}\n🟢 Oddiy start: ${defCount}\n❓ Noma'lum: ${unknownCount}\n📅 Bugun: ${getTodayUsers().length}`)
})

bot.hears('📥 Excel yuklab olish', ctx => {
  if (!isAdmin(ctx.from.id)) return
  adminState[ctx.from.id] = { step: 'excel_choice' }
  ctx.reply('Qaysi guruh?', Markup.keyboard([
    ['📊 Barcha', '🌐 Site1'],
    ['🌐 Site2', '🟢 Oddiy start'],
    ['⬅️ Orqaga']
  ]).resize())
})

// Kunlik taqsimot
bot.hears('📅 Kunlik taqsimot', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const users = getUsers()
  const daily = getDailyStats(users)
  const sortedDays = Object.keys(daily).sort().reverse().slice(0, 30)
  if (!sortedDays.length) return ctx.reply('📅 Ma\'lumot yo\'q')
  let text = '📅 *KUNLIK TAQSIMOT (so\'nggi 30 kun)*\n\n'
  for (const ds of sortedDays) {
    const [y, m, d] = ds.split('-')
    text += `${d}/${m}/${y}: *${daily[ds]}* ta\n`
  }
  await ctx.reply(text, { parse_mode: 'Markdown' })
})

// ===== CALLBACK =====
bot.on('callback_query', async ctx => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q')
  try {
    const d = ctx.callbackQuery.data.split('_')
    const id = d.pop(), site = d.pop(), act = d.join('_')
    const all = readStartMessages(); const msgs = all[site] || []; const m = msgs.find(x => x.id === id)
    if (!m) return ctx.answerCbQuery('Topilmadi')
    if (act === 'delete_msg') {
      all[site] = msgs.filter(x => x.id !== id); writeStartMessages(all); await ctx.deleteMessage(); return
    }
    if (act === 'delete_btn') {
      m.btn_text = ''; m.btn_url = ''; writeStartMessages(all); await ctx.answerCbQuery('Tugma olib tashlandi'); return
    }
    if (act.startsWith('edit_')) {
      const field = act.replace('edit_', '')
      adminState[ctx.from.id] = { step: `edit_${field}`, site, id }
      const prompts = {
        text: '✏️ Yangi matn',
        media: '🖼 Yangi media',
        btn_text: '🔘 Tugma matni',
        btn_url: '🔗 Tugma link',
        delay: '⏱ Kechikish (soniya)'
      }
      await ctx.reply(prompts[field] || 'Qiymat kiriting:')
      return ctx.answerCbQuery()
    }
    await ctx.answerCbQuery('Amal bajarilmadi')
  } catch { ctx.answerCbQuery('Xatolik') }
})

// ===== BARCHA MATNLI XABARLAR =====
bot.on('message', async ctx => {
  const uid   = ctx.from.id
  const state = adminState[uid]
  const txt   = ctx.message.text || ctx.message.caption || ''

  // --- Broadcast tugmasi ---
  if (txt === '📢 Hammaga xabar' && isAdmin(uid)) {
    adminState[uid] = { step: 'broadcast_target' }
    return ctx.reply('Guruhni tanlang:', Markup.keyboard([
      ['🌐 Site1', '🌐 Site2'], ['🟢 Oddiy start', '👥 Barcha'], ['⬅️ Orqaga']
    ]).resize())
  }

  // --- Login bosqichlari ---
  if (state?.step === 'login') { adminState[uid] = { step: 'password', login: txt }; return ctx.reply('🔐 Parol:') }
  if (state?.step === 'password') {
    if (state.login === ADMIN_LOGIN && txt === ADMIN_PASSWORD) {
      sessions[String(uid)] = true; saveSession(); delete adminState[uid]
      return ctx.reply('✅ Xush kelibsiz, admin!', adminKeyboard())
    } else { delete adminState[uid]; return ctx.reply('❌ Noto\'g\'ri') }
  }

  if (!isAdmin(uid)) return

  // --- Excel tanlov ---
  if (state?.step === 'excel_choice') {
    let site = null
    if (txt === '📊 Barcha')      site = null
    else if (txt === '🌐 Site1')   site = 'site1'
    else if (txt === '🌐 Site2')   site = 'site2'
    else if (txt === '🟢 Oddiy start') site = 'default'
    else if (txt === '⬅️ Orqaga') { delete adminState[uid]; return ctx.reply('Admin panel', adminKeyboard()) }
    else return ctx.reply('Noto\'g\'ri tanlov')

    const fn = generateExportCSV(site)
    if (fn) {
      const count = getUsers().filter(u => !site || u.siteType === site).length
      await ctx.replyWithDocument({ source: fn, filename: 'users.csv' }, { caption: `👥 Jami: ${count} ta` })
      safeDeleteTempFile(fn)
    } else {
      await ctx.reply('❌ Xatolik yuz berdi')
    }
    delete adminState[uid]; return ctx.reply('✅', adminKeyboard())
  }

  // --- Media qo'shish ---
  if (state?.step === 'wait_media') {
    const site = state.site
    if (txt === '/skip') { adminState[uid] = { step: 'wait_text', site, media_type: 'text' }; return ctx.reply('Matn yuboring:') }
    let mt = null, fid = null
    if (ctx.message.photo)      { mt = 'photo';      fid = ctx.message.photo.pop().file_id }
    else if (ctx.message.video) { mt = 'video';      fid = ctx.message.video.file_id }
    else if (ctx.message.video_note) { mt = 'video_note'; fid = ctx.message.video_note.file_id }
    else return ctx.reply('Media yoki /skip')
    adminState[uid] = { step: 'wait_text', site, media_type: mt, media_file_id: fid }
    return ctx.reply('Media uchun caption (/skip – bo\'sh)', Markup.keyboard([['/skip']]).resize())
  }
  if (state?.step === 'wait_text') {
    const text = txt === '/skip' ? '' : (txt || '')
    adminState[uid] = { ...state, text, step: 'wait_button' }
    return ctx.reply('Inline tugma qo\'shilsinmi?', Markup.keyboard([['Ha'], ['Yo\'q']]).resize())
  }
  if (state?.step === 'wait_button') {
    if (txt === 'Ha') { adminState[uid] = { ...state, step: 'wait_btn_text' }; return ctx.reply('Tugma matni:') }
    else { adminState[uid] = { ...state, btn_text: '', btn_url: '', step: 'wait_delay' }; return ctx.reply('Kechikish (soniya):') }
  }
  if (state?.step === 'wait_btn_text') { adminState[uid] = { ...state, btn_text: txt, step: 'wait_btn_url' }; return ctx.reply('Tugma linki:') }
  if (state?.step === 'wait_btn_url') { adminState[uid] = { ...state, btn_url: txt, step: 'wait_delay' }; return ctx.reply('Kechikish (soniya):') }
  if (state?.step === 'wait_delay') {
    const d = parseFloat(txt); if (isNaN(d)) return ctx.reply('Raqam kiriting')
    if (!state.site) { delete adminState[uid]; return ctx.reply('Xatolik: site topilmadi') }
    const all = readStartMessages()
    const nm = {
      id: String(Date.now()),
      media_type: state.media_type || 'text',
      media_file_id: state.media_file_id || '',
      text: state.text || '',
      delay: d,
      btn_text: state.btn_text || '',
      btn_url: state.btn_url || ''
    }
    if (!all[state.site]) all[state.site] = []
    all[state.site].push(nm)
    writeStartMessages(all)
    delete adminState[uid]
    return ctx.reply(`✅ ${state.site === 'default' ? 'Oddiy start' : state.site.toUpperCase()} uchun xabar qo'shildi`, adminKeyboard())
  }

  // --- Tahrirlash ---
  if (state?.step?.startsWith('edit_')) {
    const field = state.step.replace('edit_', '')
    const all = readStartMessages(); const msgs = all[state.site] || []; const m = msgs.find(x => x.id === state.id)
    if (!m) { delete adminState[uid]; return ctx.reply('Topilmadi') }
    try {
      if (field === 'text') m.text = txt
      else if (field === 'media') {
        if (ctx.message.photo)      { m.media_type = 'photo';      m.media_file_id = ctx.message.photo.pop().file_id }
        else if (ctx.message.video) { m.media_type = 'video';      m.media_file_id = ctx.message.video.file_id }
        else if (ctx.message.video_note) { m.media_type = 'video_note'; m.media_file_id = ctx.message.video_note.file_id }
        else return ctx.reply('Media yuboring')
      } else if (field === 'btn_text') m.btn_text = txt
      else if (field === 'btn_url')   m.btn_url  = txt
      else if (field === 'delay') { const v = parseFloat(txt); if (isNaN(v)) return ctx.reply('Raqam'); m.delay = v }
      writeStartMessages(all); delete adminState[uid]; return ctx.reply('✅ O\'zgartirildi', adminKeyboard())
    } catch { delete adminState[uid]; return ctx.reply('Xatolik', adminKeyboard()) }
  }

  // --- Broadcast ---
  if (state?.step === 'broadcast_target') {
    let target = null
    if (txt === '🌐 Site1')        target = 'site1'
    else if (txt === '🌐 Site2')   target = 'site2'
    else if (txt === '🟢 Oddiy start') target = 'default'
    else if (txt === '👥 Barcha')  target = 'all'
    else if (txt === '⬅️ Orqaga') { delete adminState[uid]; return ctx.reply('Admin panel', adminKeyboard()) }
    else return ctx.reply('Guruhni tanlang', Markup.keyboard([
      ['🌐 Site1', '🌐 Site2'], ['🟢 Oddiy start', '👥 Barcha'], ['⬅️ Orqaga']
    ]).resize())

    // Nechta odam bor – ko'rsatish
    const allUsers = getUsers()
    const targetUsers = target === 'all' ? allUsers : allUsers.filter(u => u.siteType === target)
    adminState[uid] = { step: 'broadcast_send', target }
    return ctx.reply(
      `✅ Tanlandi: ${target === 'all' ? 'Barcha' : target}\n👥 ${targetUsers.length} ta foydalanuvchi\n\nYuboriladigan xabarni yuboring:`,
      Markup.removeKeyboard()
    )
  }

  if (state?.step === 'broadcast_send') {
    const allUsers = getUsers()
    const targetUsers = state.target === 'all' ? allUsers : allUsers.filter(u => u.siteType === state.target)

    if (!targetUsers.length) {
      delete adminState[uid]
      return ctx.reply('❌ Foydalanuvchi topilmadi', adminKeyboard())
    }

    // Progress xabari
    const stMsg = await ctx.reply(`📤 Navbatga qo'shildi: 0/${targetUsers.length}\n⏳ Broadcast background'da ishlaydi...`)

    // Navbatga qo'shish — await YO'Q, bot bloklanmaydi!
    broadcastQueue.push({
      users:      targetUsers,
      fromChatId: ctx.chat.id,
      msgId:      ctx.message.message_id,
      chatId:     ctx.chat.id,
      stMsgId:    stMsg.message_id
    })
    runBroadcastQueue() // fire-and-forget

    delete adminState[uid]
    return ctx.reply(`✅ Broadcast boshlandi!\nBot bloklanmaydi — boshqalar /start bosa oladi.\n📊 Progressni yuqoridagi xabarda kuzating.`, adminKeyboard())
  }
})

// ===== GLOBAL XATO TUTISH =====
bot.catch((err, ctx) => {
  console.error('Bot xatosi:', err?.message || err)
  // foydalanuvchiga xabar bermaslik — shunchaki log
})

// ===== ISHGA TUSHIRISH =====
bot.launch({ dropPendingUpdates: true }).then(() => {
  console.log('🚀 BOT ISHLAYAPTI')
  console.log(`👤 Login: ${ADMIN_LOGIN}  🔐 Parol: ${ADMIN_PASSWORD}`)
  console.log(`📁 Baza: ${USERS_CSV}`)
  console.log(`📡 Kanal: ${CHANNEL_ID} ga har ${EXCEL_INTERVAL_MINUTES} daqiqada Excel yuboriladi`)
  console.log('✅ Kunlik hisobot taymeri ishlamoqda')
})
process.once('SIGINT',  () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))