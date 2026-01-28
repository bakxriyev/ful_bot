const { Telegraf, Markup } = require('telegraf');
const ExcelJS = require('exceljs');
const fs = require('fs');

// Admin ma'lumotlari
const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "admin123";

let adminUsers = {}; // {chatId: true} - admin statusi

// Excel fayl nomlari
const USERS_EXCEL_FILE = 'users.xlsx';
const START_CONTENT_FILE = 'start_content.xlsx';
const BROADCAST_CONTENT_FILE = 'broadcast_content.xlsx';

// Bot token
const BOT_TOKEN = '8222835015:AAEz5In0FXKiYAhlOrZikLA19fqlHTkYfTg';

const bot = new Telegraf(BOT_TOKEN);

// Session uchun
const userSessions = {};

// Excel fayllarni yaratish
async function createExcelFiles() {
    console.log('📁 Excel fayllarini yaratish...');
    
    // Users faylini yaratish
    if (!fs.existsSync(USERS_EXCEL_FILE)) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');
        
        worksheet.columns = [
            { header: 'ID', key: 'id' },
            { header: 'Chat ID', key: 'chatId' },
            { header: 'Username', key: 'username' },
            { header: 'First Name', key: 'firstName' },
            { header: 'Last Name', key: 'lastName' },
            { header: 'Joined Date', key: 'joinedDate' }
        ];
        
        // Header qo'shish
        worksheet.addRow({
            id: 'ID',
            chatId: 'Chat ID',
            username: 'Username',
            firstName: 'First Name',
            lastName: 'Last Name',
            joinedDate: 'Joined Date'
        });
        
        await workbook.xlsx.writeFile(USERS_EXCEL_FILE);
        console.log('✅ users.xlsx yaratildi');
    }
    
    // START Content faylini yaratish
    if (!fs.existsSync(START_CONTENT_FILE)) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Content');
        
        worksheet.columns = [
            { header: 'ID', key: 'id' },
            { header: 'Type', key: 'type' },
            { header: 'File ID', key: 'fileId' },
            { header: 'Text', key: 'text' },
            { header: 'Button Text', key: 'buttonText' },
            { header: 'Button URL', key: 'buttonUrl' },
            { header: 'Added Date', key: 'addedDate' }
        ];
        
        // Header qo'shish
        worksheet.addRow({
            id: 'ID',
            type: 'Type',
            fileId: 'File ID',
            text: 'Text',
            buttonText: 'Button Text',
            buttonUrl: 'Button URL',
            addedDate: 'Added Date'
        });
        
        await workbook.xlsx.writeFile(START_CONTENT_FILE);
        console.log('✅ start_content.xlsx yaratildi');
    }
    
    // BROADCAST Content faylini yaratish
    if (!fs.existsSync(BROADCAST_CONTENT_FILE)) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Content');
        
        worksheet.columns = [
            { header: 'ID', key: 'id' },
            { header: 'Type', key: 'type' },
            { header: 'File ID', key: 'fileId' },
            { header: 'Text', key: 'text' },
            { header: 'Button Text', key: 'buttonText' },
            { header: 'Button URL', key: 'buttonUrl' },
            { header: 'Added Date', key: 'addedDate' }
        ];
        
        // Header qo'shish
        worksheet.addRow({
            id: 'ID',
            type: 'Type',
            fileId: 'File ID',
            text: 'Text',
            buttonText: 'Button Text',
            buttonUrl: 'Button URL',
            addedDate: 'Added Date'
        });
        
        await workbook.xlsx.writeFile(BROADCAST_CONTENT_FILE);
        console.log('✅ broadcast_content.xlsx yaratildi');
    }
}

// Foydalanuvchini Excelga qo'shish
async function addUserToExcel(chatId, userData) {
    try {
        console.log(`👤 Foydalanuvchi qo'shilmoqda: ${chatId}`);
        
        const workbook = new ExcelJS.Workbook();
        
        if (!fs.existsSync(USERS_EXCEL_FILE)) {
            await createExcelFiles();
        }
        
        await workbook.xlsx.readFile(USERS_EXCEL_FILE);
        const worksheet = workbook.getWorksheet(1); // Birinchi worksheet
        
        // Yangi ID aniqlash
        let newId = 1;
        if (worksheet.rowCount > 1) {
            newId = worksheet.rowCount;
        }
        
        // Yangi qator qo'shish
        worksheet.addRow({
            id: newId,
            chatId: chatId,
            username: userData.username || 'Noma\'lum',
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            joinedDate: new Date().toISOString()
        });
        
        await workbook.xlsx.writeFile(USERS_EXCEL_FILE);
        console.log(`✅ Yangi foydalanuvchi qo'shildi: ${chatId} (ID: ${newId})`);
        
        // Tekshirish uchun
        console.log(`📊 User faylda jami qatorlar: ${worksheet.rowCount}`);
        
        return true;
    } catch (error) {
        console.error('❌ Foydalanuvchini saqlashda xatolik:', error);
        return false;
    }
}

