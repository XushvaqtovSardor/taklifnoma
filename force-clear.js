// Telegram API orqali to'g'ridan-to'g'ri webhook va updatelarni o'chirish
import fetch from "node-fetch";
import "dotenv/config";

const BOT_TOKEN = process.env.bot_token;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

console.log("🔄 Telegram API orqali webhook va updatelarni tozalash...\n");

async function clearAll() {
  try {
    // 1. Webhook o'chirish
    console.log("1️⃣ Webhook o'chirilmoqda...");
    const webhookRes = await fetch(
      `${API_URL}/deleteWebhook?drop_pending_updates=true`
    );
    const webhookData = await webhookRes.json();
    console.log("✅ Webhook:", webhookData.result ? "O'chirildi" : "Xato");
    console.log("   Response:", webhookData);

    // 2. Webhook info
    console.log("\n2️⃣ Webhook info:");
    const infoRes = await fetch(`${API_URL}/getWebhookInfo`);
    const infoData = await infoRes.json();
    console.log("   URL:", infoData.result.url || "Yo'q");
    console.log("   Pending:", infoData.result.pending_update_count || 0);

    // 3. Get me
    console.log("\n3️⃣ Bot info:");
    const meRes = await fetch(`${API_URL}/getMe`);
    const meData = await meRes.json();
    console.log("   Username:", meData.result.username);
    console.log("   ID:", meData.result.id);

    // 4. Barcha pending updatelarni olib, o'chirish
    console.log("\n4️⃣ Pending updatelarni tozalash...");
    const updatesRes = await fetch(`${API_URL}/getUpdates?offset=-1`);
    const updatesData = await updatesRes.json();
    console.log(
      "   Pending updates:",
      updatesData.result ? updatesData.result.length : 0
    );

    if (updatesData.result && updatesData.result.length > 0) {
      const lastUpdateId =
        updatesData.result[updatesData.result.length - 1].update_id;
      const clearRes = await fetch(
        `${API_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=0`
      );
      console.log("   Tozalandi!");
    }

    console.log("\n✅ Hammasi tozalandi!");
    console.log("\n👉 Endi botni ishga tushiring: npm start");
    console.log("\n💡 Agar hali ham 409 xatolik bo'lsa:");
    console.log("   1. BotFather-da /revoke_token qiling");
    console.log("   2. Yangi token .env ga qo'ying");
    console.log("   3. Botni qayta ishga tushiring");
  } catch (error) {
    console.log("❌ Xato:", error.message);
  }
}

clearAll();
