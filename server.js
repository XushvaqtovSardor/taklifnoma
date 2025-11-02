import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint (Render uchun)
app.get("/", (req, res) => {
  res.send("✅ Wedding Bot ishlamoqda!");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🌐 Web server ${PORT} portda ishlamoqda`);
});

export default app;
