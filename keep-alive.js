import https from "https";

// Render.com da bot uxlab qolmasligi uchun
// Har 14 daqiqada o'zini ping qiladi

const RENDER_URL = process.env.RENDER_EXTERNAL_URL; // Render avtomatik beradi

function keepAlive() {
  if (!RENDER_URL) {
    console.log("⚠️ RENDER_EXTERNAL_URL yo'q, keep-alive ishlamaydi");
    return;
  }

  setInterval(() => {
    const url = RENDER_URL.startsWith("http")
      ? RENDER_URL
      : `https://${RENDER_URL}`;

    https
      .get(url, (res) => {
        console.log(`✅ Keep-alive ping: ${res.statusCode}`);
      })
      .on("error", (err) => {
        console.log("❌ Keep-alive xato:", err.message);
      });
  }, 14 * 60 * 1000); // 14 daqiqa

  console.log("✅ Keep-alive faollashtirildi");
}

export default keepAlive;
