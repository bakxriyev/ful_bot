import { Telegraf, Markup } from 'telegraf'
import fs from 'fs'

const BOT_TOKEN = '8470849940:AAEWyqzvLbVBDtaLL6gu2zQjCQ7c5UW9MJ8'
const ADMIN_ID = 848946736
const CHANNEL_ID = -1003354346113

// Admin login ma'lumotlari
const ADMIN_LOGIN = 'admin'
const ADMIN_PASSWORD = 'admin123'

const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 60_000 })

// ===== FILE INIT =====
if (!fs.existsSync('users.csv'))
  fs.writeFileSync('users.csv', 'user_id,username,first_name,date\n')

if (!fs.existsSync('start_messages.csv'))
  fs.writeFileSync(
    'start_messages.csv',
    'id,chat_id,message_id,delay,btn_text,btn_url\n'
  )

if (!fs.existsSync('admins.json'))
  fs.writeFileSync('admins.json', JSON.stringify({}))

const admin = {}
const sessions = JSON.parse(fs.readFileSync('admins.json', 'utf8'))

// ===== HELPERS =====
const getUsers = () =>
  fs.readFileSync('users.csv', 'utf8')
    .split('\n').slice(1).filter(Boolean)
    .map(r => {
      const [id, username, name, date] = r.split(',')
      return { id, username, name, date }
    })

const getMessages = () =>
  fs.readFileSync('start_messages.csv', 'utf8')
    .split('\n').slice(1).filter(Boolean)
    .map(r => {
      const [id, chatId, msgId, delay, btnText, btnUrl] = r.split(',')
      return { id, chatId, msgId, delay, btnText, btnUrl }
    })

const saveUser = u => {
  const users = getUsers()
  if (users.find(user => user.id === String(u.id))) return
  
  fs.appendFileSync(
    'users.csv',
    `${u.id},${u.username || ''},${u.first_name || ''},${new Date().toISOString()}\n`
  )
}

const updateMessage = (id, field, value) => {
  let rows = getMessages()
  rows = rows.map(r => r.id === id ? { ...r, [field]: value } : r)
  fs.writeFileSync(
    'start_messages.csv',
    'id,chat_id,message_id,delay,btn_text,btn_url\n' +
    rows.map(r =>
      `${r.id},${r.chatId},${r.msgId},${r.delay},${r.btnText},${r.btnUrl}`
    ).join('\n') + '\n'
  )
}

const isAdmin = userId => sessions[userId] === true

const getTodayUsers = () => {
  const today = new Date().toISOString().split('T')[0]
  return getUsers().filter(u => u.date.startsWith(today))
}

const generateExcel = () => {
  const users = getUsers()
  const todayUsers = getTodayUsers()
  
  let csv = 'User ID,Username,Ism,Qo\'shilgan sana\n'
  users.forEach(u => {
    csv += `${u.id},${u.username || 'Yo\'q'},${u.name || 'Yo\'q'},${new Date(u.date).toLocaleString('uz-UZ')}\n`
  })
  
  csv += `\n\nSTATISTIKA\n`
  csv += `Jami foydalanuvchilar,${users.length}\n`
  csv += `Bugun qo'shilganlar,${todayUsers.length}\n`
  csv += `Hisobot sanasi,${new Date().toLocaleString('uz-UZ')}\n`
  
  const filename = `users_${Date.now()}.csv`
  fs.writeFileSync(filename, csv)
  return filename
}

// ===== USER START =====
bot.start(ctx => {
  saveUser(ctx.from)
  const userId = ctx.from.id

  getMessages().forEach(m => {
    setTimeout(() => {
      bot.telegram.copyMessage(
        userId,
        m.chatId,
        m.msgId,
        m.btnText ? {
          reply_markup: {
            inline_keyboard: [[{ text: m.btnText, url: m.btnUrl }]]
          }
        } : {}
      ).catch(() => {})
    }, Number(m.delay) * 1000)
  })
})

// ===== ADMIN LOGIN =====
bot.command('login', ctx => {
  admin[ctx.from.id] = { step: 'login' }
  ctx.reply('👤 Login kiriting:')
})

bot.command('logout', ctx => {
  sessions[ctx.from.id] = false
  fs.writeFileSync('admins.json', JSON.stringify(sessions))
  ctx.reply('👋 Tizimdan chiqdingiz')
})

