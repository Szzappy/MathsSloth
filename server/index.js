import express from "express";
import cors from "cors";
import 'dotenv/config';
import openaiRoutes from "./routes/openai.js"
import wolframRoutes from "./routes/wolfram.js"
import authRoutes from "./routes/authRoutes.js"
import dashboardRoutes from "./routes/dashboardRoutes.js"

// simple routes
const app = express();
app.use(cors({
  origin: '*', // Allow all origins (NOT recommended for production)
  credentials: true
}));
app.use(express.json());

// ROUTES
app.use("/api/openai", openaiRoutes);
app.use("/api/wolfram", wolframRoutes);
app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes)


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
