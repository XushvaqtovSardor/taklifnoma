import { Markup, Telegraf } from "telegraf";
import "dotenv/config";
import fs from "fs";
import path from "path";
import keepAlive from "./keep-alive.js";
import "./server.js"; // Web server Render uchun

const bot = new Telegraf(process.env.bot_token);
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

// Ma'lumotlar fayllari
const DATA_DIR = "./data";
const INVITATIONS_FILE = path.join(DATA_DIR, "invitations.json");
const RESPONSES_FILE = path.join(DATA_DIR, "responses.json");
const CURRENT_FILE = path.join(DATA_DIR, "current.json");

// Data papkani yaratish
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ma'lumotlarni yuklash
function loadData() {
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

// Ma'lumotlarni saqlash
function saveInvitations(invitations) {
  fs.writeFileSync(INVITATIONS_FILE, JSON.stringify(invitations, null, 2));
}

function saveResponses(responses) {
  fs.writeFileSync(RESPONSES_FILE, JSON.stringify(responses, null, 2));
}

function saveCurrentInvitation(invitation) {
  fs.writeFileSync(CURRENT_FILE, JSON.stringify(invitation, null, 2));
}

// Ma'lumotlarni yuklash
const data = loadData();
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
        "Link yuborish yoki O'tkazib yuborish tugmasini bosing:",
      Markup.inlineKeyboard([
        [Markup.button.callback("⏭️ O'tkazib yuborish", "skip_video")],
      ])
    );
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
        "❌ Noto'g'ri YouTube link! Qaytadan yuboring yoki O'tkazib yuborish tugmasini bosing."
      );
    }
  }
});

// Video o'tkazib yuborish
bot.action("skip_video", async (ctx) => {
  await ctx.answerCbQuery();
  const state = adminStates[ADMIN_ID];

  if (state && state.step === "ask_video") {
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

  // Ma'lumotlarni saqlash
  saveInvitations(invitations);
  saveResponses(responses);
  saveCurrentInvitation(invitation);

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

    // Ma'lumotlarni saqlash
    saveResponses(responses);

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

    // Ma'lumotlarni saqlash
    saveResponses(responses);

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

bot.telegram
  .deleteWebhook({ drop_pending_updates: true })
  .then(() => {
    console.log("✅ Webhook o'chirildi");
    bot.launch();
    console.log("✅ Bot ishga tushdi!");
    console.log("👤 Admin ID:", ADMIN_ID);
    console.log("📊 Mavjud taklifnomalar:", Object.keys(invitations).length);
    console.log("📝 Mavjud javoblar:", Object.keys(responses).length);

    // Render uchun keep-alive
    keepAlive();
  })
  .catch((err) => {
    console.log("❌ Xato:", err.message);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