// ===== ADMIN MENU =====
bot.command('admin', ctx => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('⛔️ Sizda admin huquqi yo\'q')
  
  admin[ctx.from.id] = { step: 'menu' }
  ctx.reply(
    '🛠 Admin panel',
    Markup.keyboard([
      ['➕ Start xabar qoshish', '📋 Start xabarlar'],
      ['📢 Hammaga xabar', '📊 Statistika'],
      ['👥 Barcha userlar', '📥 Excel yuklab olish']
    ]).resize()
  )
})

// ===== ADD START MESSAGE =====
bot.hears('➕ Start xabar qoshish', ctx => {
  if (!isAdmin(ctx.from.id)) return
  admin[ctx.from.id] = { step: 'wait_message' }
  ctx.reply('📨 Video yoki text yuboring')
})

// ===== VIEW / MANAGE START MESSAGES =====
bot.hears('📋 Start xabarlar', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const list = getMessages()
  if (!list.length) return ctx.reply('❌ Xabar yoq')

  for (const m of list) {
    // Xabarni o'zini ko'rsatish
    try {
      await bot.telegram.copyMessage(
        ctx.chat.id,
        m.chatId,
        m.msgId,
        m.btnText ? {
          reply_markup: {
            inline_keyboard: [[{ text: m.btnText, url: m.btnUrl }]]
          }
        } : {}
      )
    } catch (e) {}

    // Ma'lumotlar va boshqaruv tugmalari
    await ctx.reply(
      `🆔 ID: ${m.id}\n⏱ Kechikish: ${m.delay} sekund\n🔘 Inline: ${m.btnText ? 'Bor (' + m.btnText + ')' : 'Yo\'q'}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✏️ Matnni tahrirlash', `edit_text_${m.id}`),
          Markup.button.callback('🔄 Videoni almashtirish', `edit_video_${m.id}`)
        ],
        [
          Markup.button.callback('🔘 Inline text', `edit_btn_text_${m.id}`),
          Markup.button.callback('🔗 Inline link', `edit_btn_url_${m.id}`)
        ],
        [
          Markup.button.callback('⏱ Kechikish', `edit_delay_${m.id}`),
          Markup.button.callback('❌ Inline o\'chirish', `inline_${m.id}`)
        ],
        [
          Markup.button.callback('🗑 O\'chirish', `del_${m.id}`)
        ]
      ])
    )
  }
})

// ===== STATISTIKA =====
bot.hears('📊 Statistika', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  
  const users = getUsers()
  const todayUsers = getTodayUsers()
  const startMessages = getMessages()
  
  const text = `📊 Bot Statistika\n\n` +
    `👥 Jami foydalanuvchilar: ${users.length}\n` +
    `📅 Bugun qo'shilganlar: ${todayUsers.length}\n` +
    `📨 Start xabarlar soni: ${startMessages.length}\n` +
    `⏰ Hozirgi vaqt: ${new Date().toLocaleString('uz-UZ')}`
  
  await ctx.reply(text)
  
  // Excel faylini yaratish va yuborish
  if (users.length > 0) {
    const filename = generateExcel()
    await ctx.replyWithDocument({ source: filename, filename: 'users_statistika.csv' })
    fs.unlinkSync(filename) // Faylni o'chirish
  }
})

// ===== BARCHA USERLAR (EXCEL) =====
bot.hears('👥 Barcha userlar', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  
  const users = getUsers()
  if (!users.length) return ctx.reply('❌ Foydalanuvchilar yo\'q')
  
  await ctx.reply('📊 Barcha foydalanuvchilar ma\'lumotlari:\n\n' +
    `👥 Jami: ${users.length} ta\n` +
    `📅 Bugun: ${getTodayUsers().length} ta`)
})

// ===== EXCEL YUKLAB OLISH =====
bot.hears('📥 Excel yuklab olish', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  
  const users = getUsers()
  if (!users.length) return ctx.reply('❌ Foydalanuvchilar yo\'q')
  
  const filename = generateExcel()
  await ctx.replyWithDocument({ 
    source: filename, 
    filename: `users_${new Date().toLocaleDateString('uz-UZ')}.csv` 
  })
  fs.unlinkSync(filename)
})

