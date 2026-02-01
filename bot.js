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
  fs.writeFileSync('users.csv', 'user_id,username,first_name,date,site_type\n')

if (!fs.existsSync('start_messages_site1.csv'))
  fs.writeFileSync(
    'start_messages_site1.csv',
    'id,chat_id,message_id,delay,btn_text,btn_url\n'
  )

if (!fs.existsSync('start_messages_site2.csv'))
  fs.writeFileSync(
    'start_messages_site2.csv',
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
      const [id, username, name, date, siteType] = r.split(',')
      return { id, username, name, date, siteType: siteType || 'unknown' }
    })

const getMessages = (site) => {
  const filename = `start_messages_${site}.csv`
  if (!fs.existsSync(filename)) return []
  
  return fs.readFileSync(filename, 'utf8')
    .split('\n').slice(1).filter(Boolean)
    .map(r => {
      const [id, chatId, msgId, delay, btnText, btnUrl] = r.split(',')
      return { id, chatId, msgId, delay, btnText, btnUrl, site }
    })
}

const saveUser = (u, siteType) => {
  const users = getUsers()
  const existingUser = users.find(user => user.id === String(u.id))
  
  if (existingUser) {
    // User bor, faqat site_type ni update qilamiz
    const rows = fs.readFileSync('users.csv', 'utf8').split('\n')
    const updatedRows = rows.map(row => {
      const parts = row.split(',')
      if (parts[0] === String(u.id)) {
        parts[4] = siteType
      }
      return parts.join(',')
    })
    fs.writeFileSync('users.csv', updatedRows.join('\n'))
  } else {
    // Yangi user
    fs.appendFileSync(
      'users.csv',
      `${u.id},${u.username || ''},${u.first_name || ''},${new Date().toISOString()},${siteType}\n`
    )
  }
  
  // Har safar user bor-yo'qligidan qat'i nazar, true qaytaramiz
  return true
}

const sendMessagesToUser = (userId, siteType) => {
  const messages = getMessages(siteType)
  
  // Agar site uchun xabar yo'q bo'lsa, boshqa site'lardan xabar olish
  if (messages.length === 0 && siteType !== 'unknown') {
    messages.push(...getMessages('site1'), ...getMessages('site2'))
  }
  
  // Barcha xabarlarni yuborish
  messages.forEach(m => {
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
      ).catch(err => {
        console.error('Xabar yuborishda xatolik:', err.message)
      })
    }, Number(m.delay) * 1000)
  })
  
  return messages.length
}

const updateMessage = (site, id, field, value) => {
  const filename = `start_messages_${site}.csv`
  let rows = getMessages(site)
  rows = rows.map(r => r.id === id ? { ...r, [field]: value } : r)
  fs.writeFileSync(
    filename,
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

const generateExcel = (site = null) => {
  let users = getUsers()
  if (site) {
    users = users.filter(u => u.siteType === site)
  }
  const todayUsers = getTodayUsers().filter(u => !site || u.siteType === site)
  
  let csv = 'User ID,Username,Ism,Site turi,Qo\'shilgan sana\n'
  users.forEach(u => {
    csv += `${u.id},${u.username || 'Yo\'q'},${u.name || 'Yo\'q'},${u.siteType || 'unknown'},${new Date(u.date).toLocaleString('uz-UZ')}\n`
  })
  
  csv += `\n\nSTATISTIKA\n`
  csv += `Site turi,${site || 'Barcha'}\n`
  csv += `Jami foydalanuvchilar,${users.length}\n`
  csv += `Bugun qo'shilganlar,${todayUsers.length}\n`
  csv += `Hisobot sanasi,${new Date().toLocaleString('uz-UZ')}\n`
  
  const filename = `users_${site || 'all'}_${Date.now()}.csv`
  fs.writeFileSync(filename, csv)
  return filename
}

// ===== USER START =====
bot.start(ctx => {
  const args = ctx.message.text.split(' ')
  let siteType = 'unknown'
  
  if (args.length > 1) {
    if (args[1].includes('site1')) siteType = 'site1'
    else if (args[1].includes('site2')) siteType = 'site2'
  }
  
  // Foydalanuvchini saqlash va xabarlarni yuborish
  saveUser(ctx.from, siteType)
  const messagesSent = sendMessagesToUser(ctx.from.id, siteType)
  
  if (messagesSent === 0) {
    ctx.reply('Botimizga xush kelibsiz!')
  }
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
    '🛠 Admin panel - Site tanlang',
    Markup.keyboard([
      ['➕ Site1 xabar qoshish', '📋 Site1 xabarlar'],
      ['➕ Site2 xabar qoshish', '📋 Site2 xabarlar'],
      ['📢 Hammaga xabar', '📊 Statistika'],
      ['👥 Barcha userlar', '📥 Excel yuklab olish']
    ]).resize()
  )
})

// ===== ADD START MESSAGE FOR SITE1 =====
bot.hears('➕ Site1 xabar qoshish', ctx => {
  if (!isAdmin(ctx.from.id)) return
  admin[ctx.from.id] = { step: 'wait_message', site: 'site1' }
  ctx.reply('📨 Site1 uchun video yoki text yuboring')
})

// ===== ADD START MESSAGE FOR SITE2 =====
bot.hears('➕ Site2 xabar qoshish', ctx => {
  if (!isAdmin(ctx.from.id)) return
  admin[ctx.from.id] = { step: 'wait_message', site: 'site2' }
  ctx.reply('📨 Site2 uchun video yoki text yuboring')
})

// ===== VIEW / MANAGE START MESSAGES FOR SITE1 =====
bot.hears('📋 Site1 xabarlar', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  await showMessagesList(ctx, 'site1')
})