// Kontentni Excelga qo'shish
async function addContentToExcel(contentData, fileName) {
    try {
        console.log(`📦 Kontent saqlanmoqda: ${contentData.type} -> ${fileName}`);
        
        const workbook = new ExcelJS.Workbook();
        
        if (!fs.existsSync(fileName)) {
            await createExcelFiles();
        }
        
        await workbook.xlsx.readFile(fileName);
        const worksheet = workbook.getWorksheet(1); // Birinchi worksheet
        
        console.log(`📊 Worksheet nomi: ${worksheet.name}`);
        console.log(`📊 Mavjud qatorlar: ${worksheet.rowCount}`);
        
        // Yangi ID aniqlash
        let newId = 1;
        if (worksheet.rowCount > 1) {
            newId = worksheet.rowCount; // Header bor, shuning uchun rowCount = ID
        }
        
        // Yangi qator qo'shish
        const newRow = worksheet.addRow({
            id: newId,
            type: contentData.type,
            fileId: contentData.fileId || '',
            text: contentData.text || '',
            buttonText: contentData.buttonText || '',
            buttonUrl: contentData.buttonUrl || '',
            addedDate: new Date().toISOString()
        });
        
        console.log(`➕ Yangi qator qo'shildi: ID=${newId}, Type=${contentData.type}`);
        
        await workbook.xlsx.writeFile(fileName);
        console.log(`✅ Kontent saqlandi (ID: ${newId}, Type: ${contentData.type}) -> ${fileName}`);
        
        // Tekshirish uchun faylni qayta o'qish
        const verifyWorkbook = new ExcelJS.Workbook();
        await verifyWorkbook.xlsx.readFile(fileName);
        const verifyWorksheet = verifyWorkbook.getWorksheet(1);
        console.log(`📊 Tekshirish: ${fileName} da jami ${verifyWorksheet.rowCount} ta qator`);
        
        return { success: true, id: newId };
    } catch (error) {
        console.error('❌ Kontentni saqlashda xatolik:', error);
        console.error('Xato tafsilotlari:', error.message);
        console.error('Stack trace:', error.stack);
        return { success: false, error: error.message };
    }
}

// Barcha foydalanuvchilarni olish
async function getAllUsers() {
    try {
        if (!fs.existsSync(USERS_EXCEL_FILE)) {
            await createExcelFiles();
            return [];
        }
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(USERS_EXCEL_FILE);
        const worksheet = workbook.getWorksheet(1);
        
        console.log(`📖 Users faylda jami qatorlar: ${worksheet.rowCount}`);
        
        const users = [];
        
        // Headerdan tashqari barcha qatorlarni olish
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Header (1-qator) dan keyingilar
                const chatId = row.getCell(2).value; // 2-ustun: chatId
                if (chatId) {
                    users.push({
                        chatId: chatId,
                        username: row.getCell(3).value || 'Noma\'lum' // 3-ustun: username
                    });
                }
            }
        });
        
        console.log(`👥 Foydalanuvchilar soni: ${users.length}`);
        return users;
    } catch (error) {
        console.error('❌ Foydalanuvchilarni olishda xatolik:', error);
        return [];
    }
}

// Kontentlarni olish
async function getAllContent(fileName) {
    try {
        console.log(`📖 Kontentlar olinmoqda: ${fileName}`);
        
        if (!fs.existsSync(fileName)) {
            await createExcelFiles();
            return [];
        }
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(fileName);
        const worksheet = workbook.getWorksheet(1);
        
        console.log(`📊 ${fileName} da jami qatorlar: ${worksheet.rowCount}`);
        
        const content = [];
        
        // Headerdan tashqari barcha qatorlarni olish
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Header (1-qator) dan keyingilar
                const id = row.getCell(1).value; // 1-ustun: ID
                if (id && id !== 'ID') { // Header emasligini tekshirish
                    content.push({
                        id: id,
                        type: row.getCell(2).value, // 2-ustun: Type
                        fileId: row.getCell(3).value, // 3-ustun: File ID
                        text: row.getCell(4).value, // 4-ustun: Text
                        buttonText: row.getCell(5).value, // 5-ustun: Button Text
                        buttonUrl: row.getCell(6).value, // 6-ustun: Button URL
                        addedDate: row.getCell(7).value // 7-ustun: Added Date
                    });
                }
            }
        });
        
        console.log(`📦 Kontentlar soni (${fileName}): ${content.length}`);
        
        // Kontentlarni console'da ko'rsatish
        if (content.length > 0) {
            console.log('📋 Saqlangan kontentlar:');
            content.forEach(item => {
                console.log(`   ID: ${item.id}, Type: ${item.type}, FileID: ${item.fileId ? item.fileId.substring(0, 20) + '...' : 'Yo\'q'}`);
            });
        }
        
        return content;
    } catch (error) {
        console.error(`❌ Kontentlarni olishda xatolik (${fileName}):`, error);
        return [];
    }
}

