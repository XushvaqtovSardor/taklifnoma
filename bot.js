import { Markup, Telegraf } from "telegraf";
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import keepAlive from "./keep-alive.js";
import "./server.js"; // Web server Render uchun

const bot = new Telegraf(process.env.bot_token);
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

// MongoDB ulanish
let isMongoConnected = false;
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      console.log("✅ MongoDB ulanish muvaffaqiyatli!");
      isMongoConnected = true;
    })
    .catch((err) => {
      console.log("❌ MongoDB xato:", err.message);
      console.log("⚠️ JSON fayl ishlatiladi");
      isMongoConnected = false;
    });
}

// MongoDB Schemas
const InvitationSchema = new mongoose.Schema({
  invId: String,
  message: String,
  photo: String,
  videoUrl: String,
  createdAt: { type: Date, default: Date.now },
});

const ResponseSchema = new mongoose.Schema({
  invId: String,
  userId: Number,
  response: String,
  username: String,
  name: String,
  timestamp: { type: Date, default: Date.now },
});

const Invitation = mongoose.model("Invitation", InvitationSchema);
const Response = mongoose.model("Response", ResponseSchema);

// Ma'lumotlar fayllari (backup uchun)
const DATA_DIR = "./data";
const INVITATIONS_FILE = path.join(DATA_DIR, "invitations.json");
const RESPONSES_FILE = path.join(DATA_DIR, "responses.json");
const CURRENT_FILE = path.join(DATA_DIR, "current.json");

// Data papkani yaratish
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ma'lumotlarni yuklash (JSON dan)
function loadDataFromFile() {
  try {
    const invitations = fs.existsSync(INVITATIONS_FILE)
      ? JSON.parse(fs.readFileSync(INVITATIONS_FILE, "utf8"))
      : {};
    const responses = fs.existsSync(RESPONSES_FILE)
      ? JSON.parse(fs.readFileSync(RESPONSES_FILE, "utf8"))
      : {};
    const current = fs.existsSync(CURRENT_FILE)
      ? JSON.parse(fs.readFileSync(CURRENT_FILE, "utf8"))
      : null;
    return { invitations, responses, current };
  } catch (error) {
    console.log("⚠️ Ma'lumotlarni yuklashda xato:", error.message);
    return { invitations: {}, responses: {}, current: null };
  }
}

// Ma'lumotlarni saqlash (JSON ga)
function saveInvitationsToFile(invitations) {
  try {
    fs.writeFileSync(INVITATIONS_FILE, JSON.stringify(invitations, null, 2));
  } catch (error) {
    console.log("⚠️ Invitations saqlashda xato:", error.message);
  }
}

function saveResponsesToFile(responses) {
  try {
    fs.writeFileSync(RESPONSES_FILE, JSON.stringify(responses, null, 2));
  } catch (error) {
    console.log("⚠️ Responses saqlashda xato:", error.message);
  }
}

function saveCurrentToFile(invitation) {
  try {
    fs.writeFileSync(CURRENT_FILE, JSON.stringify(invitation, null, 2));
  } catch (error) {
    console.log("⚠️ Current saqlashda xato:", error.message);
  }
}

// Ma'lumotlarni yuklash
const data = loadDataFromFile();
const invitations = data.invitations;
const responses = data.responses;
let currentInvitation = data.current;

// Admin panel
function showAdminMenu(ctx) {
  ctx.reply(
    "👨‍💼 Admin Panel",
    Markup.keyboard([
      ["➕ Taklifnoma yaratish"],
      ["📊 Statistika", "📋 Ro'yxat"],
    ]).resize()
  );
}

// Start komandasi
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  // Admin uchun
  if (userId === ADMIN_ID) {
    return showAdminMenu(ctx);
  }

  // Oddiy foydalanuvchi uchun - taklifnomani ko'rsatish
  if (currentInvitation) {
    await showInvitationToGuest(ctx, currentInvitation);
  } else {
    ctx.reply("🎉 Salom! Hozircha taklifnoma yo'q.");
  }
});