// ===== CALLBACKS =====
bot.on('callback_query', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const data = ctx.callbackQuery.data
  const id = data.split('_').pop()

  // O'chirish
  if (data.startsWith('del_')) {
    let rows = getMessages().filter(r => r.id !== id)
    fs.writeFileSync(
      'start_messages.csv',
      'id,chat_id,message_id,delay,btn_text,btn_url\n' +
      rows.map(r =>
        `${r.id},${r.chatId},${r.msgId},${r.delay},${r.btnText},${r.btnUrl}`
      ).join('\n') + '\n'
    )
    return ctx.answerCbQuery('🗑 Ochirildi')
  }

  // Inline o'chirish
  if (data.startsWith('inline_')) {
    updateMessage(id, 'btnText', '')
    updateMessage(id, 'btnUrl', '')
    return ctx.answerCbQuery('❌ Inline olib tashlandi')
  }

  // Tahrirlash buyruqlari
  if (data.startsWith('edit_text_')) {
    admin[ctx.from.id] = { step: 'edit_text', editId: id }
    return ctx.reply('✏️ Yangi matnni yuboring:')
  }

  if (data.startsWith('edit_video_')) {
    admin[ctx.from.id] = { step: 'edit_video', editId: id }
    return ctx.reply('🔄 Yangi video yuboring:')
  }

  if (data.startsWith('edit_btn_text_')) {
    admin[ctx.from.id] = { step: 'edit_btn_text', editId: id }
    return ctx.reply('🔘 Yangi tugma nomini kiriting:')
  }

  if (data.startsWith('edit_btn_url_')) {
    admin[ctx.from.id] = { step: 'edit_btn_url', editId: id }
    return ctx.reply('🔗 Yangi linkni kiriting:')
  }

  if (data.startsWith('edit_delay_')) {
    admin[ctx.from.id] = { step: 'edit_delay', editId: id }
    return ctx.reply('⏱ Yangi kechikishni kiriting (sekund):')
  }
})

// ===== MASS MESSAGE =====
bot.hears('📢 Hammaga xabar', ctx => {
  if (!isAdmin(ctx.from.id)) return
  admin[ctx.from.id] = { step: 'broadcast' }
  ctx.reply('📨 Hammaga yuboriladigan xabarni jonating')
})

