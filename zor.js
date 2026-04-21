import { Telegraf, Markup } from 'telegraf'
import fs from 'fs'

const BOT_TOKEN = '8783455246:AAEnWJ8rUj5ubulU0wemIEtdV53xgaWhE5E'
const ADMIN_LOGIN = 'admin'
const ADMIN_PASSWORD = 'admin123'

const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 60_000 })

// ===== Fayllarni tekshirish va yaratish =====
if (!fs.existsSync('users.csv')) {
  fs.writeFileSync('users.csv', 'user_id,username,first_name,date,site_type\n')
}

if (!fs.existsSync('start_messages.json')) {
  fs.writeFileSync('start_messages.json', JSON.stringify({
    site1: [],
    site2: [],
    default: []
  }, null, 2))
}

if (!fs.existsSync('admins.json')) {
  fs.writeFileSync('admins.json', JSON.stringify({}))
}

// ===== Yordamchi funksiyalar =====

const readStartMessages = () => {
  try {
    const data = JSON.parse(fs.readFileSync('start_messages.json', 'utf8'))
    return {
      site1: data.site1 || [],
      site2: data.site2 || [],
      default: data.default || []
    }
  } catch (e) {
    return { site1: [], site2: [], default: [] }
  }
}

const writeStartMessages = (data) => {
  try {
    fs.writeFileSync('start_messages.json', JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Xabarlarni yozishda xatolik:', e)
  }
}

const getUsers = () => {
  try {
    const content = fs.readFileSync('users.csv', 'utf8')
    const lines = content.split('\n').slice(1).filter(Boolean)
    return lines.map(line => {
      const [id, username, name, date, siteType] = line.split(',')
      return { id, username, name, date, siteType: siteType || 'unknown' }
    })
  } catch (e) {
    console.error('Foydalanuvchilarni o\'qishda xatolik:', e)
    return []
  }
}

const saveUser = (user, siteType) => {
  try {
    const users = getUsers()
    const exists = users.find(u => u.id === String(user.id))

    if (exists) {
      const rows = fs.readFileSync('users.csv', 'utf8').split('\n')
      const updated = rows.map(row => {
        const parts = row.split(',')
        if (parts[0] === String(user.id)) {
          parts[4] = siteType
        }
        return parts.join(',')
      })
      fs.writeFileSync('users.csv', updated.join('\n'))
    } else {
      const newRow = `${user.id},${user.username || ''},${user.first_name || ''},${new Date().toISOString()},${siteType}\n`
      fs.appendFileSync('users.csv', newRow)
    }
  } catch (e) {
    console.error('Foydalanuvchini saqlashda xatolik:', e)
  }
}

const getTodayUsers = () => {
  const today = new Date().toISOString().split('T')[0]
  return getUsers().filter(u => u.date.startsWith(today))
}

let sessions = {}
try {
  sessions = JSON.parse(fs.readFileSync('admins.json', 'utf8'))
} catch (e) {
  sessions = {}
}
const isAdmin = (userId) => sessions[userId] === true

const adminState = {}

const sendStartMessages = async (userId, siteType) => {
  try {
    const allMessages = readStartMessages()
    const messages = allMessages[siteType] || []

    for (const msg of messages) {
      await new Promise(resolve => setTimeout(resolve, msg.delay * 1000))

      const inlineKeyboard = msg.btn_text && msg.btn_url
        ? { reply_markup: { inline_keyboard: [[{ text: msg.btn_text, url: msg.btn_url }]] } }
        : {}

      try {
        if (msg.media_type === 'text') {
          await bot.telegram.sendMessage(userId, msg.text, inlineKeyboard)
        } else if (msg.media_type === 'photo') {
          await bot.telegram.sendPhoto(userId, msg.media_file_id, {
            caption: msg.text,
            ...inlineKeyboard
          })
        } else if (msg.media_type === 'video') {
          await bot.telegram.sendVideo(userId, msg.media_file_id, {
            caption: msg.text,
            ...inlineKeyboard
          })
        } else if (msg.media_type === 'video_note') {
          await bot.telegram.sendVideoNote(userId, msg.media_file_id, inlineKeyboard)
          if (msg.text) {
            await bot.telegram.sendMessage(userId, msg.text)
          }
        }
      } catch (error) {
        console.error(`Xabar yuborishda xatolik (${userId}):`, error.message)
      }
    }

    return messages.length
  } catch (e) {
    console.error('sendStartMessages umumiy xato:', e)
    return 0
  }
}

const generateExcel = (siteType = null) => {
  try {
    let users = getUsers()
    if (siteType) {
      users = users.filter(u => u.siteType === siteType)
    }

    const todayUsers = getTodayUsers().filter(u => !siteType || u.siteType === siteType)

    let csv = 'User ID,Username,Ism,Site turi,Qo\'shilgan sana\n'
    users.forEach(u => {
      csv += `${u.id},${u.username || 'Yo\'q'},${u.name || 'Yo\'q'},${u.siteType},${new Date(u.date).toLocaleString('uz-UZ')}\n`
    })

    csv += `\n\nSTATISTIKA\n`
    csv += `Sayt turi,${siteType || 'Barcha'}\n`
    csv += `Jami foydalanuvchilar,${users.length}\n`
    csv += `Bugun qo'shilganlar,${todayUsers.length}\n`
    csv += `Hisobot sanasi,${new Date().toLocaleString('uz-UZ')}\n`

    const filename = `users_${siteType || 'all'}_${Date.now()}.csv`
    fs.writeFileSync(filename, csv)
    return filename
  } catch (e) {
    console.error('Excel yaratishda xatolik:', e)
    return null
  }
}

const adminKeyboard = () => Markup.keyboard([
  ['➕ Site1 xabar', '📋 Site1 xabarlar'],
  ['➕ Site2 xabar', '📋 Site2 xabarlar'],
  ['➕ Oddiy start xabar', '📋 Oddiy start xabarlar'],
  ['📢 Hammaga xabar', '📊 Statistika'],
  ['👥 Barcha userlar', '📥 Excel yuklab olish']
]).resize()

// ===== /start =====
bot.start(async (ctx) => {
  try {
    const args = ctx.message.text.split(' ')
    let siteType = 'default'

    if (args.length > 1) {
      if (args[1].includes('site1')) siteType = 'site1'
      else if (args[1].includes('site2')) siteType = 'site2'
    }

    saveUser(ctx.from, siteType)
    const sentCount = await sendStartMessages(ctx.from.id, siteType)

    if (sentCount === 0) {
      await ctx.reply('Botimizga xush kelibsiz!')
    }
  } catch (e) {
    console.error('/start xatosi:', e)
  }
})

// ===== Admin login / logout =====
bot.command('login', ctx => {
  adminState[ctx.from.id] = { step: 'login' }
  ctx.reply('👤 Login kiriting:')
})

bot.command('logout', ctx => {
  try {
    sessions[ctx.from.id] = false
    fs.writeFileSync('admins.json', JSON.stringify(sessions))
    ctx.reply('👋 Tizimdan chiqdingiz')
  } catch (e) {
    console.error('Logout xatosi:', e)
  }
})

bot.command('admin', ctx => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('⛔️ Sizda admin huquqi yo\'q')
  adminState[ctx.from.id] = { step: 'menu' }
  ctx.reply('🛠 Admin panel', adminKeyboard())
})

