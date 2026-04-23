// import { Telegraf, Markup } from 'telegraf'
// import fs from 'fs'

// const BOT_TOKEN = '8783455246:AAEnWJ8rUj5ubulU0wemIEtdV53xgaWhE5E'
// const ADMIN_LOGIN = 'admin'
// const ADMIN_PASSWORD = 'admin123'

// const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 60_000 })

// // ===== Fayllarni tekshirish va yaratish =====
// if (!fs.existsSync('users.csv')) {
//   fs.writeFileSync('users.csv', 'user_id,username,first_name,date,site_type\n')
// }

// if (!fs.existsSync('start_messages.json')) {
//   fs.writeFileSync('start_messages.json', JSON.stringify({
//     site1: [],
//     site2: [],
//     default: []
//   }, null, 2))
// }

// if (!fs.existsSync('admins.json')) {
//   fs.writeFileSync('admins.json', JSON.stringify({}))
// }

// // ===== Yordamchi funksiyalar =====

// const readStartMessages = () => {
//   try {
//     const data = JSON.parse(fs.readFileSync('start_messages.json', 'utf8'))
//     return {
//       site1: data.site1 || [],
//       site2: data.site2 || [],
//       default: data.default || []
//     }
//   } catch (e) {
//     return { site1: [], site2: [], default: [] }
//   }
// }

// const writeStartMessages = (data) => {
//   try {
//     fs.writeFileSync('start_messages.json', JSON.stringify(data, null, 2))
//   } catch (e) {
//     console.error('Xabarlarni yozishda xatolik:', e)
//   }
// }

// const getUsers = () => {
//   try {
//     const content = fs.readFileSync('users.csv', 'utf8')
//     const lines = content.split('\n').slice(1).filter(Boolean)
//     return lines.map(line => {
//       const [id, username, name, date, siteType] = line.split(',')
//       return { id, username, name, date, siteType: siteType || 'unknown' }
//     })
//   } catch (e) {
//     console.error('Foydalanuvchilarni o\'qishda xatolik:', e)
//     return []
//   }
// }

// const saveUser = (user, siteType) => {
//   try {
//     const users = getUsers()
//     const exists = users.find(u => u.id === String(user.id))

//     if (exists) {
//       const rows = fs.readFileSync('users.csv', 'utf8').split('\n')
//       const updated = rows.map(row => {
//         const parts = row.split(',')
//         if (parts[0] === String(user.id)) {
//           parts[4] = siteType
//         }
//         return parts.join(',')
//       })
//       fs.writeFileSync('users.csv', updated.join('\n'))
//     } else {
//       const newRow = `${user.id},${user.username || ''},${user.first_name || ''},${new Date().toISOString()},${siteType}\n`
//       fs.appendFileSync('users.csv', newRow)
//     }
//   } catch (e) {
//     console.error('Foydalanuvchini saqlashda xatolik:', e)
//   }
// }

// const getTodayUsers = () => {
//   const today = new Date().toISOString().split('T')[0]
//   return getUsers().filter(u => u.date.startsWith(today))
// }

// let sessions = {}
// try {
//   sessions = JSON.parse(fs.readFileSync('admins.json', 'utf8'))
// } catch (e) {
//   sessions = {}
// }
// const isAdmin = (userId) => sessions[userId] === true

// const adminState = {}

// const sendStartMessages = async (userId, siteType) => {
//   try {
//     const allMessages = readStartMessages()
//     const messages = allMessages[siteType] || []

//     for (const msg of messages) {
//       await new Promise(resolve => setTimeout(resolve, msg.delay * 1000))

//       const inlineKeyboard = msg.btn_text && msg.btn_url
//         ? { reply_markup: { inline_keyboard: [[{ text: msg.btn_text, url: msg.btn_url }]] } }
//         : {}

//       try {
//         if (msg.media_type === 'text') {
//           await bot.telegram.sendMessage(userId, msg.text, inlineKeyboard)
//         } else if (msg.media_type === 'photo') {
//           await bot.telegram.sendPhoto(userId, msg.media_file_id, {
//             caption: msg.text,
//             ...inlineKeyboard
//           })
//         } else if (msg.media_type === 'video') {
//           await bot.telegram.sendVideo(userId, msg.media_file_id, {
//             caption: msg.text,
//             ...inlineKeyboard
//           })
//         } else if (msg.media_type === 'video_note') {
//           await bot.telegram.sendVideoNote(userId, msg.media_file_id, inlineKeyboard)
//           if (msg.text) {
//             await bot.telegram.sendMessage(userId, msg.text)
//           }
//         }
//       } catch (error) {
//         console.error(`Xabar yuborishda xatolik (${userId}):`, error.message)
//       }
//     }

//     return messages.length
//   } catch (e) {
//     console.error('sendStartMessages umumiy xato:', e)
//     return 0
//   }
// }

// const generateExcel = (siteType = null) => {
//   try {
//     let users = getUsers()
//     if (siteType) {
//       users = users.filter(u => u.siteType === siteType)
//     }

//     const todayUsers = getTodayUsers().filter(u => !siteType || u.siteType === siteType)

//     let csv = 'User ID,Username,Ism,Site turi,Qo\'shilgan sana\n'
//     users.forEach(u => {
//       csv += `${u.id},${u.username || 'Yo\'q'},${u.name || 'Yo\'q'},${u.siteType},${new Date(u.date).toLocaleString('uz-UZ')}\n`
//     })

//     csv += `\n\nSTATISTIKA\n`
//     csv += `Sayt turi,${siteType || 'Barcha'}\n`
//     csv += `Jami foydalanuvchilar,${users.length}\n`
//     csv += `Bugun qo'shilganlar,${todayUsers.length}\n`
//     csv += `Hisobot sanasi,${new Date().toLocaleString('uz-UZ')}\n`

//     const filename = `users_${siteType || 'all'}_${Date.now()}.csv`
//     fs.writeFileSync(filename, csv)
//     return filename
//   } catch (e) {
//     console.error('Excel yaratishda xatolik:', e)
//     return null
//   }
// }

