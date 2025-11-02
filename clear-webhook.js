// Faqat webhook-ni o'chirish uchun
import { Telegraf } from "telegraf";
import "dotenv/config";

const bot = new Telegraf(process.env.bot_token);

console.log("🔄 Webhook o'chirilmoqda...");

bot.telegram
  .deleteWebhook({ drop_pending_updates: true })
  .then(() => {
    console.log("✅ Webhook o'chirildi!");
    console.log("✅ Barcha kutayotgan updatelar o'chirildi!");
    console.log("👉 Endi botni ishga tushiring: npm start");
    process.exit(0);
  })
  .catch((err) => {
    console.log("❌ Xato:", err.message);
    process.exit(1);
  });