// ===== Admin menyu tugmalari =====
bot.hears('➕ Site1 xabar', ctx => startAddMessage(ctx, 'site1'))
bot.hears('➕ Site2 xabar', ctx => startAddMessage(ctx, 'site2'))
bot.hears('➕ Oddiy start xabar', ctx => startAddMessage(ctx, 'default'))

bot.hears('📋 Site1 xabarlar', ctx => showMessagesList(ctx, 'site1'))
bot.hears('📋 Site2 xabarlar', ctx => showMessagesList(ctx, 'site2'))
bot.hears('📋 Oddiy start xabarlar', ctx => showMessagesList(ctx, 'default'))

bot.hears('📊 Statistika', async ctx => {
  if (!isAdmin(ctx.from.id)) return

  try {
    const users = getUsers()
    const today = getTodayUsers()
    const msgs = readStartMessages()

    const site1Users = users.filter(u => u.siteType === 'site1')
    const site2Users = users.filter(u => u.siteType === 'site2')
    const defaultUsers = users.filter(u => u.siteType === 'default')

    const text = `📊 Bot statistikasi\n\n` +
      `👥 Jami: ${users.length}\n` +
      `📅 Bugun: ${today.length}\n\n` +
      `🌐 Site1: ${site1Users.length} (xabarlar: ${msgs.site1.length})\n` +
      `🌐 Site2: ${site2Users.length} (xabarlar: ${msgs.site2.length})\n` +
      `🟢 Oddiy start: ${defaultUsers.length} (xabarlar: ${msgs.default.length})\n` +
      `⏰ ${new Date().toLocaleString('uz-UZ')}`

    await ctx.reply(text)
  } catch (e) {
    console.error('Statistika xatosi:', e)
    await ctx.reply('Xatolik yuz berdi')
  }
})

