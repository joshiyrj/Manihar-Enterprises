const jwt = require("jsonwebtoken");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function clearCookieOptions() {
  const { httpOnly, sameSite, secure, path } = cookieOptions();
  return { httpOnly, sameSite, secure, path };
}

module.exports = { signToken, verifyToken, cookieOptions, clearCookieOptions };