// const adminKeyboard = () => Markup.keyboard([
//   ['➕ Site1 xabar', '📋 Site1 xabarlar'],
//   ['➕ Site2 xabar', '📋 Site2 xabarlar'],
//   ['➕ Oddiy start xabar', '📋 Oddiy start xabarlar'],
//   ['📢 Hammaga xabar', '📊 Statistika'],
//   ['👥 Barcha userlar', '📥 Excel yuklab olish']
// ]).resize()

// // ===== /start =====
// bot.start(async (ctx) => {
//   try {
//     const args = ctx.message.text.split(' ')
//     let siteType = 'default'

//     if (args.length > 1) {
//       if (args[1].includes('site1')) siteType = 'site1'
//       else if (args[1].includes('site2')) siteType = 'site2'
//     }

//     saveUser(ctx.from, siteType)
//     const sentCount = await sendStartMessages(ctx.from.id, siteType)

//     if (sentCount === 0) {
//       await ctx.reply('Botimizga xush kelibsiz!')
//     }
//   } catch (e) {
//     console.error('/start xatosi:', e)
//   }
// })

// // ===== Admin login / logout =====
// bot.command('login', ctx => {
//   adminState[ctx.from.id] = { step: 'login' }
//   ctx.reply('👤 Login kiriting:')
// })

// bot.command('logout', ctx => {
//   try {
//     sessions[ctx.from.id] = false
//     fs.writeFileSync('admins.json', JSON.stringify(sessions))
//     ctx.reply('👋 Tizimdan chiqdingiz')
//   } catch (e) {
//     console.error('Logout xatosi:', e)
//   }
// })

// bot.command('admin', ctx => {
//   if (!isAdmin(ctx.from.id)) return ctx.reply('⛔️ Sizda admin huquqi yo\'q')
//   adminState[ctx.from.id] = { step: 'menu' }
//   ctx.reply('🛠 Admin panel', adminKeyboard())
// })

// // ===== Admin menyu tugmalari =====
// bot.hears('➕ Site1 xabar', ctx => startAddMessage(ctx, 'site1'))
// bot.hears('➕ Site2 xabar', ctx => startAddMessage(ctx, 'site2'))
// bot.hears('➕ Oddiy start xabar', ctx => startAddMessage(ctx, 'default'))

// bot.hears('📋 Site1 xabarlar', ctx => showMessagesList(ctx, 'site1'))
// bot.hears('📋 Site2 xabarlar', ctx => showMessagesList(ctx, 'site2'))
// bot.hears('📋 Oddiy start xabarlar', ctx => showMessagesList(ctx, 'default'))

// bot.hears('📊 Statistika', async ctx => {
//   if (!isAdmin(ctx.from.id)) return

//   try {
//     const users = getUsers()
//     const today = getTodayUsers()
//     const msgs = readStartMessages()

//     const site1Users = users.filter(u => u.siteType === 'site1')
//     const site2Users = users.filter(u => u.siteType === 'site2')
//     const defaultUsers = users.filter(u => u.siteType === 'default')

//     const text = `📊 Bot statistikasi\n\n` +
//       `👥 Jami: ${users.length}\n` +
//       `📅 Bugun: ${today.length}\n\n` +
//       `🌐 Site1: ${site1Users.length} (xabarlar: ${msgs.site1.length})\n` +
//       `🌐 Site2: ${site2Users.length} (xabarlar: ${msgs.site2.length})\n` +
//       `🟢 Oddiy start: ${defaultUsers.length} (xabarlar: ${msgs.default.length})\n` +
//       `⏰ ${new Date().toLocaleString('uz-UZ')}`

//     await ctx.reply(text)
//   } catch (e) {
//     console.error('Statistika xatosi:', e)
//     await ctx.reply('Xatolik yuz berdi')
//   }
// })

// bot.hears('👥 Barcha userlar', ctx => {
//   if (!isAdmin(ctx.from.id)) return
//   try {
//     const users = getUsers()
//     const counts = {
//       site1: users.filter(u => u.siteType === 'site1').length,
//       site2: users.filter(u => u.siteType === 'site2').length,
//       default: users.filter(u => u.siteType === 'default').length,
//       unknown: users.filter(u => u.siteType === 'unknown').length
//     }
//     ctx.reply(
//       `👥 Jami: ${users.length}\n` +
//       `🌐 Site1: ${counts.site1}\n` +
//       `🌐 Site2: ${counts.site2}\n` +
//       `🟢 Oddiy start: ${counts.default}\n` +
//       `❓ Noma'lum: ${counts.unknown}\n` +
//       `📅 Bugun: ${getTodayUsers().length}`
//     )
//   } catch (e) {
//     console.error('Userlar ro\'yxati xatosi:', e)
//     ctx.reply('Xatolik yuz berdi')
//   }
// })

// bot.hears('📥 Excel yuklab olish', ctx => {
//   if (!isAdmin(ctx.from.id)) return
//   adminState[ctx.from.id] = { step: 'excel_choice' }
//   ctx.reply('📊 Qaysi guruh uchun Excel?', Markup.keyboard([
//     ['📊 Barcha userlar', '🌐 Site1 userlar'],
//     ['🌐 Site2 userlar', '🟢 Oddiy start userlar'],
//     ['⬅️ Orqaga']
//   ]).resize())
// })

// // ===== Xabar qo'shish boshlanishi =====
// function startAddMessage(ctx, site) {
//   if (!isAdmin(ctx.from.id)) return
//   adminState[ctx.from.id] = { step: 'wait_media', site }
//   ctx.reply(
//     `📨 ${site === 'default' ? 'Oddiy start' : site.toUpperCase()} uchun media yuboring (rasm, video, video note) yoki "o'tkazib yuborish" uchun /skip yozing.`,
//     Markup.keyboard([['/skip']]).resize()
//   )
// }

// // ===== Xabarlar ro'yxatini ko'rsatish =====
// async function showMessagesList(ctx, site) {
//   if (!isAdmin(ctx.from.id)) return

//   try {
//     const all = readStartMessages()
//     const list = all[site] || []

//     if (!list.length) {
//       return ctx.reply(`❌ ${site === 'default' ? 'Oddiy start' : site.toUpperCase()} uchun start xabarlari yo'q`)
//     }

