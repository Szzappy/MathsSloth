import express from "express";
import pool from "../config/db.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Returns the authenticated user's information
router.get("/get-user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await pool.query(`
      SELECT userid, email, username
      FROM users
      WHERE userid = $1
    `, [id]);

    if (user.rows.length === 0) {
      return res.status(404).json("User not found");
    }

    res.json(user.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
});

export default router;