// Broadcast jo'natish
async function sendBroadcastToAllUsers(broadcastData, ctx) {
    try {
        const users = await getAllUsers();
        
        if (users.length === 0) {
            await ctx.reply('❌ Hozircha foydalanuvchilar mavjud emas!');
            return { success: false };
        }
        
        await ctx.reply(`📤 ${users.length} ta foydalanuvchiga jo'natilmoqda...`);
        
        let successCount = 0;
        let errorCount = 0;
        
        const keyboard = broadcastData.buttonText && broadcastData.buttonUrl ? 
            Markup.inlineKeyboard([[Markup.button.url(broadcastData.buttonText, broadcastData.buttonUrl)]]) : null;
        
        for (const user of users) {
            try {
                if (broadcastData.type === 'video_note') {
                    await bot.telegram.sendVideoNote(user.chatId, broadcastData.fileId);
                } else if (broadcastData.type === 'video') {
                    await bot.telegram.sendVideo(user.chatId, broadcastData.fileId);
                } else if (broadcastData.type === 'photo') {
                    await bot.telegram.sendPhoto(user.chatId, broadcastData.fileId, {
                        caption: broadcastData.text || '',
                        ...keyboard
                    });
                } else if (broadcastData.type === 'text') {
                    await bot.telegram.sendMessage(user.chatId, broadcastData.text, keyboard || {});
                }
                
                successCount++;
                
                // Telegram limitlari uchun kutish
                if (successCount % 20 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ ${user.chatId}: ${error.message}`);
            }
        }
        
        console.log(`📤 Broadcast tugadi: ${successCount} ta muvaffaqiyatli, ${errorCount} ta xatolik`);
        
        return { 
            success: true, 
            sent: successCount, 
            errors: errorCount 
        };
        
    } catch (error) {
        console.error('❌ Broadcast jo\'natishda xatolik:', error);
        return { success: false, error: error.message };
    }
}

// /start komandasi
bot.start(async (ctx) => {
    try {
        const chatId = ctx.chat.id;
        const userData = {
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name
        };
        
        console.log(`🚀 /start: ${chatId}, ${userData.username || 'Noma\'lum'}`);
        
        // Foydalanuvchini qo'shish
        await addUserToExcel(chatId, userData);
        
        // Kontentlarni olish
        const allContent = await getAllContent(START_CONTENT_FILE);
        
        if (allContent.length === 0) {
            await ctx.reply('👋 Assalomu alaykum! Botga xush kelibsiz!\n\n⚠️ Hozircha hech qanday kontent mavjud emas.\n\nAdmin: /login admin admin123');
            return;
        }
        
        await ctx.reply(`👋 Assalomu alaykum, ${ctx.from.first_name || 'do\'stim'}!\n\n📦 ${allContent.length} ta kontent jo'natilmoqda...\n⏱ Har biri orasida 5 soniya`);
        
        // Kontentlarni ketma-ket jo'natish
        for (let i = 0; i < allContent.length; i++) {
            const item = allContent[i];
            
            try {
                console.log(`📤 Jo'natilmoqda: ${item.type} (${i+1}/${allContent.length})`);
                
                const keyboard = item.buttonText && item.buttonUrl ? 
                    Markup.inlineKeyboard([[Markup.button.url(item.buttonText, item.buttonUrl)]]) : null;
                
                if (item.type === 'video_note' && item.fileId) {
                    await ctx.replyWithVideoNote(item.fileId);
                } else if (item.type === 'video' && item.fileId) {
                    await ctx.replyWithVideo(item.fileId);
                } else if (item.type === 'photo' && item.fileId) {
                    await ctx.replyWithPhoto(item.fileId, {
                        caption: item.text || '',
                        ...keyboard
                    });
                } else if (item.type === 'text_button' && item.text) {
                    await ctx.reply(item.text, keyboard || {});
                } else if (item.type === 'text' && item.text) {
                    await ctx.reply(item.text);
                }
                
                // 5 soniya kutish
                if (i < allContent.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } catch (error) {
                console.error(`❌ ${item.type} jo'natishda xatolik:`, error.message);
            }
        }
        
        await ctx.reply('✅ Barcha kontentlar jo\'natildi! Yana /start boshing.');
        
    } catch (error) {
        console.error('❌ /start xatolik:', error);
        await ctx.reply('❌ Xatolik yuz berdi. Keyinroq urinib ko\'ring.');
    }
});

// Admin login
bot.command('login', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');
        if (args.length !== 3) {
            return ctx.reply('⚠️ Format: /login admin admin123');
        }
        
        const login = args[1];
        const password = args[2];
        
        if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
            adminUsers[ctx.chat.id] = true;
            
            await ctx.reply('✅ **Admin paneliga xush kelibsiz!**', {
                parse_mode: 'Markdown',
                ...Markup.keyboard([
                    ['📹 START Video', '📝 START Post'],
                    ['🔔 Broadcast Video', '📢 Broadcast Post'],
                    ['📊 Statistika', '📋 Kontentlar'],
                    ['🗑️ Tozalash', '🚪 Chiqish']
                ]).resize()
            });
            
            console.log(`🔐 Admin kirish: ${ctx.chat.id}`);
            
        } else {
            await ctx.reply('❌ Noto\'g\'ri login yoki parol!');
        }
    } catch (error) {
        console.error('❌ Login xatolik:', error);
        await ctx.reply('❌ Xatolik yuz berdi.');
    }
});