//     for (const msg of list) {
//       try {
//         if (msg.media_type === 'text') {
//           await ctx.reply(`📝 Matn: ${msg.text}`)
//         } else {
//           let caption = msg.text ? `📝 ${msg.text}` : ''
//           if (msg.media_type === 'photo') {
//             await ctx.replyWithPhoto(msg.media_file_id, { caption })
//           } else if (msg.media_type === 'video') {
//             await ctx.replyWithVideo(msg.media_file_id, { caption })
//           } else if (msg.media_type === 'video_note') {
//             await ctx.replyWithVideoNote(msg.media_file_id)
//             if (msg.text) await ctx.reply(`📝 Matn: ${msg.text}`)
//           }
//         }
//       } catch (e) {
//         await ctx.reply(`⚠️ Xabarni ko'rsatib bo'lmadi: ${e.message}`)
//       }

//       await ctx.reply(
//         `🆔 ID: ${msg.id}\n` +
//         `📦 Turi: ${msg.media_type}\n` +
//         `⏱ Kechikish: ${msg.delay} sek\n` +
//         `🔘 Tugma: ${msg.btn_text ? msg.btn_text + ' → ' + msg.btn_url : 'Yo\'q'}`,
//         Markup.inlineKeyboard([
//           [Markup.button.callback('✏️ Matn', `edit_text_${site}_${msg.id}`),
//            Markup.button.callback('🖼 Media', `edit_media_${site}_${msg.id}`)],
//           [Markup.button.callback('🔘 Tugma matni', `edit_btn_text_${site}_${msg.id}`),
//            Markup.button.callback('🔗 Tugma link', `edit_btn_url_${site}_${msg.id}`)],
//           [Markup.button.callback('⏱ Kechikish', `edit_delay_${site}_${msg.id}`),
//            Markup.button.callback('❌ Tugmani o\'chirish', `delete_btn_${site}_${msg.id}`)],
//           [Markup.button.callback('🗑 Xabarni o\'chirish', `delete_msg_${site}_${msg.id}`)]
//         ])
//       )
//     }
//   } catch (e) {
//     console.error('Xabarlar ro\'yxatini ko\'rsatishda xato:', e)
//     ctx.reply('Xatolik yuz berdi')
//   }
// }

// // ===== Callback query lar =====
// bot.on('callback_query', async ctx => {
//   if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q')

//   try {
//     const data = ctx.callbackQuery.data
//     const parts = data.split('_')

//     const id = parts.pop()
//     const site = parts.pop()
//     const action = parts.join('_')

//     const all = readStartMessages()
//     const messages = all[site] || []
//     const msg = messages.find(m => m.id === id)

//     if (!msg) {
//       await ctx.answerCbQuery('Xabar topilmadi')
//       return
//     }

//     if (action === 'delete_msg') {
//       all[site] = messages.filter(m => m.id !== id)
//       writeStartMessages(all)
//       await ctx.answerCbQuery('Xabar o\'chirildi')
//       await ctx.deleteMessage()
//       return
//     }

//     if (action === 'delete_btn') {
//       msg.btn_text = ''
//       msg.btn_url = ''
//       writeStartMessages(all)
//       await ctx.answerCbQuery('Inline tugma olib tashlandi')
//       return
//     }

//     if (action.startsWith('edit_')) {
//       const field = action.replace('edit_', '')
//       adminState[ctx.from.id] = { step: `edit_${field}`, site, id }
//       const prompts = {
//         text: '✏️ Yangi matn yuboring:',
//         media: '🖼 Yangi media yuboring (rasm/video/video note):',
//         btn_text: '🔘 Tugma matnini kiriting:',
//         btn_url: '🔗 Tugma linkini kiriting:',
//         delay: '⏱ Yangi kechikish (sekund, masalan 0.5):'
//       }
//       await ctx.reply(prompts[field])
//       await ctx.answerCbQuery()
//       return
//     }

//     await ctx.answerCbQuery('Amal bajarilmadi')
//   } catch (e) {
//     console.error('Callback xatosi:', e)
//     await ctx.answerCbQuery('Xatolik yuz berdi')
//   }
// })

// // ===== Admin matnli xabarlarni qabul qilish (global) =====
// bot.on('message', async ctx => {
//   const userId = ctx.from.id
//   const state = adminState[userId]
//   const msgText = ctx.message.text

//   // --- Maxsus: "📢 Hammaga xabar" tugmasi bosilganda (state'dan qat'iy nazar ishlasin) ---
//   if (msgText === '📢 Hammaga xabar' && isAdmin(userId)) {
//     adminState[userId] = { step: 'broadcast_target' }
//     return ctx.reply('👥 Qaysi guruhga xabar yuboramiz?', Markup.keyboard([
//       ['🌐 Site1 foydalanuvchilar', '🌐 Site2 foydalanuvchilar'],
//       ['🟢 Oddiy start foydalanuvchilar', '👥 Barcha foydalanuvchilar'],
//       ['⬅️ Orqaga']
//     ]).resize())
//   }

//   // Login jarayoni
//   if (state?.step === 'login') {
//     adminState[userId] = { step: 'password', login: msgText }
//     return ctx.reply('🔐 Parol:')
//   }

//   if (state?.step === 'password') {
//     if (state.login === ADMIN_LOGIN && msgText === ADMIN_PASSWORD) {
//       sessions[userId] = true
//       try {
//         fs.writeFileSync('admins.json', JSON.stringify(sessions))
//       } catch (e) {}
//       delete adminState[userId]
//       return ctx.reply('✅ Xush kelibsiz, admin!', adminKeyboard())
//     }
//     delete adminState[userId]
//     return ctx.reply('❌ Noto\'g\'ri login yoki parol')
//   }

//   if (!isAdmin(userId)) return

//   // Excel tanlovi
//   if (state?.step === 'excel_choice') {
//     const text = msgText
//     let site = null

//     if (text === '📊 Barcha userlar') site = null
//     else if (text === '🌐 Site1 userlar') site = 'site1'
//     else if (text === '🌐 Site2 userlar') site = 'site2'
//     else if (text === '🟢 Oddiy start userlar') site = 'default'
//     else if (text === '⬅️ Orqaga') {
//       delete adminState[userId]
//       return ctx.reply('🛠 Admin panel', adminKeyboard())
//     } else {
//       return ctx.reply('❌ Noto\'g\'ri tanlov')
//     }