// ===== VIEW / MANAGE START MESSAGES FOR SITE2 =====
bot.hears('📋 Site2 xabarlar', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  await showMessagesList(ctx, 'site2')
})

async function showMessagesList(ctx, site) {
  const list = getMessages(site)
  if (!list.length) return ctx.reply(`❌ ${site.toUpperCase()} uchun xabar yo'q`)

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
    } catch (e) {
      console.error('Xabarni ko\'rsatishda xatolik:', e.message)
    }

    // Ma'lumotlar va boshqaruv tugmalari
    await ctx.reply(
      `🏷 Site: ${site.toUpperCase()}\n🆔 ID: ${m.id}\n⏱ Kechikish: ${m.delay} sekund\n🔘 Inline: ${m.btnText ? 'Bor (' + m.btnText + ')' : 'Yo\'q'}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✏️ Matnni tahrirlash', `edit_text_${site}_${m.id}`),
          Markup.button.callback('🔄 Videoni almashtirish', `edit_video_${site}_${m.id}`)
        ],
        [
          Markup.button.callback('🔘 Inline text', `edit_btn_text_${site}_${m.id}`),
          Markup.button.callback('🔗 Inline link', `edit_btn_url_${site}_${m.id}`)
        ],
        [
          Markup.button.callback('⏱ Kechikish', `edit_delay_${site}_${m.id}`),
          Markup.button.callback('❌ Inline o\'chirish', `inline_${site}_${m.id}`)
        ],
        [
          Markup.button.callback('🗑 O\'chirish', `del_${site}_${m.id}`)
        ]
      ])
    )
  }
}

// ===== STATISTIKA =====
bot.hears('📊 Statistika', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  
  const users = getUsers()
  const todayUsers = getTodayUsers()
  const site1Users = users.filter(u => u.siteType === 'site1')
  const site2Users = users.filter(u => u.siteType === 'site2')
  const unknownUsers = users.filter(u => u.siteType === 'unknown')
  
  const site1Messages = getMessages('site1')
  const site2Messages = getMessages('site2')
  
  const text = `📊 Bot Statistika\n\n` +
    `👥 Jami foydalanuvchilar: ${users.length}\n` +
    `📅 Bugun qo'shilganlar: ${todayUsers.length}\n\n` +
    `🌐 SITE1\n` +
    `   👤 Foydalanuvchilar: ${site1Users.length}\n` +
    `   📨 Start xabarlar: ${site1Messages.length}\n\n` +
    `🌐 SITE2\n` +
    `   👤 Foydalanuvchilar: ${site2Users.length}\n` +
    `   📨 Start xabarlar: ${site2Messages.length}\n\n` +
    `❓ Noma'lum: ${unknownUsers.length}\n` +
    `⏰ Hozirgi vaqt: ${new Date().toLocaleString('uz-UZ')}`
  
  await ctx.reply(text)
})

