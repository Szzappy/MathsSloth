import express from "express";
import bcrypt from "bcrypt";
import pool from "../config/db.js"
import jwtGenerator from "../utils/jwtGenerator.js";
import validCredentials from "../middleware/validCredentials.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router()

// REGISTER ROUTE
router.post("/register", validCredentials, async (req, res) => {
  try {
    // Destructure req.body
    const {username, email, password, confirmPassword} = req.body;

    // check if user alread exists
    const user = await pool.query(`
      SELECT *
      FROM users
      WHERE email = $1 OR username = $2`, [
        email, 
        username
    ]);

    if (password != confirmPassword)
      return res.status(401).json("Passwords don't match")

    // if query returns more than 1 row, email already exists
    if (user.rows.length > 0) 
      return res.status(401).json(`username or email already exists`)

    // bcrypt user password
    const salt = await bcrypt.genSalt(10);
    const bcryptPassword = await bcrypt.hash(password, salt);

    // enter user into database
    const newUser = await pool.query(`
      INSERT INTO users (username, email, password)
      VALUES ($1, $2, $3) RETURNING *`, [
        username,
        email,
        bcryptPassword
    ]);

    // generate jwt token
    const token = jwtGenerator(newUser.rows[0].userid, false);
    res.json({token: token});
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
})

// LOGIN ROUTES
// error with logging in, jwt malformed
router.post("/login", validCredentials, async (req, res) => {
  try {
    const {email, password, rememberMe} = req.body;
    
    // check if user exists
    const user = await pool.query(`
      SELECT *
      FROM users
      WHERE email = $1`, [
        email
    ]);
    
    if (user.rows.length === 0) 
      return res.status(401).json(`Account with email ${email} doesn't exist`);

    // check if password is correct
    const validPassword = await bcrypt.compare(password, user.rows[0].password)
    
    if (!validPassword)
      return res.status(401).json("Incorrect password")
    
    const token = jwtGenerator(user.rows[0].userid, rememberMe)
    
    res.json({token: token})
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error")
  }
})

export default router;