//     try {
//       const filename = generateExcel(site)
//       if (filename) {
//         await ctx.replyWithDocument({ source: filename, filename: `users_${site || 'all'}.csv` })
//         fs.unlinkSync(filename)
//       } else {
//         await ctx.reply('❌ Excel yaratishda xatolik')
//       }
//     } catch (e) {
//       console.error('Excel yuborishda xato:', e)
//       await ctx.reply('❌ Xatolik yuz berdi')
//     }
//     delete adminState[userId]
//     return ctx.reply('✅ Tayyor!', adminKeyboard())
//   }

//   // Xabar qo'shish - media yoki /skip
//   if (state?.step === 'wait_media') {
//     const site = state.site

//     if (msgText === '/skip') {
//       adminState[userId] = { step: 'wait_text', site, media_type: 'text' }
//       return ctx.reply('📝 Endi matnni yuboring:')
//     }

//     let media_type = null
//     let file_id = null
//     if (ctx.message.photo) {
//       media_type = 'photo'
//       file_id = ctx.message.photo[ctx.message.photo.length - 1].file_id
//     } else if (ctx.message.video) {
//       media_type = 'video'
//       file_id = ctx.message.video.file_id
//     } else if (ctx.message.video_note) {
//       media_type = 'video_note'
//       file_id = ctx.message.video_note.file_id
//     } else {
//       return ctx.reply('❌ Iltimos rasm, video yoki video note yuboring, yoki /skip')
//     }

//     adminState[userId] = {
//       step: 'wait_text',
//       site,
//       media_type,
//       media_file_id: file_id
//     }
//     return ctx.reply('📝 Endi media uchun matn (caption) yuboring (bo\'sh qoldirish mumkin):', Markup.keyboard([['/skip']]).resize())
//   }

//   // Matn kiritish
//   if (state?.step === 'wait_text') {
//     const text = msgText === '/skip' ? '' : msgText
//     adminState[userId] = { ...state, text, step: 'wait_button' }
//     return ctx.reply('🔘 Inline tugma qo\'shilsinmi?', Markup.keyboard([['Ha'], ['Yo\'q']]).resize())
//   }

//   // Tugma so'rash
//   if (state?.step === 'wait_button') {
//     if (msgText === 'Ha') {
//       adminState[userId] = { ...state, step: 'wait_btn_text' }
//       return ctx.reply('🔤 Tugma matni:')
//     } else {
//       adminState[userId] = { ...state, btn_text: '', btn_url: '', step: 'wait_delay' }
//       return ctx.reply('⏱ Kechikish (sekund, masalan 0.1):')
//     }
//   }

//   if (state?.step === 'wait_btn_text') {
//     adminState[userId] = { ...state, btn_text: msgText, step: 'wait_btn_url' }
//     return ctx.reply('🔗 Tugma linki:')
//   }

//   if (state?.step === 'wait_btn_url') {
//     adminState[userId] = { ...state, btn_url: msgText, step: 'wait_delay' }
//     return ctx.reply('⏱ Kechikish (sekund, masalan 0.1):')
//   }

//   if (state?.step === 'wait_delay') {
//     const delay = parseFloat(msgText)
//     if (isNaN(delay)) return ctx.reply('❌ Raqam kiriting (masalan 0.5)')

//     const all = readStartMessages()
//     if (!state.site) {
//       delete adminState[userId]
//       return ctx.reply('❌ Xatolik: sayt turi aniqlanmadi. Qaytadan urinib ko\'ring.')
//     }

//     const newMsg = {
//       id: String(Date.now()),
//       media_type: state.media_type || 'text',
//       media_file_id: state.media_file_id || '',
//       text: state.text || '',
//       delay,
//       btn_text: state.btn_text || '',
//       btn_url: state.btn_url || ''
//     }

//     if (!all[state.site]) all[state.site] = []
//     all[state.site].push(newMsg)
//     writeStartMessages(all)

//     const siteName = state.site === 'default' ? 'Oddiy start' : state.site.toUpperCase()
//     delete adminState[userId]
//     return ctx.reply(`✅ ${siteName} uchun start xabar qo'shildi!`, adminKeyboard())
//   }

//   // Tahrirlash jarayonlari
//   if (state?.step?.startsWith('edit_')) {
//     const field = state.step.replace('edit_', '')
//     const all = readStartMessages()
//     const messages = all[state.site]
//     const msg = messages.find(m => m.id === state.id)
//     if (!msg) {
//       delete adminState[userId]
//       return ctx.reply('Xabar topilmadi')
//     }

//     try {
//       if (field === 'text') {
//         msg.text = msgText
//       } else if (field === 'media') {
//         if (ctx.message.photo) {
//           msg.media_type = 'photo'
//           msg.media_file_id = ctx.message.photo[ctx.message.photo.length - 1].file_id
//         } else if (ctx.message.video) {
//           msg.media_type = 'video'
//           msg.media_file_id = ctx.message.video.file_id
//         } else if (ctx.message.video_note) {
//           msg.media_type = 'video_note'
//           msg.media_file_id = ctx.message.video_note.file_id
//         } else {
//           return ctx.reply('❌ Rasm, video yoki video note yuboring')
//         }
//       } else if (field === 'btn_text') {
//         msg.btn_text = msgText
//       } else if (field === 'btn_url') {
//         msg.btn_url = msgText
//       } else if (field === 'delay') {
//         const delay = parseFloat(msgText)
//         if (isNaN(delay)) return ctx.reply('❌ Raqam kiriting (masalan 0.5)')
//         msg.delay = delay
//       }

//       writeStartMessages(all)
//       delete adminState[userId]
//       return ctx.reply('✅ O\'zgartirildi', adminKeyboard())
//     } catch (e) {
//       console.error('Tahrirlashda xato:', e)
//       delete adminState[userId]
//       return ctx.reply('❌ Xatolik yuz berdi', adminKeyboard())
//     }
//   }

