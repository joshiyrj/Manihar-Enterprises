const mongoose = require("mongoose");

let cachedConn = null;
let cachedPromise = null;

async function connectDB() {
  if (cachedConn) return cachedConn;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing in .env");

  mongoose.set("strictQuery", true);

  if (!cachedPromise) {
    cachedPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });
  }

  cachedConn = await cachedPromise;
  if (process.env.NODE_ENV !== "test") {
    console.log("MongoDB connected");
  }

  return cachedConn;
}

module.exports = { connectDB };