// Taklifnomani mehmonlarga ko'rsatish
async function showInvitationToGuest(ctx, invitation) {
  const userId = ctx.from.id;

  const buttons = [
    [
      Markup.button.callback("✅ Ha, kelaman!", "response_yes"),
      Markup.button.callback("❌ Yo'q, kela olmayman", "response_no"),
    ],
  ];

  // Agar video bo'lsa, tugma qo'shamiz
  if (invitation.videoUrl) {
    buttons.push([Markup.button.url("🎥 Video ko'rish", invitation.videoUrl)]);
  }

  // Agar rasm bo'lsa
  if (invitation.photo) {
    await ctx.replyWithPhoto(invitation.photo, {
      caption: invitation.message,
      ...Markup.inlineKeyboard(buttons),
    });
  } else {
    // Faqat matn
    await ctx.reply(invitation.message, Markup.inlineKeyboard(buttons));
  }
}

// ========================================
// ADMIN: Statistika
// ========================================

bot.hears("📊 Statistika", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  if (!currentInvitation) {
    return ctx.reply("Hozircha taklifnoma yo'q.");
  }

  const invId = currentInvitation.invId;
  const responseList = responses[invId] || {};

  const yesCount = Object.values(responseList).filter(
    (r) => r.response === "yes"
  ).length;
  const noCount = Object.values(responseList).filter(
    (r) => r.response === "no"
  ).length;
  const totalCount = yesCount + noCount;

  let message = "📊 STATISTIKA\n\n";
  message += `✅ Keladi: ${yesCount} kishi\n`;
  message += `❌ Kelmaydi: ${noCount} kishi\n`;
  message += `📝 Jami javob: ${totalCount} kishi\n\n`;

  message += "✅ KELADIGANLAR:\n";
  Object.values(responseList)
    .filter((r) => r.response === "yes")
    .forEach((r, i) => {
      message += `${i + 1}. ${r.name} (@${r.username || "yo'q"})\n`;
    });

  message += "\n❌ KELMAGANLAR:\n";
  Object.values(responseList)
    .filter((r) => r.response === "no")
    .forEach((r, i) => {
      message += `${i + 1}. ${r.name} (@${r.username || "yo'q"})\n`;
    });

  ctx.reply(message);
});

// ========================================
// ADMIN: Ro'yxat
// ========================================

bot.hears("📋 Ro'yxat", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const invList = Object.values(invitations);

  if (invList.length === 0) {
    return ctx.reply("Hozircha taklifnomalar yo'q.");
  }

  let message = "📋 TAKLIFNOMALAR RO'YXATI:\n\n";
  invList.forEach((inv, i) => {
    const responseCount = Object.keys(responses[inv.invId] || {}).length;
    message += `${i + 1}. ID: ${inv.invId}\n`;
    message += `   📅 ${new Date(inv.createdAt).toLocaleDateString()}\n`;
    message += `   👥 Javoblar: ${responseCount}\n\n`;
  });

  ctx.reply(message);
});

// ========================================
// ADMIN: Taklifnoma yaratish
// ========================================
const adminStates = {};

bot.hears("➕ Taklifnoma yaratish", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  adminStates[ADMIN_ID] = { step: "choose_type" };

  ctx.reply(
    "Taklifnoma turini tanlang:",
    Markup.inlineKeyboard([
      [Markup.button.callback("📝 Faqat matn", "create_text")],
      [Markup.button.callback("🖼 Rasm bilan", "create_photo")],
    ])
  );
});

// Faqat matn tanlandi
bot.action("create_text", async (ctx) => {
  await ctx.answerCbQuery();
  adminStates[ADMIN_ID] = { step: "enter_text", usePhoto: false };

  ctx.reply(
    "📝 Taklifnoma matnini yuboring:\n\n" +
      "Masalan:\n" +
      "💑 Aziz do'stlarimiz!\n\n" +
      "Sizni nikoh to'yimizga taklif qilamiz!\n\n" +
      "👰 Kelin: Malika\n" +
      "🤵 Kuyov: Javohir\n\n" +
      "📅 Sana: 15-Dekabr 2025\n" +
      "🕐 Vaqt: 18:00\n" +
      "📍 Manzil: Grand Palace"
  );
});

// Rasm bilan tanlandi
bot.action("create_photo", async (ctx) => {
  await ctx.answerCbQuery();
  adminStates[ADMIN_ID] = { step: "enter_photo", usePhoto: true };

  ctx.reply("🖼 Taklifnoma rasmini yuboring:");
});