//   // Ommaviy xabar yuborish - guruh tanlash
//   if (state?.step === 'broadcast_target') {
//     const text = msgText
//     let target = null
//     if (text === '🌐 Site1 foydalanuvchilar') target = 'site1'
//     else if (text === '🌐 Site2 foydalanuvchilar') target = 'site2'
//     else if (text === '🟢 Oddiy start foydalanuvchilar') target = 'default'
//     else if (text === '👥 Barcha foydalanuvchilar') target = 'all'
//     else if (text === '⬅️ Orqaga') {
//       delete adminState[userId]
//       return ctx.reply('🛠 Admin panel', adminKeyboard())
//     } else {
//       return ctx.reply('Iltimos, quyidagi variantlardan birini tanlang:', Markup.keyboard([
//         ['🌐 Site1 foydalanuvchilar', '🌐 Site2 foydalanuvchilar'],
//         ['🟢 Oddiy start foydalanuvchilar', '👥 Barcha foydalanuvchilar'],
//         ['⬅️ Orqaga']
//       ]).resize())
//     }

//     adminState[userId] = { step: 'broadcast_send', target }
//     return ctx.reply('📨 Yuboriladigan xabarni yuboring (matn, rasm, video, hujjat va h.k.):')
//   }

//   // Ommaviy xabarni yuborish
//   if (state?.step === 'broadcast_send') {
//     try {
//       let users = getUsers()
//       if (state.target !== 'all') {
//         users = users.filter(u => u.siteType === state.target)
//       }
//       if (!users.length) {
//         delete adminState[userId]
//         return ctx.reply('❌ Tanlangan guruhda foydalanuvchi topilmadi', adminKeyboard())
//       }

//       const statusMsg = await ctx.reply(`📤 Yuborilmoqda... 0/${users.length}`)
//       let success = 0, failed = 0

//       for (const u of users) {
//         try {
//           await ctx.telegram.copyMessage(u.id, ctx.chat.id, ctx.message.message_id)
//           success++
//         } catch (error) {
//           console.error(`Xabar yuborilmadi (${u.id}):`, error.message)
//           failed++
//         }

//         if ((success + failed) % 10 === 0) {
//           try {
//             await ctx.telegram.editMessageText(
//               ctx.chat.id, statusMsg.message_id, null,
//               `📤 Yuborilmoqda... ${success + failed}/${users.length}`
//             )
//           } catch (e) {}
//         }
//         await new Promise(r => setTimeout(r, 50))
//       }

//       await ctx.telegram.editMessageText(
//         ctx.chat.id, statusMsg.message_id, null,
//         `✅ Yakunlandi!\n✅ Muvaffaqiyatli: ${success}\n❌ Xatolik: ${failed}`
//       )
//     } catch (e) {
//       console.error('Ommaviy yuborishda xato:', e)
//       await ctx.reply('❌ Xatolik yuz berdi')
//     }
//     delete adminState[userId]
//     return ctx.reply('Bajarildi', adminKeyboard())
//   }

//   // Agar yuqoridagi hech bir shart bajarilmasa va state mavjud bo'lmasa yoki noma'lum bo'lsa, hech narsa qilmaslik
// })

// // ===== Ishga tushirish =====
// bot.launch({ dropPendingUpdates: true })
//   .then(() => {
//     console.log('🚀 BOT ISHLAYAPTI')
//     console.log(`👤 Login: ${ADMIN_LOGIN}  🔐 Parol: ${ADMIN_PASSWORD}`)
//     console.log('\n📌 Admin bo\'lish: /login')
//     console.log('📌 Start turlari: /start , /start site1 , /start site2')
//   })
//   .catch(err => {
//     console.error('Botni ishga tushirishda xato:', err)
//   })

// process.once('SIGINT', () => bot.stop('SIGINT'))
// process.once('SIGTERM', () => bot.stop('SIGTERM'))

import { Telegraf, Markup } from 'telegraf'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BOT_TOKEN = '8536141927:AAF9dooLSHGxZRBLqV_o3uAPsIZ9jl5v6Js'
const ADMIN_LOGIN = 'admin'
const ADMIN_PASSWORD = 'admin123'

// --- Kanalingiz ID sini kiriting ( @username yoki -100123456789 ) ---
const CHANNEL_ID = '@botbazaiman'
const EXCEL_INTERVAL_MINUTES = 1

const USERS_CSV     = path.join(__dirname, 'users.csv')
const MESSAGES_JSON = path.join(__dirname, 'start_messages.json')
const ADMINS_JSON   = path.join(__dirname, 'admins.json')
const TEMP_DIR      = path.join(__dirname, 'temp_exports')

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

// ===== Fayllarni yaratish =====
if (!fs.existsSync(USERS_CSV)) {
  fs.writeFileSync(USERS_CSV, 'user_id,username,first_name,start_date,site_type\n', 'utf8')
}
if (!fs.existsSync(MESSAGES_JSON)) {
  fs.writeFileSync(MESSAGES_JSON, JSON.stringify({ site1: [], site2: [], default: [] }, null, 2))
}
if (!fs.existsSync(ADMINS_JSON)) {
  fs.writeFileSync(ADMINS_JSON, JSON.stringify({}))
}

const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 60_000 })

// ===== Sessiyalar =====
let sessions = {}
try { sessions = JSON.parse(fs.readFileSync(ADMINS_JSON, 'utf8')) } catch {}
const isAdmin = userId => sessions[String(userId)] === true
const saveSession = () => fs.writeFileSync(ADMINS_JSON, JSON.stringify(sessions, null, 2), 'utf8')

// ===== Start xabarlar =====
const readStartMessages = () => {
  try {
    const data = JSON.parse(fs.readFileSync(MESSAGES_JSON, 'utf8'))
    return { site1: data.site1 || [], site2: data.site2 || [], default: data.default || [] }
  } catch { return { site1: [], site2: [], default: [] } }
}
const writeStartMessages = data => fs.writeFileSync(MESSAGES_JSON, JSON.stringify(data, null, 2), 'utf8')