// START Video qo'shish
bot.hears('📹 START Video', async (ctx) => {
    if (!adminUsers[ctx.chat.id]) {
        return ctx.reply('⚠️ Avval tizimga kiring: /login admin admin123');
    }
    
    await ctx.reply('📹 **START uchun video qo\'shish:**\n\nVideo note yoki oddiy videoni yuboring:', {
        parse_mode: 'Markdown'
    });
    
    userSessions[ctx.chat.id] = { action: 'add_start_video' };
});

// START Post yaratish
bot.hears('📝 START Post', async (ctx) => {
    if (!adminUsers[ctx.chat.id]) {
        return ctx.reply('⚠️ Avval tizimga kiring: /login admin admin123');
    }
    
    await ctx.reply('📝 **START uchun post yaratish:**\n\nMatn yuboring:', {
        parse_mode: 'Markdown'
    });
    
    userSessions[ctx.chat.id] = { action: 'add_start_post_text' };
});

// Broadcast Video
bot.hears('🔔 Broadcast Video', async (ctx) => {
    if (!adminUsers[ctx.chat.id]) {
        return ctx.reply('⚠️ Avval tizimga kiring: /login admin admin123');
    }
    
    await ctx.reply('🔔 **Broadcast uchun video:**\n\nVideo yuboring (darhol barchaga jo\'natiladi):', {
        parse_mode: 'Markdown'
    });
    
    userSessions[ctx.chat.id] = { action: 'add_broadcast_video' };
});

// Broadcast Post
bot.hears('📢 Broadcast Post', async (ctx) => {
    if (!adminUsers[ctx.chat.id]) {
        return ctx.reply('⚠️ Avval tizimga kiring: /login admin admin123');
    }
    
    await ctx.reply('📢 **Broadcast uchun post:**\n\nMatn yuboring (darhol barchaga jo\'natiladi):', {
        parse_mode: 'Markdown'
    });
    
    userSessions[ctx.chat.id] = { action: 'add_broadcast_post_text' };
});

// Statistika
bot.hears('📊 Statistika', async (ctx) => {
    if (!adminUsers[ctx.chat.id]) {
        return ctx.reply('⚠️ Avval tizimga kiring: /login admin admin123');
    }
    
    try {
        const users = await getAllUsers();
        const startContent = await getAllContent(START_CONTENT_FILE);
        const broadcastContent = await getAllContent(BROADCAST_CONTENT_FILE);
        
        let message = `📊 **Bot Statistika**\n\n`;
        message += `👥 **Foydalanuvchilar:** ${users.length} ta\n\n`;
        message += `📦 **START kontentlar:** ${startContent.length} ta\n`;
        
        // Kontent turlari
        const types = {};
        startContent.forEach(item => {
            types[item.type] = (types[item.type] || 0) + 1;
        });
        
        for (const [type, count] of Object.entries(types)) {
            const emoji = type === 'video_note' ? '📹' :
                         type === 'video' ? '🎬' :
                         type === 'photo' ? '📸' :
                         type === 'text_button' ? '📝🔗' : '📝';
            message += `   ${emoji} ${type}: ${count} ta\n`;
        }
        
        message += `\n📤 **BROADCAST kontentlar:** ${broadcastContent.length} ta\n`;
        message += `\n⏰ **Oxirgi yangilanish:** ${new Date().toLocaleString('uz-UZ')}`;
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('❌ Statistika xatolik:', error);
        await ctx.reply('❌ Statistika olishda xatolik!');
    }
});