bot.hears('👥 Barcha userlar', ctx => {
  if (!isAdmin(ctx.from.id)) return
  try {
    const users = getUsers()
    const counts = {
      site1: users.filter(u => u.siteType === 'site1').length,
      site2: users.filter(u => u.siteType === 'site2').length,
      default: users.filter(u => u.siteType === 'default').length,
      unknown: users.filter(u => u.siteType === 'unknown').length
    }
    ctx.reply(
      `👥 Jami: ${users.length}\n` +
      `🌐 Site1: ${counts.site1}\n` +
      `🌐 Site2: ${counts.site2}\n` +
      `🟢 Oddiy start: ${counts.default}\n` +
      `❓ Noma'lum: ${counts.unknown}\n` +
      `📅 Bugun: ${getTodayUsers().length}`
    )
  } catch (e) {
    console.error('Userlar ro\'yxati xatosi:', e)
    ctx.reply('Xatolik yuz berdi')
  }
})

bot.hears('📥 Excel yuklab olish', ctx => {
  if (!isAdmin(ctx.from.id)) return
  adminState[ctx.from.id] = { step: 'excel_choice' }
  ctx.reply('📊 Qaysi guruh uchun Excel?', Markup.keyboard([
    ['📊 Barcha userlar', '🌐 Site1 userlar'],
    ['🌐 Site2 userlar', '🟢 Oddiy start userlar'],
    ['⬅️ Orqaga']
  ]).resize())
})

// ===== Xabar qo'shish boshlanishi =====
function startAddMessage(ctx, site) {
  if (!isAdmin(ctx.from.id)) return
  adminState[ctx.from.id] = { step: 'wait_media', site }
  ctx.reply(
    `📨 ${site === 'default' ? 'Oddiy start' : site.toUpperCase()} uchun media yuboring (rasm, video, video note) yoki "o'tkazib yuborish" uchun /skip yozing.`,
    Markup.keyboard([['/skip']]).resize()
  )
}

