function notFound(req, res) {
    res.status(404).json({ message: "Route not found" });
  }
  
  function errorHandler(err, req, res, next) {
    console.error(err);
  
    // Zod validation
    if (err?.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", details: err.errors });
    }

    // Duplicate key (Mongo)
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Duplicate value detected", details: err.keyValue || null });
    }

    // Invalid ObjectId cast errors
    if (err?.name === "CastError") {
      return res.status(400).json({ message: "Invalid request value" });
    }

    // Explicit application errors with statusCode
    if (err?.statusCode && err?.message) {
      return res.status(err.statusCode).json({ message: err.message });
    }

    if (typeof err?.message === "string" && err.message.startsWith("CORS blocked")) {
      return res.status(403).json({ message: err.message });
    }
  
    res.status(500).json({ message: "Server error" });
  }
  
  module.exports = { notFound, errorHandler };