// Kontentlar ro'yxati
bot.hears('📋 Kontentlar', async (ctx) => {
    if (!adminUsers[ctx.chat.id]) {
        return ctx.reply('⚠️ Avval tizimga kiring: /login admin admin123');
    }
    
    try {
        const startContent = await getAllContent(START_CONTENT_FILE);
        const broadcastContent = await getAllContent(BROADCAST_CONTENT_FILE);
        
        if (startContent.length === 0 && broadcastContent.length === 0) {
            return ctx.reply('📭 Hozircha kontentlar mavjud emas.');
        }
        
        let message = `📋 **Kontentlar ro'yxati**\n\n`;
        
        if (startContent.length > 0) {
            message += `📦 **START (${startContent.length} ta):**\n`;
            startContent.forEach((item, index) => {
                const typeEmoji = item.type === 'video_note' ? '📹' :
                                 item.type === 'video' ? '🎬' :
                                 item.type === 'photo' ? '📸' :
                                 item.type === 'text_button' ? '📝🔗' : '📝';
                
                const date = new Date(item.addedDate).toLocaleDateString('uz-UZ');
                message += `${index + 1}. ${typeEmoji} ${item.type} (${date})\n`;
            });
            message += '\n';
        }
        
        if (broadcastContent.length > 0) {
            message += `📤 **BROADCAST (${broadcastContent.length} ta):**\n`;
            broadcastContent.forEach((item, index) => {
                const typeEmoji = item.type === 'video_note' ? '📹' :
                                 item.type === 'video' ? '🎬' :
                                 item.type === 'photo' ? '📸' :
                                 item.type === 'text_button' ? '📝🔗' : '📝';
                
                const date = new Date(item.addedDate).toLocaleDateString('uz-UZ');
                message += `${index + 1}. ${typeEmoji} ${item.type} (${date})\n`;
            });
        }
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('❌ Kontentlar ro\'yxati xatolik:', error);
        await ctx.reply('❌ Kontentlarni olishda xatolik!');
    }
});

// Tozalash
bot.hears('🗑️ Tozalash', async (ctx) => {
    if (!adminUsers[ctx.chat.id]) {
        return ctx.reply('⚠️ Avval tizimga kiring: /login admin admin123');
    }
    
    await ctx.reply('⚠️ Qaysi kontentlarni tozalamoqchisiz?', {
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📦 START kontentlari', 'clear_start')],
            [Markup.button.callback('📤 BROADCAST kontentlari', 'clear_broadcast')],
            [Markup.button.callback('👥 Foydalanuvchilar', 'clear_users')],
            [Markup.button.callback('❌ Bekor qilish', 'cancel')]
        ])
    });
});

// Chiqish
bot.hears('🚪 Chiqish', async (ctx) => {
    delete adminUsers[ctx.chat.id];
    delete userSessions[ctx.chat.id];
    await ctx.reply('👋 Admin paneldan chiqdingiz.', Markup.removeKeyboard());
});

// Callback handlers
bot.action('clear_start', async (ctx) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Content');
        
        worksheet.columns = [
            { header: 'ID', key: 'id' },
            { header: 'Type', key: 'type' },
            { header: 'File ID', key: 'fileId' },
            { header: 'Text', key: 'text' },
            { header: 'Button Text', key: 'buttonText' },
            { header: 'Button URL', key: 'buttonUrl' },
            { header: 'Added Date', key: 'addedDate' }
        ];
        
        // Header qo'shish
        worksheet.addRow({
            id: 'ID',
            type: 'Type',
            fileId: 'File ID',
            text: 'Text',
            buttonText: 'Button Text',
            buttonUrl: 'Button URL',
            addedDate: 'Added Date'
        });
        
        await workbook.xlsx.writeFile(START_CONTENT_FILE);
        await ctx.reply('✅ START kontentlari tozalandi!');
        console.log('🗑️ START kontentlari tozalandi');
    } catch (error) {
        console.error('❌ Tozalash xatolik:', error);
        await ctx.reply('❌ Xatolik!');
    }
    await ctx.answerCbQuery();
});

