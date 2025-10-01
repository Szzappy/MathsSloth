import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import pool from "../config/db.js"
import jwtGenerator from "../utils/jwtGenerator.js";
import validCredentials from "../middleware/validCredentials.js";
import "dotenv/config"

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

const sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Maths Shark'}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Verify your Email Address`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Email Verification</h1>
        <p>Thank you for registering! Please click the link below to verify your email:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">Verify Email</a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
        <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you didn't create an account, please ignore this email.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// REGISTER ROUTE
router.post("/register", validCredentials, async (req, res) => {
  try {
    // Destructure req.body
    const {username, email, password, confirmPassword} = req.body;
    
    if (password != confirmPassword)
      return res.status(401).json("Passwords don't match")

    // check if user already exists
    const user = await pool.query(`
      SELECT *
      FROM users
      WHERE email = $1 OR username = $2`, [
        email, 
        username
    ]);

    // if query returns more than 1 row, email already exists
    if (user.rows.length > 0) {
      const existingUser = user.rows[0] 

      if (existingUser.email == email && !existingUser.is_verified) {
        const tokenExpired = !existingUser.verification_token_expiry ||
          new Date(existingUser.verification_token_expiry) < new Date();

        if (tokenExpired) {
          await pool.query(`
            DELETE FROM users
            WHERE userid = $1`, [
              existingUser.userid
            ])
        } else {
          return res.status(409).json({
            error: "Unverified account with this email exists already. Please check your email",
            needsVerification: true,
            email: email
          });
        }
      } else if (existingUser.email === email && existingUser.is_verified)
          return res.status(401).json("Email already exists");
      else if (existingUser.username === username)
        return res.status(401).json("Username already exists");
    }

    // bcrypt user password
    const salt = await bcrypt.genSalt(10);
    const bcryptPassword = await bcrypt.hash(password, salt);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // enter user into database
    await pool.query(`
      INSERT INTO users (username, email, password, is_verified, verification_token, verification_token_expiry)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [
        username,
        email,
        bcryptPassword,
        false,
        verificationToken,
        tokenExpiry
    ]);

    try {
      await sendVerificationEmail(email, verificationToken)
    } catch (error) {
      console.error("Email sending failed", error.message);
    }

    res.status(201).json({
      message: "Registration successful, Please check your email to verify your account.",
      email: email
    })
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
})

router.get("/verify-email", async (req, res) => {
  try {
    const {token} = req.query;

    if (!token)
      return res.status(400).json("Verification token required");

    const user = await pool.query(`
      SELECT * 
      FROM users
      WHERE verification_token = $1
      AND verification_token_expiry > NOW()`, [
        token
      ]);

    if (user.rows.length === 0)
      return res.status(400).json("Invalid or expired verification token");

    if (user.rows[0].is_verified) 
      return res.status(400).json("Email already verified");

    await pool.query(`
      UPDATE users
      SET is_verified = true,
          verification_token = NULL,
          verification_token_expiry = NULL
      WHERE userid = $1`, [
        user.rows[0].userid
      ]);
      
    // generate jwt token
    const jwtToken = jwtGenerator(user.rows[0].userid, false);
    res.json({
      message: "Email verified successfully",
      token: jwtToken
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
})

// RESEND VERIFICATION EMAIL ROUTE
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) 
      return res.status(400).json("Email is required");
    
    // Find user
    const user = await pool.query(`
      SELECT *
      FROM users
      WHERE email = $1`, [email]
    );
    
    // Don't reveal if user exists (security best practice)
    if (user.rows.length === 0)
      return res.json({ message: "If that email exists, a verification email has been sent." });
    
    if (user.rows[0].is_verified) 
      return res.status(400).json("Email is already verified");
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
    
    // Update token in database
    await pool.query(`
      UPDATE users
      SET verification_token = $1,
          verification_token_expiry = $2
      WHERE userid = $3`, [
        verificationToken,
        tokenExpiry,
        user.rows[0].userid
    ]);
    
    // Send email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (error) {
      console.error("Email sending failed:", error.message);
      return res.status(500).json("Failed to send verification email");
    }
    
    res.json({ message: "Verification email sent. Please check your inbox." });
    
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
});

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

    // Check if email is verified
    if (!user.rows[0].is_verified) {
      return res.status(403).json({ 
        error: "Please verify your email before logging in",
        needsVerification: true,
        email: email
      });
    }

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