// ===== BARCHA USERLAR =====
bot.hears('👥 Barcha userlar', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  
  const users = getUsers()
  if (!users.length) return ctx.reply('❌ Foydalanuvchilar yo\'q')
  
  const site1Count = users.filter(u => u.siteType === 'site1').length
  const site2Count = users.filter(u => u.siteType === 'site2').length
  const unknownCount = users.filter(u => u.siteType === 'unknown').length
  
  await ctx.reply('📊 Barcha foydalanuvchilar ma\'lumotlari:\n\n' +
    `👥 Jami: ${users.length} ta\n` +
    `🌐 Site1: ${site1Count} ta\n` +
    `🌐 Site2: ${site2Count} ta\n` +
    `❓ Noma'lum: ${unknownCount} ta\n` +
    `📅 Bugun: ${getTodayUsers().length} ta`)
})

// ===== EXCEL YUKLAB OLISH =====
bot.hears('📥 Excel yuklab olish', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  
  const users = getUsers()
  if (!users.length) return ctx.reply('❌ Foydalanuvchilar yo\'q')
  
  await ctx.reply(
    '📊 Excel yuklab olish',
    Markup.keyboard([
      ['📊 Barcha userlar', '🌐 Site1 userlar'],
      ['🌐 Site2 userlar', '⬅️ Orqaga']
    ]).resize()
  )
  admin[ctx.from.id] = { step: 'excel_choice' }
})

// ===== CALLBACKS =====
bot.on('callback_query', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const data = ctx.callbackQuery.data
  
  // O'chirish
  if (data.startsWith('del_')) {
    const [_, site, id] = data.split('_')
    let rows = getMessages(site).filter(r => r.id !== id)
    const filename = `start_messages_${site}.csv`
    fs.writeFileSync(
      filename,
      'id,chat_id,message_id,delay,btn_text,btn_url\n' +
      rows.map(r =>
        `${r.id},${r.chatId},${r.msgId},${r.delay},${r.btnText},${r.btnUrl}`
      ).join('\n') + '\n'
    )
    await ctx.answerCbQuery(`🗑 ${site.toUpperCase()} uchun xabar o'chirildi`)
    await ctx.deleteMessage()
    return
  }

  // Inline o'chirish
  if (data.startsWith('inline_')) {
    const [_, site, id] = data.split('_')
    updateMessage(site, id, 'btnText', '')
    updateMessage(site, id, 'btnUrl', '')
    return ctx.answerCbQuery('❌ Inline olib tashlandi')
  }

  // Tahrirlash buyruqlari
  const editActions = ['edit_text', 'edit_video', 'edit_btn_text', 'edit_btn_url', 'edit_delay']
  for (const action of editActions) {
    if (data.startsWith(`${action}_`)) {
      const [_, site, id] = data.split('_')
      admin[ctx.from.id] = { step: action, editId: id, editSite: site }
      const messages = {
        'edit_text': '✏️ Yangi matnni yuboring:',
        'edit_video': '🔄 Yangi video yuboring:',
        'edit_btn_text': '🔘 Yangi tugma nomini kiriting:',
        'edit_btn_url': '🔗 Yangi linkni kiriting:',
        'edit_delay': '⏱ Yangi kechikishni kiriting (sekund):'
      }
      return ctx.reply(messages[action])
    }
  }
})