bot.action('clear_broadcast', async (ctx) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Content');
        
        worksheet.columns = [
            { header: 'ID', key: 'id' },
            { header: 'Type', key: 'type' },
            { header: 'File ID', key: 'fileId' },
            { header: 'Text', key: 'text' },
            { header: 'Button Text', key: 'buttonText' },
            { header: 'Button URL', key: 'buttonUrl' },
            { header: 'Added Date', key: 'addedDate' }
        ];
        
        // Header qo'shish
        worksheet.addRow({
            id: 'ID',
            type: 'Type',
            fileId: 'File ID',
            text: 'Text',
            buttonText: 'Button Text',
            buttonUrl: 'Button URL',
            addedDate: 'Added Date'
        });
        
        await workbook.xlsx.writeFile(BROADCAST_CONTENT_FILE);
        await ctx.reply('✅ BROADCAST kontentlari tozalandi!');
        console.log('🗑️ BROADCAST kontentlari tozalandi');
    } catch (error) {
        console.error('❌ Tozalash xatolik:', error);
        await ctx.reply('❌ Xatolik!');
    }
    await ctx.answerCbQuery();
});

bot.action('clear_users', async (ctx) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');
        
        worksheet.columns = [
            { header: 'ID', key: 'id' },
            { header: 'Chat ID', key: 'chatId' },
            { header: 'Username', key: 'username' },
            { header: 'First Name', key: 'firstName' },
            { header: 'Last Name', key: 'lastName' },
            { header: 'Joined Date', key: 'joinedDate' }
        ];
        
        // Header qo'shish
        worksheet.addRow({
            id: 'ID',
            chatId: 'Chat ID',
            username: 'Username',
            firstName: 'First Name',
            lastName: 'Last Name',
            joinedDate: 'Joined Date'
        });
        
        await workbook.xlsx.writeFile(USERS_EXCEL_FILE);
        await ctx.reply('✅ Foydalanuvchilar tozalandi!');
        console.log('🗑️ Foydalanuvchilar tozalandi');
    } catch (error) {
        console.error('❌ Tozalash xatolik:', error);
        await ctx.reply('❌ Xatolik!');
    }
    await ctx.answerCbQuery();
});

bot.action('cancel', async (ctx) => {
    await ctx.reply('❌ Bekor qilindi.');
    await ctx.answerCbQuery();
});

// Video note handler
bot.on('video_note', async (ctx) => {
    const chatId = ctx.chat.id;
    const session = userSessions[chatId];
    
    if (!session) return;
    
    const fileId = ctx.message.video_note.file_id;
    console.log(`📹 Video note qabul qilindi: ${fileId.substring(0, 30)}...`);
    
    if (session.action === 'add_start_video') {
        const result = await addContentToExcel({
            type: 'video_note',
            fileId: fileId,
            text: '',
            adminChatId: chatId
        }, START_CONTENT_FILE);
        
        if (result.success) {
            delete userSessions[chatId];
            await ctx.reply('✅ Video note START ga qo\'shildi!');
        } else {
            await ctx.reply('❌ Xatolik! Video saqlanmadi.');
        }
    } else if (session.action === 'add_broadcast_video') {
        const broadcastData = {
            type: 'video_note',
            fileId: fileId
        };
        
        // Broadcast jo'natish
        const broadcastResult = await sendBroadcastToAllUsers(broadcastData, ctx);
        
        if (broadcastResult.success) {
            // Saqlash
            await addContentToExcel({
                type: 'video_note',
                fileId: fileId,
                text: '',
                adminChatId: chatId
            }, BROADCAST_CONTENT_FILE);
            
            delete userSessions[chatId];
            await ctx.reply(`✅ Broadcast muvaffaqiyatli!\n\n✅ Yuborildi: ${broadcastResult.sent} ta\n❌ Xatolar: ${broadcastResult.errors} ta`);
        } else {
            await ctx.reply('❌ Broadcast jo\'natishda xatolik!');
        }
    }
});

// Video handler
bot.on('video', async (ctx) => {
    const chatId = ctx.chat.id;
    const session = userSessions[chatId];
    
    if (!session) return;
    
    const fileId = ctx.message.video.file_id;
    console.log(`🎬 Video qabul qilindi: ${fileId.substring(0, 30)}...`);
    
    if (session.action === 'add_start_video') {
        const result = await addContentToExcel({
            type: 'video',
            fileId: fileId,
            text: '',
            adminChatId: chatId
        }, START_CONTENT_FILE);
        
        if (result.success) {
            delete userSessions[chatId];
            await ctx.reply('✅ Video START ga qo\'shildi!');
        } else {
            await ctx.reply('❌ Xatolik! Video saqlanmadi.');
        }
    } else if (session.action === 'add_broadcast_video') {
        const broadcastData = {
            type: 'video',
            fileId: fileId
        };
        
        // Broadcast jo'natish
        const broadcastResult = await sendBroadcastToAllUsers(broadcastData, ctx);
        
        if (broadcastResult.success) {
            // Saqlash
            await addContentToExcel({
                type: 'video',
                fileId: fileId,
                text: '',
                adminChatId: chatId
            }, BROADCAST_CONTENT_FILE);
            
            delete userSessions[chatId];
            await ctx.reply(`✅ Broadcast muvaffaqiyatli!\n\n✅ Yuborildi: ${broadcastResult.sent} ta\n❌ Xatolar: ${broadcastResult.errors} ta`);
        } else {
            await ctx.reply('❌ Broadcast jo\'natishda xatolik!');
        }
    }
});