// Rasm qabul qilish
bot.on("photo", async (ctx) => {
  const state = adminStates[ADMIN_ID];
  if (!state || state.step !== "enter_photo") return;

  const photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  state.photo = photo;
  state.step = "enter_caption";

  ctx.reply(
    "✅ Rasm qabul qilindi!\n\n" +
      "📝 Endi taklifnoma matnini yuboring:\n\n" +
      "Masalan:\n" +
      "💑 Aziz do'stlarimiz!\n\n" +
      "Sizni nikoh to'yimizga taklif qilamiz!\n\n" +
      "👰 Kelin: Malika\n" +
      "🤵 Kuyov: Javohir\n\n" +
      "📅 Sana: 15-Dekabr 2025\n" +
      "🕐 Vaqt: 18:00\n" +
      "📍 Manzil: Grand Palace"
  );
});

// Matn qabul qilish
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = adminStates[userId];

  if (!state) return;

  const text = ctx.message.text;

  // Taklifnoma matni
  if (state.step === "enter_text" || state.step === "enter_caption") {
    state.message = text;
    state.step = "ask_video";

    ctx.reply(
      "🎥 YouTube video linkini qo'shmoqchimisiz?\n\n" +
        "✅ Video link yuboring (masalan: https://youtu.be/abc123)\n" +
        "❌ Yoki 'O'tkazib yuborish' tugmasini bosing",
      Markup.inlineKeyboard([
        [Markup.button.callback("⏭️ O'tkazib yuborish", "skip_video")],
      ])
    );

    // Video kutish holatiga o'tish
    state.step = "enter_video";
  } else if (state.step === "enter_video") {
    // YouTube link tekshirish
    const youtubeRegex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = text.match(youtubeRegex);

    if (match) {
      state.videoUrl = text;
      await createInvitation(ctx, state);
    } else {
      ctx.reply(
        "❌ Noto'g'ri YouTube link!\n\n" +
          "To'g'ri format:\n" +
          "• https://youtube.com/watch?v=abc123\n" +
          "• https://youtu.be/abc123\n\n" +
          "Qaytadan yuboring yoki 'O'tkazib yuborish' tugmasini bosing."
      );
    }
  }
});

// Video o'tkazib yuborish
bot.action("skip_video", async (ctx) => {
  await ctx.answerCbQuery();
  const state = adminStates[ADMIN_ID];

  if (state && (state.step === "ask_video" || state.step === "enter_video")) {
    await createInvitation(ctx, state);
  }
});

// Taklifnoma yaratish funksiyasi
async function createInvitation(ctx, state) {
  const invId = Date.now().toString();
  const invitation = {
    invId,
    message: state.message,
    photo: state.photo || null,
    videoUrl: state.videoUrl || null,
    createdAt: new Date(),
  };

  invitations[invId] = invitation;
  currentInvitation = invitation;
  responses[invId] = {};

  // MongoDB ga saqlash
  if (isMongoConnected) {
    try {
      await Invitation.create(invitation);
      console.log("✅ MongoDB-ga saqlandi:", invId);
    } catch (error) {
      console.log("⚠️ MongoDB-ga saqlashda xato:", error.message);
    }
  }

  // JSON faylga saqlash (backup)
  saveInvitationsToFile(invitations);
  saveResponsesToFile(responses);
  saveCurrentToFile(invitation);

  delete adminStates[ctx.from.id];

  // Taklifnomani adminnga ko'rsatish
  let replyMessage = "✅ Taklifnoma yaratildi!\n\n" + invitation.message;

  if (invitation.videoUrl) {
    replyMessage += "\n\n🎥 Video: " + invitation.videoUrl;
  }

  replyMessage +=
    "\n\n📢 Endi guruhga botning linkini yuboring:\n" +
    `https://t.me/${ctx.botInfo.username}?start=inv_${invId}`;

  if (invitation.photo) {
    await ctx.replyWithPhoto(invitation.photo, {
      caption: replyMessage,
    });
  } else {
    await ctx.reply(replyMessage);
  }

  showAdminMenu(ctx);
}

// ========================================
// MEHMONLAR: Javob berish
// ========================================