// ===== MASS MESSAGE =====
bot.hears('📢 Hammaga xabar', ctx => {
  if (!isAdmin(ctx.from.id)) return
  admin[ctx.from.id] = { step: 'broadcast' }
  ctx.reply(
    '📨 Hammaga yuboriladigan xabarni jonating',
    Markup.keyboard([
      ['🌐 Site1 foydalanuvchilar', '🌐 Site2 foydalanuvchilar'],
      ['👥 Barcha foydalanuvchilar', '⬅️ Orqaga']
    ]).resize()
  )
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
          ['➕ Site1 xabar qoshish', '📋 Site1 xabarlar'],
          ['➕ Site2 xabar qoshish', '📋 Site2 xabarlar'],
          ['📢 Hammaga xabar', '📊 Statistika'],
          ['👥 Barcha userlar', '📥 Excel yuklab olish']
        ]).resize()
      )
    }
    delete admin[userId]
    return ctx.reply('❌ Login yoki parol noto\'g\'ri')
  }

  if (!isAdmin(userId)) return

  // EXCEL CHOICE
  if (userAdmin.step === 'excel_choice') {
    let site = null
    let text = ''
    
    if (ctx.message.text === '📊 Barcha userlar') {
      text = '📊 Barcha foydalanuvchilar statistikasi'
    } else if (ctx.message.text === '🌐 Site1 userlar') {
      site = 'site1'
      text = '🌐 Site1 foydalanuvchilar statistikasi'
    } else if (ctx.message.text === '🌐 Site2 userlar') {
      site = 'site2'
      text = '🌐 Site2 foydalanuvchilar statistikasi'
    } else if (ctx.message.text === '⬅️ Orqaga') {
      admin[userId] = { step: 'menu' }
      return ctx.reply(
        '🛠 Admin panel',
        Markup.keyboard([
          ['➕ Site1 xabar qoshish', '📋 Site1 xabarlar'],
          ['➕ Site2 xabar qoshish', '📋 Site2 xabarlar'],
          ['📢 Hammaga xabar', '📊 Statistika'],
          ['👥 Barcha userlar', '📥 Excel yuklab olish']
        ]).resize()
      )
    } else {
      return ctx.reply('❌ Noto\'g\'ri tanlov')
    }
    
    const filename = generateExcel(site)
    await ctx.replyWithDocument({ 
      source: filename, 
      filename: `users_${site || 'all'}_${new Date().toLocaleDateString('uz-UZ')}.csv` 
    })
    fs.unlinkSync(filename)
    
    admin[userId] = { step: 'menu' }
    return ctx.reply(
      '🛠 Admin panel',
      Markup.keyboard([
        ['➕ Site1 xabar qoshish', '📋 Site1 xabarlar'],
        ['➕ Site2 xabar qoshish', '📋 Site2 xabarlar'],
        ['📢 Hammaga xabar', '📊 Statistika'],
        ['👥 Barcha userlar', '📥 Excel yuklab olish']
      ]).resize()
    )
  }

  // EDIT TEXT
  if (userAdmin.step === 'edit_text') {
    if (!ctx.message.text) return ctx.reply('❌ Faqat matn yuboring')
    
    const sent = await bot.telegram.copyMessage(
      CHANNEL_ID,
      ctx.chat.id,
      ctx.message.message_id
    )
    
    updateMessage(userAdmin.editSite, userAdmin.editId, 'msgId', sent.message_id)
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
    
    updateMessage(userAdmin.editSite, userAdmin.editId, 'msgId', sent.message_id)
    delete admin[userId]
    return ctx.reply('✅ Media yangilandi!')
  }

  // EDIT BUTTON TEXT
  if (userAdmin.step === 'edit_btn_text') {
    updateMessage(userAdmin.editSite, userAdmin.editId, 'btnText', ctx.message.text)
    delete admin[userId]
    return ctx.reply('✅ Tugma nomi yangilandi!')
  }

  // EDIT BUTTON URL
  if (userAdmin.step === 'edit_btn_url') {
    updateMessage(userAdmin.editSite, userAdmin.editId, 'btnUrl', ctx.message.text)
    delete admin[userId]
    return ctx.reply('✅ Tugma linki yangilandi!')
  }

  // EDIT DELAY
  if (userAdmin.step === 'edit_delay') {
    const delay = Number(ctx.message.text)
    if (isNaN(delay)) return ctx.reply('❌ Raqam kiriting')
    
    updateMessage(userAdmin.editSite, userAdmin.editId, 'delay', delay)
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
    admin[userId] = { 
      ...userAdmin, 
      msgId: sent.message_id, 
      step: 'ask_inline',
      chatId: CHANNEL_ID
    }
    return ctx.reply(
      `🔘 Inline keyboard qo'shilsinmi? (${userAdmin.site.toUpperCase()})`,
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

    const filename = `start_messages_${userAdmin.site}.csv`
    fs.appendFileSync(
      filename,
      `${Date.now()},${userAdmin.chatId},${userAdmin.msgId},${delay},${userAdmin.btnText || ''},${userAdmin.btnUrl || ''}\n`
    )

    admin[userId] = { step: 'menu' }
    return ctx.reply(`✅ ${userAdmin.site.toUpperCase()} uchun start xabar saqlandi!`,
      Markup.keyboard([
        ['➕ Site1 xabar qoshish', '📋 Site1 xabarlar'],
        ['➕ Site2 xabar qoshish', '📋 Site2 xabarlar'],
        ['📢 Hammaga xabar', '📊 Statistika'],
        ['👥 Barcha userlar', '📥 Excel yuklab olish']
      ]).resize()
    )
  }

  // BROADCAST CHOICE
  if (userAdmin.step === 'broadcast') {
    if (ctx.message.text === '🌐 Site1 foydalanuvchilar') {
      admin[userId] = { ...userAdmin, step: 'broadcast_send', targetSite: 'site1' }
      return ctx.reply('📨 Site1 foydalanuvchilariga yuboriladigan xabarni yuboring')
    } else if (ctx.message.text === '🌐 Site2 foydalanuvchilar') {
      admin[userId] = { ...userAdmin, step: 'broadcast_send', targetSite: 'site2' }
      return ctx.reply('📨 Site2 foydalanuvchilariga yuboriladigan xabarni yuboring')
    } else if (ctx.message.text === '👥 Barcha foydalanuvchilar') {
      admin[userId] = { ...userAdmin, step: 'broadcast_send', targetSite: 'all' }
      return ctx.reply('📨 Barcha foydalanuvchilarga yuboriladigan xabarni yuboring')
    } else if (ctx.message.text === '⬅️ Orqaga') {
      admin[userId] = { step: 'menu' }
      return ctx.reply(
        '🛠 Admin panel',
        Markup.keyboard([
          ['➕ Site1 xabar qoshish', '📋 Site1 xabarlar'],
          ['➕ Site2 xabar qoshish', '📋 Site2 xabarlar'],
          ['📢 Hammaga xabar', '📊 Statistika'],
          ['👥 Barcha userlar', '📥 Excel yuklab olish']
        ]).resize()
      )
    }
  }

  // BROADCAST SEND
  if (userAdmin.step === 'broadcast_send') {
    let users = getUsers()
    if (userAdmin.targetSite !== 'all') {
      users = users.filter(u => u.siteType === userAdmin.targetSite)
    }
    
    if (!users.length) {
      admin[userId] = { step: 'menu' }
      return ctx.reply('❌ Tanlangan guruhda foydalanuvchi yo\'q',
        Markup.keyboard([
          ['➕ Site1 xabar qoshish', '📋 Site1 xabarlar'],
          ['➕ Site2 xabar qoshish', '📋 Site2 xabarlar'],
          ['📢 Hammaga xabar', '📊 Statistika'],
          ['👥 Barcha userlar', '📥 Excel yuklab olish']
        ]).resize()
      )
    }
    
    let success = 0
    let failed = 0
    
    const statusMsg = await ctx.reply(`📤 Yuborilmoqda...\n\nGuruh: ${userAdmin.targetSite === 'all' ? 'Barcha' : userAdmin.targetSite.toUpperCase()}\nJami: ${users.length}`)
    
    for (const u of users) {
      try {
        await bot.telegram.copyMessage(
          u.id,
          ctx.chat.id,
          ctx.message.message_id
        )
        success++
      } catch (error) {
        failed++
      }
      
      if ((success + failed) % 10 === 0) {
        try {
          await bot.telegram.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            null,
            `📤 Yuborilmoqda...\n\nGuruh: ${userAdmin.targetSite === 'all' ? 'Barcha' : userAdmin.targetSite.toUpperCase()}\n✅ Yuborildi: ${success}\n❌ Xatolik: ${failed}\n📊 Jami: ${users.length}`
          )
        } catch (e) {}
      }
      
      // Spam qilmaslik uchun biroz kutamiz
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    admin[userId] = { step: 'menu' }
    try {
      await bot.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `✅ Xabar yuborish tugadi!\n\n📊 Statistika:\nGuruh: ${userAdmin.targetSite === 'all' ? 'Barcha' : userAdmin.targetSite.toUpperCase()}\n✅ Muvaffaqiyatli: ${success}\n❌ Xatolik: ${failed}\n📊 Jami: ${users.length}`
      )
    } catch (e) {}
    
    return ctx.reply(
      '🛠 Admin panel',
      Markup.keyboard([
        ['➕ Site1 xabar qoshish', '📋 Site1 xabarlar'],
        ['➕ Site2 xabar qoshish', '📋 Site2 xabarlar'],
        ['📢 Hammaga xabar', '📊 Statistika'],
        ['👥 Barcha userlar', '📥 Excel yuklab olish']
      ]).resize()
    )
  }
})

// ===== START =====
bot.launch({ dropPendingUpdates: true })
console.log('🚀 BOT ISHLAYAPTI')
console.log('👤 Login: ' + ADMIN_LOGIN)
console.log('🔐 Parol: ' + ADMIN_PASSWORD)
console.log('\n📝 Admin bo\'lish uchun: /login')
console.log('\n🌐 Saytlar uchun start komandalari:')
console.log('/start=site1 - Site1 uchun start')
console.log('/start=site2 - Site2 uchun start')
console.log('/start - Oddiy start')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))