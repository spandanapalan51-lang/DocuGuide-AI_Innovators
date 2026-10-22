
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/user");
const Chat = require("./models/chat");

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });

const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 4000;

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ========================
// AUTHENTICATION HELPERS
// ========================

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from .env");
  }

  return jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Please log in to access your chat history."
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      error: "Authentication token is missing."
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        error: "Invalid authentication token."
      });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Your session is invalid or expired. Please log in again."
    });
  }
}

// Optional authentication for the existing chatbot.
// Visitors can still use the chatbot without logging in.
// Logged-in users can have their conversations saved.
function optionalAuthentication(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Invalid authentication header."
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(503).json({
      error: "Authentication is not configured on the server."
    });
  }

  try {
    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        error: "Invalid authentication token."
      });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Your session is invalid or expired. Please log in again."
    });
  }
}

// ========================
// REGISTER
// ========================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        error: "Please enter a valid name (up to 100 characters)."
      });
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      email.trim().length > 254
    ) {
      return res.status(400).json({
        error: "Please enter a valid email address."
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        error: "Password must be between 8 and 128 characters."
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(503).json({
        error: "Authentication is not configured on the server."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      error: "Could not create your account. Please try again."
    });
  }
});

// ========================
// LOGIN
// ========================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Please enter your email and password."
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(503).json({
        error: "Authentication is not configured on the server."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      error: "Could not log in. Please try again."
    });
  }
});

// ========================
// GET SAVED CHAT HISTORY
// ========================

app.get("/api/chats", authenticateToken, async (req, res) => {
  try {
    const chats = await Chat.find({
      user: req.userId
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("message reply createdAt");

    return res.json({
      success: true,
      chats
    });
  } catch (error) {
    console.error("Chat history error:", error.message);

    return res.status(500).json({
      error: "Could not load chat history."
    });
  }
});

// ========================
// HEALTH CHECK
// ========================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "DocuGuide AI backend is running",
    aiConfigured: Boolean(ai)
  });
});

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getResponseText(response) {
  // Prefer the SDK's convenience property.
  if (typeof response.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  // Fall back to extracting text from candidate parts.
  const parts = response.candidates?.[0]?.content?.parts || [];

  return parts
    .filter(part => typeof part.text === "string")
    .map(part => part.text)
    .join("\n")
    .trim();
}

function generateWithTimeout(request, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("AI request timed out"));
    }, timeoutMs);

    request
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

// ========================
// EXISTING GEMINI CHATBOT
// WITH OPTIONAL CHAT SAVING
// ========================

app.post(
  "/api/troubleshoot",
  optionalAuthentication,
  async (req, res) => {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please provide a troubleshooting message."
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        error: "Message must be 1000 characters or fewer."
      });
    }

    if (!ai) {
      return res.status(503).json({
        error: "AI is not configured. Check GEMINI_API_KEY in your .env file."
      });
    }

    const systemInstruction =
      "You are DocuGuide AI, a helpful assistant for general document retrieval troubleshooting, especially DigiLocker. Give clear, practical, step-by-step guidance. Ask clarifying questions when needed. Never claim to access or retrieve documents or verify identities. Direct users to official issuing authorities for account-specific issues. Warn users not to share passwords, OTPs, full ID numbers, or private documents. If a question is unrelated, answer briefly and politely explain your main purpose.";

    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const request = ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: message.trim(),
          config: {
            systemInstruction,
            maxOutputTokens: 8192
          }
        });

        const response = await generateWithTimeout(request);
        const reply = getResponseText(response);

        console.log(
          "Gemini finish reason:",
          response.candidates?.[0]?.finishReason || "not provided"
        );

        console.log("Gemini returned text:", Boolean(reply));

        if (!reply) {
          console.error(
            "Gemini returned no text. Finish reason:",
            response.candidates?.[0]?.finishReason,
            "Prompt feedback:",
            response.promptFeedback?.blockReason || "none"
          );

          return res.status(502).json({
            error: "Gemini returned no text. Please try again."
          });
        }

        // Save the conversation only when the user is authenticated.
        // Saving failures should not stop the Gemini response.
        if (req.userId) {
          try {
            await Chat.create({
              user: req.userId,
              message: message.trim(),
              reply
            });
          } catch (saveError) {
            console.error(
              "Chat saving failed:",
              saveError.message
            );
          }
        }

        return res.json({
          success: true,
          reply
        });
      } catch (error) {
        lastError = error;
        const status = error.status || error.statusCode;

        console.error(
          `Gemini attempt ${attempt} failed:`,
          status || error.message || error.name
        );

        const temporary =
          [429, 500, 503, 504].includes(status) ||
          error.message === "AI request timed out";

        if (!temporary || attempt === 3) break;

        await wait(attempt * 1500);
      }
    }

    const status = lastError?.status || lastError?.statusCode;

    if (status === 429) {
      return res.status(429).json({
        error: "Gemini usage limit reached. Please wait and try again."
      });
    }

    if (status === 401 || status === 403) {
      return res.status(502).json({
        error: "Gemini authentication failed. Check your API key and project access."
      });
    }

    if (
      [500, 503, 504].includes(status) ||
      lastError?.message === "AI request timed out"
    ) {
      return res.status(503).json({
        error: "Gemini is temporarily unavailable. Please try again shortly."
      });
    }

    return res.status(502).json({
      error: "The AI service could not respond. Please try again later."
    });
  }
);

// ========================
// ERROR HANDLING
// ========================

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      error: "Invalid JSON request body."
    });
  }

  console.error("Request error:", err.message);

  return res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

// ========================
// START SERVER
// ========================

app.listen(PORT, () => {
  console.log(`DocuGuide AI running at http://localhost:${PORT}`);
  console.log(ai ? "Gemini AI is configured." : "Gemini API key is missing.");
});
