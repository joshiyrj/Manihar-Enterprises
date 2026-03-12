const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { connectDB } = require("./lib/db");
const { createApp } = require("./app");

const app = createApp();
const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    const server = app.listen(port, () =>
      console.log(`Server running on http://localhost:${port}`)
    );

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Stop the existing process or change PORT in server/.env.`);
      } else {
        console.error("Server failed to start:", err);
      }
      process.exit(1);
    });
  })
  .catch((e) => {
    console.error("DB connection failed:", e);
    process.exit(1);
  });