// Photo handler
bot.on('photo', async (ctx) => {
    const chatId = ctx.chat.id;
    const session = userSessions[chatId];
    
    if (!session || session.action !== 'add_broadcast_video') return;
    
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const caption = ctx.message.caption || '';
    console.log(`📸 Rasm qabul qilindi: ${fileId.substring(0, 30)}...`);
    
    const broadcastData = {
        type: 'photo',
        fileId: fileId,
        text: caption
    };
    
    // Broadcast jo'natish
    const broadcastResult = await sendBroadcastToAllUsers(broadcastData, ctx);
    
    if (broadcastResult.success) {
        // Saqlash
        await addContentToExcel({
            type: 'photo',
            fileId: fileId,
            text: caption,
            adminChatId: chatId
        }, BROADCAST_CONTENT_FILE);
        
        delete userSessions[chatId];
        await ctx.reply(`✅ Broadcast muvaffaqiyatli!\n\n✅ Yuborildi: ${broadcastResult.sent} ta\n❌ Xatolar: ${broadcastResult.errors} ta`);
    } else {
        await ctx.reply('❌ Broadcast jo\'natishda xatolik!');
    }
});

// Text handler
bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    const session = userSessions[chatId];
    
    if (!session) return;
    
    const text = ctx.message.text;
    
    // START Post
    if (session.action === 'add_start_post_text') {
        userSessions[chatId].postText = text;
        await ctx.reply('✅ Matn saqlandi!\n\nTugma qo\'shmoqchimisiz?', {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('➕ Ha, tugma qo\'shish', 'add_button_start')],
                [Markup.button.callback('❌ Yo\'q, saqlash', 'save_post_start')]
            ])
        });
        return;
    }
    
    // START Button text
    if (session.action === 'add_start_button_text') {
        userSessions[chatId].buttonText = text;
        await ctx.reply('🔗 Endi URL manzilini yuboring:');
        userSessions[chatId].action = 'add_start_button_url';
        return;
    }
    
    // START Button URL
    if (session.action === 'add_start_button_url') {
        const result = await addContentToExcel({
            type: 'text_button',
            fileId: '',
            text: session.postText,
            buttonText: session.buttonText,
            buttonUrl: text,
            adminChatId: chatId
        }, START_CONTENT_FILE);
        
        if (result.success) {
            delete userSessions[chatId];
            await ctx.reply('✅ Post START ga qo\'shildi!');
        } else {
            await ctx.reply('❌ Xatolik!');
        }
        return;
    }
    
    // BROADCAST Post
    if (session.action === 'add_broadcast_post_text') {
        userSessions[chatId].postText = text;
        await ctx.reply('✅ Matn saqlandi!\n\nTugma qo\'shmoqchimisiz?', {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('➕ Ha, tugma qo\'shish', 'add_button_broadcast')],
                [Markup.button.callback('❌ Yo\'q, hozir yuborish', 'send_text_broadcast')]
            ])
        });
        return;
    }
    
    // BROADCAST Button text
    if (session.action === 'add_broadcast_button_text') {
        userSessions[chatId].buttonText = text;
        await ctx.reply('🔗 Endi URL manzilini yuboring:');
        userSessions[chatId].action = 'add_broadcast_button_url';
        return;
    }
    
    // BROADCAST Button URL
    if (session.action === 'add_broadcast_button_url') {
        const broadcastData = {
            type: 'text',
            text: session.postText,
            buttonText: session.buttonText,
            buttonUrl: text
        };
        
        // Broadcast jo'natish
        const broadcastResult = await sendBroadcastToAllUsers(broadcastData, ctx);
        
        if (broadcastResult.success) {
            // Saqlash
            await addContentToExcel({
                type: 'text',
                fileId: '',
                text: session.postText,
                buttonText: session.buttonText,
                buttonUrl: text,
                adminChatId: chatId
            }, BROADCAST_CONTENT_FILE);
            
            delete userSessions[chatId];
            await ctx.reply(`✅ Broadcast muvaffaqiyatli!\n\n✅ Yuborildi: ${broadcastResult.sent} ta\n❌ Xatolar: ${broadcastResult.errors} ta`);
        } else {
            await ctx.reply('❌ Broadcast jo\'natishda xatolik!');
        }
        return;
    }
});

