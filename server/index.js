import express from "express";
import session from "express-session";
import cors from "cors";
import rateLimit from "express-rate-limit";
import 'dotenv/config';
import openaiRoutes from "./routes/openai.js";
import wolframRoutes from "./routes/wolfram.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import path from "path";
import passport from "passport";
import "./config/passport.js";

const app = express();

app.use(session({
  secret: process.env.JWT_SECRET, // Change this to a random string
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: (req) => {
    // Skip rate limiting for verify email route
    return req.path === '/verify-email'
  },
  message: {
    error: "Too many requests, please try again later",
    rateLimitTimer: 15 * 60 * 1000
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(cors({
  origin: '*', // Allow all origins
  credentials: true
}));
app.use(express.json());

// ROUTES
app.use("/api/openai", apiLimiter, openaiRoutes);
app.use("/api/wolfram", apiLimiter, wolframRoutes);
app.use("/auth", authLimiter, authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/images", express.static(path.join(process.cwd(), "images")));
app.use("/quiz", quizRoutes);

app.use(passport.initialize());
app.use(passport.session());


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