bot.on('message', async ctx => {
  const userId = ctx.from.id
  const userAdmin = admin[userId] || {}

  // LOGIN FLOW
  if (userAdmin.step === 'login') {
    admin[userId] = { step: 'password', login: ctx.message.text }
    return ctx.reply('🔐 Parol kiriting:')
  }

  if (userAdmin.step === 'password') {
    if (userAdmin.login === ADMIN_LOGIN && ctx.message.text === ADMIN_PASSWORD) {
      sessions[userId] = true
      fs.writeFileSync('admins.json', JSON.stringify(sessions))
      admin[userId] = { step: 'menu' }
      return ctx.reply(
        '✅ Muvaffaqiyatli kirdingiz!\n\nBuyruqlar:\n/admin - Admin panel',
        Markup.keyboard([
          ['➕ Start xabar qoshish', '📋 Start xabarlar'],
          ['📢 Hammaga xabar', '📊 Statistika'],
          ['👥 Barcha userlar', '📥 Excel yuklab olish']
        ]).resize()
      )
    }
    delete admin[userId]
    return ctx.reply('❌ Login yoki parol noto\'g\'ri')
  }

  if (!isAdmin(userId)) return

  // EDIT TEXT
  if (userAdmin.step === 'edit_text') {
    if (!ctx.message.text) return ctx.reply('❌ Faqat matn yuboring')
    
    const sent = await bot.telegram.copyMessage(
      CHANNEL_ID,
      ctx.chat.id,
      ctx.message.message_id
    )
    
    updateMessage(userAdmin.editId, 'msgId', sent.message_id)
    delete admin[userId]
    return ctx.reply('✅ Matn yangilandi!')
  }

  // EDIT VIDEO
  if (userAdmin.step === 'edit_video') {
    if (!ctx.message.video && !ctx.message.photo) {
      return ctx.reply('❌ Video yoki rasm yuboring')
    }
    
    const sent = await bot.telegram.copyMessage(
      CHANNEL_ID,
      ctx.chat.id,
      ctx.message.message_id
    )
    
    updateMessage(userAdmin.editId, 'msgId', sent.message_id)
    delete admin[userId]
    return ctx.reply('✅ Media yangilandi!')
  }

  // EDIT BUTTON TEXT
  if (userAdmin.step === 'edit_btn_text') {
    updateMessage(userAdmin.editId, 'btnText', ctx.message.text)
    delete admin[userId]
    return ctx.reply('✅ Tugma nomi yangilandi!')
  }

  // EDIT BUTTON URL
  if (userAdmin.step === 'edit_btn_url') {
    updateMessage(userAdmin.editId, 'btnUrl', ctx.message.text)
    delete admin[userId]
    return ctx.reply('✅ Tugma linki yangilandi!')
  }

  // EDIT DELAY
  if (userAdmin.step === 'edit_delay') {
    const delay = Number(ctx.message.text)
    if (isNaN(delay)) return ctx.reply('❌ Raqam kiriting')
    
    updateMessage(userAdmin.editId, 'delay', delay)
    delete admin[userId]
    return ctx.reply('✅ Kechikish yangilandi!')
  }

  // ADD START MESSAGE FLOW
  if (userAdmin.step === 'wait_message') {
    const sent = await bot.telegram.copyMessage(
      CHANNEL_ID,
      ctx.chat.id,
      ctx.message.message_id
    )
    admin[userId] = { ...userAdmin, msgId: sent.message_id, step: 'ask_inline' }
    return ctx.reply(
      '🔘 Inline keyboard qoshilsinmi?',
      Markup.keyboard([['Ha'], ['Yoq']]).resize()
    )
  }

  if (userAdmin.step === 'ask_inline') {
    if (ctx.message.text === 'Ha') {
      admin[userId] = { ...userAdmin, step: 'btn_text' }
      return ctx.reply('🔤 Tugma nomi?')
    }
    admin[userId] = { ...userAdmin, step: 'delay' }
    return ctx.reply('⏱ Interval (sekund)?')
  }

  if (userAdmin.step === 'btn_text') {
    admin[userId] = { ...userAdmin, btnText: ctx.message.text, step: 'btn_url' }
    return ctx.reply('🔗 Tugma linki?')
  }

  if (userAdmin.step === 'btn_url') {
    admin[userId] = { ...userAdmin, btnUrl: ctx.message.text, step: 'delay' }
    return ctx.reply('⏱ Interval (sekund)?')
  }

  if (userAdmin.step === 'delay') {
    const delay = Number(ctx.message.text)
    if (isNaN(delay)) return ctx.reply('❌ Raqam kiriting')

    fs.appendFileSync(
      'start_messages.csv',
      `${Date.now()},${CHANNEL_ID},${userAdmin.msgId},${delay},${userAdmin.btnText || ''},${userAdmin.btnUrl || ''}\n`
    )

    admin[userId] = { step: 'menu' }
    return ctx.reply('✅ Start xabar saqlandi', 
      Markup.keyboard([
        ['➕ Start xabar qoshish', '📋 Start xabarlar'],
        ['📢 Hammaga xabar', '📊 Statistika'],
        ['👥 Barcha userlar', '📥 Excel yuklab olish']
      ]).resize()
    )
  }

  // BROADCAST
  if (userAdmin.step === 'broadcast') {
    const users = getUsers()
    let success = 0
    let failed = 0
    
    const statusMsg = await ctx.reply('📤 Yuborilmoqda...')
    
    for (const u of users) {
      const result = await bot.telegram.copyMessage(
        u.id,
        ctx.chat.id,
        ctx.message.message_id
      ).catch(() => null)
      
      if (result) success++
      else failed++
      
      if ((success + failed) % 10 === 0) {
        await bot.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          null,
          `📤 Yuborilmoqda...\n\n✅ Yuborildi: ${success}\n❌ Xatolik: ${failed}\n📊 Jami: ${users.length}`
        ).catch(() => {})
      }
    }
    
    admin[userId] = { step: 'menu' }
    await bot.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `✅ Xabar yuborish tugadi!\n\n📊 Statistika:\n✅ Muvaffaqiyatli: ${success}\n❌ Xatolik: ${failed}\n📊 Jami: ${users.length}`
    )
  }
})

// ===== START =====
bot.launch({ dropPendingUpdates: true })
console.log('🚀 BOT ISHLAYAPTI')
console.log('👤 Login: ' + ADMIN_LOGIN)
console.log('🔐 Parol: ' + ADMIN_PASSWORD)
console.log('\n📝 Admin bo\'lish uchun: /login')