// Button callbacks
bot.action('add_button_start', async (ctx) => {
    await ctx.reply('📝 Tugma matnini yuboring:');
    userSessions[ctx.chat.id].action = 'add_start_button_text';
    await ctx.answerCbQuery();
});

bot.action('save_post_start', async (ctx) => {
    const chatId = ctx.chat.id;
    const session = userSessions[chatId];
    
    const result = await addContentToExcel({
        type: 'text',
        fileId: '',
        text: session.postText,
        buttonText: '',
        buttonUrl: '',
        adminChatId: chatId
    }, START_CONTENT_FILE);
    
    if (result.success) {
        delete userSessions[chatId];
        await ctx.reply('✅ Post START ga qo\'shildi!');
    } else {
        await ctx.reply('❌ Xatolik!');
    }
    
    await ctx.answerCbQuery();
});

bot.action('add_button_broadcast', async (ctx) => {
    await ctx.reply('📝 Tugma matnini yuboring:');
    userSessions[ctx.chat.id].action = 'add_broadcast_button_text';
    await ctx.answerCbQuery();
});

bot.action('send_text_broadcast', async (ctx) => {
    const chatId = ctx.chat.id;
    const session = userSessions[chatId];
    
    const broadcastData = {
        type: 'text',
        text: session.postText
    };
    
    // Broadcast jo'natish
    const broadcastResult = await sendBroadcastToAllUsers(broadcastData, ctx);
    
    if (broadcastResult.success) {
        // Saqlash
        await addContentToExcel({
            type: 'text',
            fileId: '',
            text: session.postText,
            buttonText: '',
            buttonUrl: '',
            adminChatId: chatId
        }, BROADCAST_CONTENT_FILE);
        
        delete userSessions[chatId];
        await ctx.reply(`✅ Broadcast muvaffaqiyatli!\n\n✅ Yuborildi: ${broadcastResult.sent} ta\n❌ Xatolar: ${broadcastResult.errors} ta`);
    } else {
        await ctx.reply('❌ Broadcast jo\'natishda xatolik!');
    }
    
    await ctx.answerCbQuery();
});

// Botni ishga tushirish
async function startBot() {
    try {
        console.log('🚀 Bot ishga tushmoqda...');
        
        // Avval barcha Excel fayllarni o'chirib yuborish
        try {
            if (fs.existsSync(USERS_EXCEL_FILE)) fs.unlinkSync(USERS_EXCEL_FILE);
            if (fs.existsSync(START_CONTENT_FILE)) fs.unlinkSync(START_CONTENT_FILE);
            if (fs.existsSync(BROADCAST_CONTENT_FILE)) fs.unlinkSync(BROADCAST_CONTENT_FILE);
            console.log('🗑️ Eski Excel fayllari o\'chirildi');
        } catch (error) {
            console.log('ℹ️ Fayllar o\'chirilmadi, ehtimol ular yo\'q');
        }
        
        // Excel fayllarni yaratish
        await createExcelFiles();
        
        // Boshlang'ich holat
        const startContent = (await getAllContent(START_CONTENT_FILE)).length;
        const broadcastContent = (await getAllContent(BROADCAST_CONTENT_FILE)).length;
        const userCount = (await getAllUsers()).length;
        
        console.log('\n📊 **DASTUR HOLATI:**');
        console.log(`   👥 Foydalanuvchilar: ${userCount} ta`);
        console.log(`   📦 START kontentlar: ${startContent} ta`);
        console.log(`   📤 BROADCAST kontentlar: ${broadcastContent} ta`);
        
        console.log('\n⚙️ **QANDAY ISHLATISH:**');
        console.log('1. /login admin admin123 - Admin panelga kirish');
        console.log('2. "📹 START Video" - /start uchun video');
        console.log('3. "📝 START Post" - /start uchun post');
        console.log('4. "🔔 Broadcast Video" - Barchaga video');
        console.log('5. "📢 Broadcast Post" - Barchaga post');
        console.log('6. "📊 Statistika" - Bot holati');
        console.log('7. "📋 Kontentlar" - Kontentlar ro\'yxati');
        console.log('8. "🗑️ Tozalash" - Kontentlarni tozalash');
        console.log('9. "🚪 Chiqish" - Admin paneldan chiqish\n');
        
        console.log('⚠️ **DIQQAT:** Agar Excel fayllarda muammo bo\'lsa, botni qayta ishga tushiring');
        
        // Botni ishga tushirish
        await bot.launch();
        console.log('🤖 ✅ Bot ishga tushdi!\n');
        
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
        
    } catch (error) {
        console.error('❌ Botni ishga tushirishda xatolik:', error);
    }
}

// Botni ishga tushirish
startBot();