// ===== FOYDALANUVCHILARNI O‘QISH (vergulli sanani to‘g‘ri ajratadi) =====
const getUsers = () => {
  try {
    const content = fs.readFileSync(USERS_CSV, 'utf8')
    const lines = content.split('\n').filter(l => l.trim())
    const dataLines = lines.length > 0 && lines[0].startsWith('user_id') ? lines.slice(1) : lines

    return dataLines.map(line => {
      // 4 ta vergul – keyin sana (ichida vergul bo‘lishi mumkin)
      const parts = line.split(',').map(p => p.trim())
      if (parts.length < 4) return null

      const id = parts[0]
      const username = parts[1]
      const name = parts[2]
      const siteTypeRaw = parts[3]
      const dateRaw = parts.slice(4).join(',').trim()

      let dateISO = ''
      if (dateRaw) {
        const match = dateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})/)
        if (match) {
          const [_, day, month, year, hour, minute, sec] = match
          const d = new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${hour.padStart(2,'0')}:${minute}:${sec}`)
          dateISO = d.toISOString()
        } else {
          const d = new Date(dateRaw)
          dateISO = isNaN(d) ? dateRaw : d.toISOString()
        }
      }

      let siteType = siteTypeRaw
      if (!siteType || siteType === '') siteType = 'unknown'
      else if (siteType === 'default' || siteType === 'Oddiy start') siteType = 'default'
      else if (siteType === 'site1' || siteType === 'Site1') siteType = 'site1'
      else if (siteType === 'site2' || siteType === 'Site2') siteType = 'site2'

      return { id, username, name, date: dateISO, siteType }
    }).filter(u => u && u.id)
  } catch (e) {
    console.error('❌ getUsers xatolik:', e)
    return null
  }
}

// ===== ATOMIK YOZISH =====
const writeUsers = (users) => {
  const header = 'user_id,username,first_name,start_date,site_type'
  const rows = users.map(u => {
    const safeUsername = (u.username || '').replace(/,/g, '').replace(/\n/g, '')
    const safeName = (u.name || '').replace(/,/g, '').replace(/\n/g, '')
    return `${u.id},${safeUsername},${safeName},${u.date},${u.siteType}`
  })
  const data = [header, ...rows].join('\n') + '\n'
  const tmpFile = USERS_CSV + '.tmp'
  fs.writeFileSync(tmpFile, data, 'utf8')
  fs.renameSync(tmpFile, USERS_CSV)
}

const saveUser = (user, siteType) => {
  try {
    let users = getUsers()
    if (!users) {
      console.error('❌ getUsers null qaytardi, faylga tegmadik')
      return
    }
    const existing = users.find(u => u.id === String(user.id))
    if (existing) {
      existing.siteType = siteType
      console.log(`🔄 Yangilandi: ${user.id} → ${siteType}`)
    } else {
      const safeUsername = (user.username || '').replace(/,/g, '').replace(/\n/g, '')
      const safeFirstName = (user.first_name || '').replace(/,/g, '').replace(/\n/g, '')
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
    console.error('saveUser xatosi:', e)
  }
}

const getTodayUsers = () => {
  const today = new Date().toISOString().split('T')[0]
  const users = getUsers()
  return users ? users.filter(u => u.date.startsWith(today)) : []
}

// ===== SANANI ASL FORMATGA O‘GIRISH (dd/mm/yyyy, hh:mm:ss) =====
const formatDateForExport = (isoString) => {
  try {
    const d = new Date(isoString)
    const opts = { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
    const parts = d.toLocaleString('en-GB', opts).split(', ')
    // parts[0] = 'dd/mm/yyyy', parts[1] = 'hh:mm:ss'
    // Bazi brauzer/environment format farq qilishi mumkin, qo'lda tuzamiz
    const date = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
    return `${date}, ${time}`
  } catch {
    return isoString
  }
}

// ===== EXPORT CSV (siz ko‘rsatgan formatda) =====
const generateExportCSV = (siteType = null) => {
  try {
    const users = getUsers()
    if (!users) return null
    const filtered = siteType ? users.filter(u => u.siteType === siteType) : users

    const today = new Date().toISOString().split('T')[0]
    const todayCount = filtered.filter(u => u.date && u.date.startsWith(today)).length

    // BOM qo‘shamiz
    let csv = '\uFEFF'
    // Sarlavha
    csv += 'User ID,Username,Ism,Site turi,Qo\'shilgan sana\n'

    filtered.forEach(u => {
      const dateFormatted = formatDateForExport(u.date)
      csv += `${u.id},${u.username || 'Yo\'q'},${u.name || 'Yo\'q'},${u.siteType},${dateFormatted}\n`
    })

    // STATISTIKA bo‘limi
    csv += `\nSTATISTIKA\n`
    csv += `Sayt turi,${siteType ? (siteType === 'default' ? 'default' : siteType) : 'Barcha'}\n`
    csv += `Jami foydalanuvchilar,${filtered.length}\n`
    csv += `Bugun qo'shilganlar,${todayCount}\n`

    // Hisobot sanasi: hozirgi Toshkent vaqti, xuddi namunadagi formatda
    const now = new Date()
    const hisobotSana = formatDateForExport(now.toISOString())
    csv += `Hisobot sanasi,${hisobotSana}\n`

    const filename = path.join(TEMP_DIR, `export_${siteType || 'all'}_${Date.now()}.csv`)
    fs.writeFileSync(filename, csv, 'utf8')
    return filename
  } catch (e) {
    console.error('generateExportCSV xatosi:', e)
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

// ===== Admin state =====
const adminState = {}

// ===== Start xabarlarni yuborish =====
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

// ===== Klaviatura =====
const adminKeyboard = () => Markup.keyboard([
  ['➕ Site1 xabar', '📋 Site1 xabarlar'],
  ['➕ Site2 xabar', '📋 Site2 xabarlar'],
  ['➕ Oddiy start xabar', '📋 Oddiy start xabarlar'],
  ['📢 Hammaga xabar', '📊 Statistika'],
  ['👥 Barcha userlar', '📥 Excel yuklab olish']
]).resize()

// ===== Kunlik hisobot =====
const sendDailyReport = async () => {
  try {
    const admins = Object.entries(sessions).filter(([,v]) => v === true).map(([id]) => id)
    if (!admins.length) return
    const users = getUsers()
    if (!users) return
    const msgs = readStartMessages()
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const todayUsers = users.filter(u => u.date.startsWith(today)).length
    const yesterdayUsers = users.filter(u => u.date.startsWith(yesterday)).length
    const site1 = users.filter(u => u.siteType === 'site1').length
    const site2 = users.filter(u => u.siteType === 'site2').length
    const def = users.filter(u => u.siteType === 'default').length
    const unknown = users.filter(u => u.siteType === 'unknown').length
    const tNow = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
    const report = `📊 *KUNLIK HISOBOT*\n📅 ${tNow}\n\n👥 *Jami: ${users.length}*\n📅 Bugun: ${todayUsers}\n📅 Kecha: ${yesterdayUsers}\n\n🌐 Site1: ${site1} (xabarlar: ${msgs.site1.length})\n🌐 Site2: ${site2} (xabarlar: ${msgs.site2.length})\n🟢 Oddiy start: ${def} (xabarlar: ${msgs.default.length})\n❓ Noma'lum: ${unknown}`
    const file = generateExportCSV(null)
    for (const id of admins) {
      await bot.telegram.sendMessage(id, report, { parse_mode: 'Markdown' })
      if (file) await bot.telegram.sendDocument(id, { source: file, filename: `daily_${today}.csv` }, { caption: `📎 Barcha foydalanuvchilar – ${users.length} ta` }).catch(() => {})
    }
    if (file) safeDeleteTempFile(file)
  } catch (e) { console.error('Kunlik hisobot xatosi:', e) }
}

// ===== Kanalga avtomatik Excel yuborish =====
const sendExcelToChannel = async () => {
  try {
    const users = getUsers()
    if (!users || users.length === 0) return

    const filePath = generateExportCSV(null)
    if (!filePath) return

    const now = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
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
  const n = new Date()
  const h = (n.getUTCHours() + 5) % 24
  if (h === 0 && n.getUTCMinutes() === 0) {
    const ds = n.toISOString().split('T')[0]
    if (lastSentDate !== ds) {
      lastSentDate = ds
      sendDailyReport()
    }
  }
}, 60_000)

// ===== /start =====
bot.start(async ctx => {
  try {
    const args = ctx.message.text.split(' ')
    let site = 'default'
    if (args[1]?.toLowerCase().includes('site1')) site = 'site1'
    else if (args[1]?.toLowerCase().includes('site2')) site = 'site2'
    saveUser(ctx.from, site)
    const sent = await sendStartMessages(ctx.from.id, site)
    if (sent === 0) await ctx.reply('Botimizga xush kelibsiz!')
  } catch {}
})

// ===== Login/Logout/Admin =====
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
  ctx.reply(`🗃 Baza: ${USERS_CSV}\n👥 Jami: ${users?.length || 0}\n📅 Bugun: ${getTodayUsers().length}`)
})

// ===== Tugmalar =====
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
bot.hears('➕ Site1 xabar', ctx => startAddMessage(ctx, 'site1'))
bot.hears('➕ Site2 xabar', ctx => startAddMessage(ctx, 'site2'))
bot.hears('➕ Oddiy start xabar', ctx => startAddMessage(ctx, 'default'))
bot.hears('📋 Site1 xabarlar', ctx => showMessagesList(ctx, 'site1'))
bot.hears('📋 Site2 xabarlar', ctx => showMessagesList(ctx, 'site2'))
bot.hears('📋 Oddiy start xabarlar', ctx => showMessagesList(ctx, 'default'))

bot.hears('📊 Statistika', async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const users = getUsers()
  if (!users) return ctx.reply('Xatolik')
  const msgs = readStartMessages()
  const today = getTodayUsers().length
  const site1 = users.filter(u => u.siteType === 'site1').length
  const site2 = users.filter(u => u.siteType === 'site2').length
  const def = users.filter(u => u.siteType === 'default').length
  const unknown = users.filter(u => u.siteType === 'unknown').length
  await ctx.reply(`📊 Jami: ${users.length}\n📅 Bugun: ${today}\n\n🌐 Site1: ${site1} (xabarlar: ${msgs.site1.length})\n🌐 Site2: ${site2} (xabarlar: ${msgs.site2.length})\n🟢 Oddiy start: ${def} (xabarlar: ${msgs.default.length})\n❓ Noma'lum: ${unknown}`)
})

