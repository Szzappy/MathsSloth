import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit"
import 'dotenv/config';
import openaiRoutes from "./routes/openai.js"
import wolframRoutes from "./routes/wolfram.js"
import authRoutes from "./routes/authRoutes.js"
import dashboardRoutes from "./routes/dashboardRoutes.js"

const app = express();

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
app.use("/dashboard", dashboardRoutes)


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