bot.action("response_yes", async (ctx) => {
  await ctx.answerCbQuery("✅ Javobingiz qabul qilindi!");

  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  if (currentInvitation) {
    if (!responses[currentInvitation.invId]) {
      responses[currentInvitation.invId] = {};
    }
    responses[currentInvitation.invId][userId] = {
      response: "yes",
      username,
      name: ctx.from.first_name,
    };

    // MongoDB ga saqlash
    if (isMongoConnected) {
      try {
        await Response.create({
          invId: currentInvitation.invId,
          userId,
          response: "yes",
          username,
          name: ctx.from.first_name,
        });
      } catch (error) {
        console.log("⚠️ Response saqlashda xato:", error.message);
      }
    }

    // JSON ga saqlash
    saveResponsesToFile(responses);

    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.reply("✅ Rahmat! Sizni kutib qolamiz! 🎉");

    // Adminga xabar
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ ${ctx.from.first_name} (@${
        ctx.from.username || "username yo'q"
      }) KELADI!`
    );
  }
});

bot.action("response_no", async (ctx) => {
  await ctx.answerCbQuery("📝 Javobingiz qabul qilindi");

  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  if (currentInvitation) {
    if (!responses[currentInvitation.invId]) {
      responses[currentInvitation.invId] = {};
    }
    responses[currentInvitation.invId][userId] = {
      response: "no",
      username,
      name: ctx.from.first_name,
    };

    // MongoDB ga saqlash
    if (isMongoConnected) {
      try {
        await Response.create({
          invId: currentInvitation.invId,
          userId,
          response: "no",
          username,
          name: ctx.from.first_name,
        });
      } catch (error) {
        console.log("⚠️ Response saqlashda xato:", error.message);
      }
    }

    // JSON ga saqlash
    saveResponsesToFile(responses);

    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.reply("😔 Afsus, ammo vaqt topib keling! Sizni kutib qolamiz!");

    // Adminga xabar
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `❌ ${ctx.from.first_name} (@${
        ctx.from.username || "username yo'q"
      }) KELMAYDI`
    );
  }
});

// ========================================
// Botni ishga tushirish
// ========================================

// MongoDB-dan ma'lumotlarni yuklash
async function loadFromMongoDB() {
  if (!isMongoConnected) {
    console.log("⚠️ MongoDB ulanmagan, JSON ishlatiladi");
    return;
  }

  try {
    // Taklifnomalarni yuklash
    const invs = await Invitation.find().lean();
    console.log(`📥 MongoDB-dan ${invs.length} taklifnoma yuklandi`);

    for (const inv of invs) {
      invitations[inv.invId] = inv;
    }

    // Eng oxirgi taklifnomani current qilish
    if (invs.length > 0) {
      const lastInv = invs[invs.length - 1];
      currentInvitation = lastInv;
      console.log(`✅ Joriy taklifnoma: ${lastInv.invId}`);
    }

    // Javoblarni yuklash
    const resps = await Response.find().lean();
    console.log(`📥 MongoDB-dan ${resps.length} javob yuklandi`);

    for (const resp of resps) {
      if (!responses[resp.invId]) {
        responses[resp.invId] = {};
      }
      responses[resp.invId][resp.userId] = {
        response: resp.response,
        username: resp.username,
        name: resp.name,
      };
    }

    // JSON ga backup saqlash
    saveInvitationsToFile(invitations);
    saveResponsesToFile(responses);
    if (currentInvitation) {
      saveCurrentToFile(currentInvitation);
    }

    console.log(
      "✅ Ma'lumotlar MongoDB-dan yuklandi va JSON-ga backup qilindi"
    );
  } catch (error) {
    console.log("⚠️ MongoDB-dan yuklashda xato:", error.message);
  }
}

// Render uchun webhook URL
const WEBHOOK_DOMAIN = process.env.RENDER_EXTERNAL_URL || 'https://taklifnoma-h593.onrender.com';
const WEBHOOK_PATH = `/webhook/${process.env.bot_token}`;

// MongoDB yuklash va botni ishga tushirish
async function startBot() {
  try {
    // MongoDB-dan ma'lumotlarni yuklash
    await loadFromMongoDB();
    console.log("📊 Jami taklifnomalar:", Object.keys(invitations).length);
    console.log("📝 Jami javoblar:", Object.keys(responses).length);

    // Webhook sozlash
    if (process.env.NODE_ENV === 'production') {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${WEBHOOK_PATH}`);
      console.log("✅ Webhook sozlandi:", WEBHOOK_DOMAIN);
      
      // Express orqali webhook qabul qilish
      app.use(bot.webhookCallback(WEBHOOK_PATH));
      console.log("✅ Bot webhook modeda ishlamoqda");
    } else {
      // Lokal uchun polling
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.launch();
      console.log("✅ Bot polling modeda ishlamoqda (lokal)");
    }

    console.log("👤 Admin ID:", ADMIN_ID);
    keepAlive();
  } catch (error) {
    console.log("❌ Bot ishga tushishda xato:", error.message);
  }
}

startBot();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