bot.hears('👥 Barcha userlar', ctx => {
  if (!isAdmin(ctx.from.id)) return
  const users = getUsers()
  if (!users) return ctx.reply('Xatolik')
  const site1 = users.filter(u => u.siteType === 'site1').length
  const site2 = users.filter(u => u.siteType === 'site2').length
  const def = users.filter(u => u.siteType === 'default').length
  const unknown = users.filter(u => u.siteType === 'unknown').length
  ctx.reply(`👥 Jami: ${users.length}\n🌐 Site1: ${site1}\n🌐 Site2: ${site2}\n🟢 Oddiy start: ${def}\n❓ Noma'lum: ${unknown}\n📅 Bugun: ${getTodayUsers().length}`)
})

bot.hears('📥 Excel yuklab olish', ctx => {
  if (!isAdmin(ctx.from.id)) return
  adminState[ctx.from.id] = { step: 'excel_choice' }
  ctx.reply('Qaysi guruh?', Markup.keyboard([['📊 Barcha', '🌐 Site1'], ['🌐 Site2', '🟢 Oddiy start'], ['⬅️ Orqaga']]).resize())
})

// ===== Callback =====
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

// ===== Barcha matnli xabarlar =====
bot.on('message', async ctx => {
  const uid = ctx.from.id, state = adminState[uid], txt = ctx.message.text

  if (txt === '📢 Hammaga xabar' && isAdmin(uid)) {
    adminState[uid] = { step: 'broadcast_target' }
    return ctx.reply('Guruhni tanlang:', Markup.keyboard([
      ['🌐 Site1', '🌐 Site2'], ['🟢 Oddiy start', '👥 Barcha'], ['⬅️ Orqaga']
    ]).resize())
  }

  if (state?.step === 'login') { adminState[uid] = { step: 'password', login: txt }; return ctx.reply('🔐 Parol:') }
  if (state?.step === 'password') {
    if (state.login === ADMIN_LOGIN && txt === ADMIN_PASSWORD) {
      sessions[String(uid)] = true; saveSession(); delete adminState[uid]
      return ctx.reply('✅ Xush kelibsiz, admin!', adminKeyboard())
    } else { delete adminState[uid]; return ctx.reply('❌ Noto\'g\'ri') }
  }

  if (!isAdmin(uid)) return

  if (state?.step === 'excel_choice') {
    let site = null
    if (txt === '📊 Barcha') site = null
    else if (txt === '🌐 Site1') site = 'site1'
    else if (txt === '🌐 Site2') site = 'site2'
    else if (txt === '🟢 Oddiy start') site = 'default'
    else if (txt === '⬅️ Orqaga') { delete adminState[uid]; return ctx.reply('Admin panel', adminKeyboard()) }
    else return ctx.reply('Noto\'g\'ri tanlov')

    const fn = generateExportCSV(site)
    if (fn) {
      const count = getUsers()?.filter(u => !site || u.siteType === site).length || 0
      await ctx.replyWithDocument({ source: fn, filename: 'users.csv' }, { caption: `👥 Jami: ${count} ta` })
      safeDeleteTempFile(fn)
    } else {
      await ctx.reply('❌ Xatolik yuz berdi')
    }
    delete adminState[uid]; return ctx.reply('✅', adminKeyboard())
  }

  // Media qo‘shish bosqichlari (avvalgidek, o‘zgartirilmagan)
  if (state?.step === 'wait_media') {
    const site = state.site
    if (txt === '/skip') { adminState[uid] = { step: 'wait_text', site, media_type: 'text' }; return ctx.reply('Matn yuboring:') }
    let mt = null, fid = null
    if (ctx.message.photo) { mt = 'photo'; fid = ctx.message.photo.pop().file_id }
    else if (ctx.message.video) { mt = 'video'; fid = ctx.message.video.file_id }
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

  // Tahrirlash
  if (state?.step?.startsWith('edit_')) {
    const field = state.step.replace('edit_', '')
    const all = readStartMessages(); const msgs = all[state.site] || []; const m = msgs.find(x => x.id === state.id)
    if (!m) { delete adminState[uid]; return ctx.reply('Topilmadi') }
    try {
      if (field === 'text') m.text = txt
      else if (field === 'media') {
        if (ctx.message.photo) { m.media_type = 'photo'; m.media_file_id = ctx.message.photo.pop().file_id }
        else if (ctx.message.video) { m.media_type = 'video'; m.media_file_id = ctx.message.video.file_id }
        else if (ctx.message.video_note) { m.media_type = 'video_note'; m.media_file_id = ctx.message.video_note.file_id }
        else return ctx.reply('Media yuboring')
      } else if (field === 'btn_text') m.btn_text = txt
      else if (field === 'btn_url') m.btn_url = txt
      else if (field === 'delay') { const v = parseFloat(txt); if (isNaN(v)) return ctx.reply('Raqam'); m.delay = v }
      writeStartMessages(all); delete adminState[uid]; return ctx.reply('✅ O\'zgartirildi', adminKeyboard())
    } catch { delete adminState[uid]; return ctx.reply('Xatolik', adminKeyboard()) }
  }

  // Broadcast
  if (state?.step === 'broadcast_target') {
    let target = null
    if (txt === '🌐 Site1') target = 'site1'
    else if (txt === '🌐 Site2') target = 'site2'
    else if (txt === '🟢 Oddiy start') target = 'default'
    else if (txt === '👥 Barcha') target = 'all'
    else if (txt === '⬅️ Orqaga') { delete adminState[uid]; return ctx.reply('Admin panel', adminKeyboard()) }
    else return ctx.reply('Guruhni tanlang', Markup.keyboard([['🌐 Site1', '🌐 Site2'], ['🟢 Oddiy start', '👥 Barcha'], ['⬅️ Orqaga']]).resize())
    adminState[uid] = { step: 'broadcast_send', target }
    return ctx.reply('Yuboriladigan xabarni yuboring:')
  }
  if (state?.step === 'broadcast_send') {
    try {
      let users = getUsers()
      if (!users) { delete adminState[uid]; return ctx.reply('Baza o\'qishda xatolik') }
      if (state.target !== 'all') users = users.filter(u => u.siteType === state.target)
      if (!users.length) { delete adminState[uid]; return ctx.reply('Foydalanuvchi topilmadi', adminKeyboard()) }
      const st = await ctx.reply(`📤 0/${users.length}`)
      let ok = 0, err = 0
      for (const u of users) {
        try { await ctx.telegram.copyMessage(u.id, ctx.chat.id, ctx.message.message_id); ok++ } catch (e) { err++ }
        if ((ok + err) % 10 === 0) {
          try { await ctx.telegram.editMessageText(ctx.chat.id, st.message_id, null, `📤 ${ok + err}/${users.length}`) } catch {}
        }
        await new Promise(r => setTimeout(r, 50))
      }
      await ctx.telegram.editMessageText(ctx.chat.id, st.message_id, null, `✅ Muvaffaqiyatli: ${ok}, Xatolik: ${err}`)
    } catch (e) { console.error(e) }
    delete adminState[uid]; return ctx.reply('Bajarildi', adminKeyboard())
  }
})

// ===== ISHGA TUSHIRISH =====
bot.launch({ dropPendingUpdates: true }).then(() => {
  console.log('🚀 BOT ISHLAYAPTI')
  console.log(`👤 Login: ${ADMIN_LOGIN}  🔐 Parol: ${ADMIN_PASSWORD}`)
  console.log(`📁 Baza: ${USERS_CSV}`)
  if (CHANNEL_ID !== '@YOUR_CHANNEL_USERNAME') {
    console.log(`📡 Kanal: ${CHANNEL_ID} ga har ${EXCEL_INTERVAL_MINUTES} daqiqada Excel yuboriladi`)
  } else {
    console.log('⚠️  Kanal ID sozlanmagan! CHANNEL_ID ni o‘zgartiring.')
  }
  console.log('✅ Kunlik hisobot taymeri ishlamoqda')
})
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))