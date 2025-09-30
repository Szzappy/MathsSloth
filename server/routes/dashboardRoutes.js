import express from "express";
import pool from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await pool.query(`
      SELECT username
      FROM users
      WHERE userid = $1`, [
        req.user
    ]);
    console.log("dashboardRoutes.js 15: ", user.rows[0])
    res.json(user.rows[0])
  } catch (error) {
    console.error(error.message)
    res.status(500).send("Internal Server Error")
  }
})

export default router;