// ===== Xabarlar ro'yxatini ko'rsatish =====
async function showMessagesList(ctx, site) {
  if (!isAdmin(ctx.from.id)) return

  try {
    const all = readStartMessages()
    const list = all[site] || []

    if (!list.length) {
      return ctx.reply(`❌ ${site === 'default' ? 'Oddiy start' : site.toUpperCase()} uchun start xabarlari yo'q`)
    }

    for (const msg of list) {
      try {
        if (msg.media_type === 'text') {
          await ctx.reply(`📝 Matn: ${msg.text}`)
        } else {
          let caption = msg.text ? `📝 ${msg.text}` : ''
          if (msg.media_type === 'photo') {
            await ctx.replyWithPhoto(msg.media_file_id, { caption })
          } else if (msg.media_type === 'video') {
            await ctx.replyWithVideo(msg.media_file_id, { caption })
          } else if (msg.media_type === 'video_note') {
            await ctx.replyWithVideoNote(msg.media_file_id)
            if (msg.text) await ctx.reply(`📝 Matn: ${msg.text}`)
          }
        }
      } catch (e) {
        await ctx.reply(`⚠️ Xabarni ko'rsatib bo'lmadi: ${e.message}`)
      }

      await ctx.reply(
        `🆔 ID: ${msg.id}\n` +
        `📦 Turi: ${msg.media_type}\n` +
        `⏱ Kechikish: ${msg.delay} sek\n` +
        `🔘 Tugma: ${msg.btn_text ? msg.btn_text + ' → ' + msg.btn_url : 'Yo\'q'}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Matn', `edit_text_${site}_${msg.id}`),
           Markup.button.callback('🖼 Media', `edit_media_${site}_${msg.id}`)],
          [Markup.button.callback('🔘 Tugma matni', `edit_btn_text_${site}_${msg.id}`),
           Markup.button.callback('🔗 Tugma link', `edit_btn_url_${site}_${msg.id}`)],
          [Markup.button.callback('⏱ Kechikish', `edit_delay_${site}_${msg.id}`),
           Markup.button.callback('❌ Tugmani o\'chirish', `delete_btn_${site}_${msg.id}`)],
          [Markup.button.callback('🗑 Xabarni o\'chirish', `delete_msg_${site}_${msg.id}`)]
        ])
      )
    }
  } catch (e) {
    console.error('Xabarlar ro\'yxatini ko\'rsatishda xato:', e)
    ctx.reply('Xatolik yuz berdi')
  }
}

// ===== Callback query lar =====
bot.on('callback_query', async ctx => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q')

  try {
    const data = ctx.callbackQuery.data
    const parts = data.split('_')

    const id = parts.pop()
    const site = parts.pop()
    const action = parts.join('_')

    const all = readStartMessages()
    const messages = all[site] || []
    const msg = messages.find(m => m.id === id)

    if (!msg) {
      await ctx.answerCbQuery('Xabar topilmadi')
      return
    }

    if (action === 'delete_msg') {
      all[site] = messages.filter(m => m.id !== id)
      writeStartMessages(all)
      await ctx.answerCbQuery('Xabar o\'chirildi')
      await ctx.deleteMessage()
      return
    }

    if (action === 'delete_btn') {
      msg.btn_text = ''
      msg.btn_url = ''
      writeStartMessages(all)
      await ctx.answerCbQuery('Inline tugma olib tashlandi')
      return
    }

    if (action.startsWith('edit_')) {
      const field = action.replace('edit_', '')
      adminState[ctx.from.id] = { step: `edit_${field}`, site, id }
      const prompts = {
        text: '✏️ Yangi matn yuboring:',
        media: '🖼 Yangi media yuboring (rasm/video/video note):',
        btn_text: '🔘 Tugma matnini kiriting:',
        btn_url: '🔗 Tugma linkini kiriting:',
        delay: '⏱ Yangi kechikish (sekund, masalan 0.5):'
      }
      await ctx.reply(prompts[field])
      await ctx.answerCbQuery()
      return
    }

    await ctx.answerCbQuery('Amal bajarilmadi')
  } catch (e) {
    console.error('Callback xatosi:', e)
    await ctx.answerCbQuery('Xatolik yuz berdi')
  }
})

// ===== Admin matnli xabarlarni qabul qilish (global) =====
bot.on('message', async ctx => {
  const userId = ctx.from.id
  const state = adminState[userId]
  const msgText = ctx.message.text

  // --- Maxsus: "📢 Hammaga xabar" tugmasi bosilganda (state'dan qat'iy nazar ishlasin) ---
  if (msgText === '📢 Hammaga xabar' && isAdmin(userId)) {
    adminState[userId] = { step: 'broadcast_target' }
    return ctx.reply('👥 Qaysi guruhga xabar yuboramiz?', Markup.keyboard([
      ['🌐 Site1 foydalanuvchilar', '🌐 Site2 foydalanuvchilar'],
      ['🟢 Oddiy start foydalanuvchilar', '👥 Barcha foydalanuvchilar'],
      ['⬅️ Orqaga']
    ]).resize())
  }

  // Login jarayoni
  if (state?.step === 'login') {
    adminState[userId] = { step: 'password', login: msgText }
    return ctx.reply('🔐 Parol:')
  }

  if (state?.step === 'password') {
    if (state.login === ADMIN_LOGIN && msgText === ADMIN_PASSWORD) {
      sessions[userId] = true
      try {
        fs.writeFileSync('admins.json', JSON.stringify(sessions))
      } catch (e) {}
      delete adminState[userId]
      return ctx.reply('✅ Xush kelibsiz, admin!', adminKeyboard())
    }
    delete adminState[userId]
    return ctx.reply('❌ Noto\'g\'ri login yoki parol')
  }

  if (!isAdmin(userId)) return

  // Excel tanlovi
  if (state?.step === 'excel_choice') {
    const text = msgText
    let site = null

    if (text === '📊 Barcha userlar') site = null
    else if (text === '🌐 Site1 userlar') site = 'site1'
    else if (text === '🌐 Site2 userlar') site = 'site2'
    else if (text === '🟢 Oddiy start userlar') site = 'default'
    else if (text === '⬅️ Orqaga') {
      delete adminState[userId]
      return ctx.reply('🛠 Admin panel', adminKeyboard())
    } else {
      return ctx.reply('❌ Noto\'g\'ri tanlov')
    }

    try {
      const filename = generateExcel(site)
      if (filename) {
        await ctx.replyWithDocument({ source: filename, filename: `users_${site || 'all'}.csv` })
        fs.unlinkSync(filename)
      } else {
        await ctx.reply('❌ Excel yaratishda xatolik')
      }
    } catch (e) {
      console.error('Excel yuborishda xato:', e)
      await ctx.reply('❌ Xatolik yuz berdi')
    }
    delete adminState[userId]
    return ctx.reply('✅ Tayyor!', adminKeyboard())
  }

  // Xabar qo'shish - media yoki /skip
  if (state?.step === 'wait_media') {
    const site = state.site

    if (msgText === '/skip') {
      adminState[userId] = { step: 'wait_text', site, media_type: 'text' }
      return ctx.reply('📝 Endi matnni yuboring:')
    }

    let media_type = null
    let file_id = null
    if (ctx.message.photo) {
      media_type = 'photo'
      file_id = ctx.message.photo[ctx.message.photo.length - 1].file_id
    } else if (ctx.message.video) {
      media_type = 'video'
      file_id = ctx.message.video.file_id
    } else if (ctx.message.video_note) {
      media_type = 'video_note'
      file_id = ctx.message.video_note.file_id
    } else {
      return ctx.reply('❌ Iltimos rasm, video yoki video note yuboring, yoki /skip')
    }

    adminState[userId] = {
      step: 'wait_text',
      site,
      media_type,
      media_file_id: file_id
    }
    return ctx.reply('📝 Endi media uchun matn (caption) yuboring (bo\'sh qoldirish mumkin):', Markup.keyboard([['/skip']]).resize())
  }

  // Matn kiritish
  if (state?.step === 'wait_text') {
    const text = msgText === '/skip' ? '' : msgText
    adminState[userId] = { ...state, text, step: 'wait_button' }
    return ctx.reply('🔘 Inline tugma qo\'shilsinmi?', Markup.keyboard([['Ha'], ['Yo\'q']]).resize())
  }

  // Tugma so'rash
  if (state?.step === 'wait_button') {
    if (msgText === 'Ha') {
      adminState[userId] = { ...state, step: 'wait_btn_text' }
      return ctx.reply('🔤 Tugma matni:')
    } else {
      adminState[userId] = { ...state, btn_text: '', btn_url: '', step: 'wait_delay' }
      return ctx.reply('⏱ Kechikish (sekund, masalan 0.1):')
    }
  }

  if (state?.step === 'wait_btn_text') {
    adminState[userId] = { ...state, btn_text: msgText, step: 'wait_btn_url' }
    return ctx.reply('🔗 Tugma linki:')
  }

  if (state?.step === 'wait_btn_url') {
    adminState[userId] = { ...state, btn_url: msgText, step: 'wait_delay' }
    return ctx.reply('⏱ Kechikish (sekund, masalan 0.1):')
  }

  if (state?.step === 'wait_delay') {
    const delay = parseFloat(msgText)
    if (isNaN(delay)) return ctx.reply('❌ Raqam kiriting (masalan 0.5)')

    const all = readStartMessages()
    if (!state.site) {
      delete adminState[userId]
      return ctx.reply('❌ Xatolik: sayt turi aniqlanmadi. Qaytadan urinib ko\'ring.')
    }

    const newMsg = {
      id: String(Date.now()),
      media_type: state.media_type || 'text',
      media_file_id: state.media_file_id || '',
      text: state.text || '',
      delay,
      btn_text: state.btn_text || '',
      btn_url: state.btn_url || ''
    }

    if (!all[state.site]) all[state.site] = []
    all[state.site].push(newMsg)
    writeStartMessages(all)

    const siteName = state.site === 'default' ? 'Oddiy start' : state.site.toUpperCase()
    delete adminState[userId]
    return ctx.reply(`✅ ${siteName} uchun start xabar qo'shildi!`, adminKeyboard())
  }

  // Tahrirlash jarayonlari
  if (state?.step?.startsWith('edit_')) {
    const field = state.step.replace('edit_', '')
    const all = readStartMessages()
    const messages = all[state.site]
    const msg = messages.find(m => m.id === state.id)
    if (!msg) {
      delete adminState[userId]
      return ctx.reply('Xabar topilmadi')
    }

    try {
      if (field === 'text') {
        msg.text = msgText
      } else if (field === 'media') {
        if (ctx.message.photo) {
          msg.media_type = 'photo'
          msg.media_file_id = ctx.message.photo[ctx.message.photo.length - 1].file_id
        } else if (ctx.message.video) {
          msg.media_type = 'video'
          msg.media_file_id = ctx.message.video.file_id
        } else if (ctx.message.video_note) {
          msg.media_type = 'video_note'
          msg.media_file_id = ctx.message.video_note.file_id
        } else {
          return ctx.reply('❌ Rasm, video yoki video note yuboring')
        }
      } else if (field === 'btn_text') {
        msg.btn_text = msgText
      } else if (field === 'btn_url') {
        msg.btn_url = msgText
      } else if (field === 'delay') {
        const delay = parseFloat(msgText)
        if (isNaN(delay)) return ctx.reply('❌ Raqam kiriting (masalan 0.5)')
        msg.delay = delay
      }

      writeStartMessages(all)
      delete adminState[userId]
      return ctx.reply('✅ O\'zgartirildi', adminKeyboard())
    } catch (e) {
      console.error('Tahrirlashda xato:', e)
      delete adminState[userId]
      return ctx.reply('❌ Xatolik yuz berdi', adminKeyboard())
    }
  }

  // Ommaviy xabar yuborish - guruh tanlash
  if (state?.step === 'broadcast_target') {
    const text = msgText
    let target = null
    if (text === '🌐 Site1 foydalanuvchilar') target = 'site1'
    else if (text === '🌐 Site2 foydalanuvchilar') target = 'site2'
    else if (text === '🟢 Oddiy start foydalanuvchilar') target = 'default'
    else if (text === '👥 Barcha foydalanuvchilar') target = 'all'
    else if (text === '⬅️ Orqaga') {
      delete adminState[userId]
      return ctx.reply('🛠 Admin panel', adminKeyboard())
    } else {
      return ctx.reply('Iltimos, quyidagi variantlardan birini tanlang:', Markup.keyboard([
        ['🌐 Site1 foydalanuvchilar', '🌐 Site2 foydalanuvchilar'],
        ['🟢 Oddiy start foydalanuvchilar', '👥 Barcha foydalanuvchilar'],
        ['⬅️ Orqaga']
      ]).resize())
    }

    adminState[userId] = { step: 'broadcast_send', target }
    return ctx.reply('📨 Yuboriladigan xabarni yuboring (matn, rasm, video, hujjat va h.k.):')
  }

  // Ommaviy xabarni yuborish
  if (state?.step === 'broadcast_send') {
    try {
      let users = getUsers()
      if (state.target !== 'all') {
        users = users.filter(u => u.siteType === state.target)
      }
      if (!users.length) {
        delete adminState[userId]
        return ctx.reply('❌ Tanlangan guruhda foydalanuvchi topilmadi', adminKeyboard())
      }

      const statusMsg = await ctx.reply(`📤 Yuborilmoqda... 0/${users.length}`)
      let success = 0, failed = 0

      for (const u of users) {
        try {
          await ctx.telegram.copyMessage(u.id, ctx.chat.id, ctx.message.message_id)
          success++
        } catch (error) {
          console.error(`Xabar yuborilmadi (${u.id}):`, error.message)
          failed++
        }

        if ((success + failed) % 10 === 0) {
          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id, statusMsg.message_id, null,
              `📤 Yuborilmoqda... ${success + failed}/${users.length}`
            )
          } catch (e) {}
        }
        await new Promise(r => setTimeout(r, 50))
      }

      await ctx.telegram.editMessageText(
        ctx.chat.id, statusMsg.message_id, null,
        `✅ Yakunlandi!\n✅ Muvaffaqiyatli: ${success}\n❌ Xatolik: ${failed}`
      )
    } catch (e) {
      console.error('Ommaviy yuborishda xato:', e)
      await ctx.reply('❌ Xatolik yuz berdi')
    }
    delete adminState[userId]
    return ctx.reply('Bajarildi', adminKeyboard())
  }

  // Agar yuqoridagi hech bir shart bajarilmasa va state mavjud bo'lmasa yoki noma'lum bo'lsa, hech narsa qilmaslik
})

// ===== Ishga tushirish =====
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    console.log('🚀 BOT ISHLAYAPTI')
    console.log(`👤 Login: ${ADMIN_LOGIN}  🔐 Parol: ${ADMIN_PASSWORD}`)
    console.log('\n📌 Admin bo\'lish: /login')
    console.log('📌 Start turlari: /start , /start site1 , /start site2')
  })
  .catch(err => {
    console.error('Botni ishga tushirishda xato:', err)
  })

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))