import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import pool from "../config/db.js"
import jwtGenerator from "../utils/jwtGenerator.js";
import validCredentials from "../middleware/validCredentials.js";
import "dotenv/config";
import passport from "passport";

const router = express.Router();

// Redirects to Google OAuth consent screen
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Handles Google OAuth callback, generates JWT and redirects to frontend
router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, user, info) => {
    if (err) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
    if (!user) {
      const message = info?.message || "Authentication failed";
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(message)}`);
    }
    const token = jwtGenerator(user.userid, false);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
  })(req, res, next);
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"${process.env.APP_NAME || 'Maths Sloth'}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Verify Your Email Address - Maths Sloth`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #2d2d2d; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);">
                <tr>
                  <td style="padding: 40px 40px 20px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🦥 Maths Sloth</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 600;">Welcome to the Troop!</h2>
                    <p style="margin: 0 0 24px 0; color: #d1d5db; font-size: 16px; line-height: 1.6;">
                      Thank you for joining Maths Sloth! We're excited to have you on board.
                    </p>
                    <p style="margin: 0 0 24px 0; color: #d1d5db; font-size: 16px; line-height: 1.6;">
                      To get started, please verify your email address by clicking the button below:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 0 0 24px 0;">
                          <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
                        </td>
                      </tr>
                    </table>
                    <div style="background-color: #1a1a1a; border: 1px solid #404040; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                      <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 14px;">Or copy and paste this link into your browser:</p>
                      <p style="margin: 0; color: #10b981; font-size: 14px; word-break: break-all;">
                        <a href="${verificationUrl}" style="color: #10b981; text-decoration: none;">${verificationUrl}</a>
                      </p>
                    </div>
                    <div style="border-left: 4px solid #10b981; background-color: #1a1a1a; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
                      <p style="margin: 0; color: #86efac; font-size: 14px; line-height: 1.5;">
                        ✓ <strong>This link will expire in 24 hours.</strong>
                      </p>
                    </div>
                    <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                      If you didn't create an account with Maths Sloth, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #1a1a1a; border-top: 1px solid #404040;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                      © ${new Date().getFullYear()} Maths Sloth. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  });
};

const sendResetPasswordEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: `"${process.env.APP_NAME || 'Maths Sloth'}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Reset Your Password - Maths Sloth`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #2d2d2d; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);">
                <tr>
                  <td style="padding: 40px 40px 20px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🦥 Maths Sloth</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                    <p style="margin: 0 0 24px 0; color: #d1d5db; font-size: 16px; line-height: 1.6;">
                      The sloth forgot their password? Happens to the best of us. Let's get you back in!
                    </p>
                    <p style="margin: 0 0 24px 0; color: #d1d5db; font-size: 16px; line-height: 1.6;">
                      Click the button below to reset your password:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 0 0 24px 0;">
                          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
                        </td>
                      </tr>
                    </table>
                    <div style="background-color: #1a1a1a; border: 1px solid #404040; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                      <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 14px;">Or copy and paste this link into your browser:</p>
                      <p style="margin: 0; color: #10b981; font-size: 14px; word-break: break-all;">
                        <a href="${resetUrl}" style="color: #10b981; text-decoration: none;">${resetUrl}</a>
                      </p>
                    </div>
                    <div style="border-left: 4px solid #f59e0b; background-color: #1a1a1a; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
                      <p style="margin: 0; color: #fde68a; font-size: 14px; line-height: 1.5;">
                        ⏰ <strong>This link will expire in 10 minutes.</strong>
                      </p>
                    </div>
                    <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                      If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #1a1a1a; border-top: 1px solid #404040;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                      © ${new Date().getFullYear()} Maths Sloth. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  });
};

// Registers a new user, hashes their password and sends a verification email
router.post("/register", validCredentials, async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (password != confirmPassword)
      return res.status(401).json("Passwords don't match");

    const user = await pool.query(`
      SELECT * FROM users WHERE email = $1 OR username = $2
    `, [email, username]);

    if (user.rows.length > 0) {
      const existingUser = user.rows[0];

      if (existingUser.email == email && !existingUser.is_verified) {
        const tokenExpired = !existingUser.verification_token_expiry ||
          new Date(existingUser.verification_token_expiry) < new Date();

        if (tokenExpired) {
          await pool.query(`DELETE FROM users WHERE userid = $1`, [existingUser.userid]);
        } else {
          return res.status(409).json({
            error: "Unverified account with this email exists already. Please check your email",
            needsVerification: true,
            email
          });
        }
      } else if (existingUser.email === email && existingUser.is_verified) {
        return res.status(401).json("Email already exists");
      } else if (existingUser.username === username) {
        return res.status(401).json("Username already exists");
      }
    }

    const salt = await bcrypt.genSalt(10);
    const bcryptPassword = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(`
      INSERT INTO users (username, email, password, is_verified, verification_token, verification_token_expiry)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [username, email, bcryptPassword, false, verificationToken, tokenExpiry]);

    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (error) {
      console.error("Email sending failed", error.message);
    }

    res.status(201).json({
      message: "Registration successful, Please check your email to verify your account.",
      email
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
});

// Verifies a user's email address using the token from their verification email
router.get("/email/verify", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token)
      return res.status(400).json("Verification token required");

    const user = await pool.query(`
      SELECT * FROM users
      WHERE verification_token = $1 AND verification_token_expiry > NOW()
    `, [token]);

    if (user.rows.length === 0)
      return res.status(400).json("Invalid or expired verification token");

    if (user.rows[0].is_verified)
      return res.status(400).json("Email already verified");

    await pool.query(`
      UPDATE users
      SET is_verified = true, verification_token = NULL, verification_token_expiry = NULL
      WHERE userid = $1
    `, [user.rows[0].userid]);

    const jwtToken = jwtGenerator(user.rows[0].userid, false);
    res.json({
      message: "Email verified successfully",
      token: jwtToken,
      is_onboarded: user.rows[0].is_onboarded ?? false,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
});

// Resends a verification email to an unverified user
router.post("/verification/resend", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json("Email is required");

    const user = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

    if (user.rows.length === 0)
      return res.json({ message: "If that email exists, a verification email has been sent." });

    if (user.rows[0].is_verified)
      return res.status(400).json("Email is already verified");

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(`
      UPDATE users SET verification_token = $1, verification_token_expiry = $2 WHERE userid = $3
    `, [verificationToken, tokenExpiry, user.rows[0].userid]);

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

// Validates credentials and returns a JWT along with basic user info
router.post("/login", validCredentials, async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const genericError = "Invalid email or password";

    const user = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

    if (user.rows.length === 0) return res.status(401).json(genericError);
    if (user.rows[0].using_oauth) return res.status(401).json(genericError);

    if (!user.rows[0].is_verified) {
      return res.status(403).json({
        error: "Please verify your email before logging in",
        needsVerification: true
      });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) return res.status(401).json(genericError);

    const token = jwtGenerator(user.rows[0].userid, rememberMe);
    res.json({
      token,
      username: user.rows[0].username.length > 25
        ? user.rows[0].username.substring(0, 25) + "..."
        : user.rows[0].username,
      is_onboarded: user.rows[0].is_onboarded ?? false,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json("Internal Server Error");
  }
});

// Sends a password reset email if the account exists and is verified
router.post("/password/reset/email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json("Email is required");

    const user = await pool.query(`
      SELECT * FROM users WHERE email = $1 AND is_verified = true AND using_oauth = false
    `, [email]);

    if (user.rows.length === 0) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(`
      UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE userid = $3
    `, [resetToken, tokenExpiry, user.rows[0].userid]);

    try {
      await sendResetPasswordEmail(email, resetToken);
    } catch (error) {
      console.error("Email sending failed:", error.message);
      return res.status(500).json("Failed to send reset password email");
    }

    res.json({ message: "Reset password email sent. Please check your inbox." });
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
});

// Validates the reset token and updates the user's password
router.post("/password/reset", validCredentials, async (req, res) => {
  try {
    const { password, confirmPassword, token } = req.body;

    if (!password || !confirmPassword || !token)
      return res.status(400).json("All fields are required");

    if (password !== confirmPassword)
      return res.status(400).json("Passwords do not match");

    const user = await pool.query(`
      SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()
    `, [token]);

    if (user.rows.length === 0) {
      console.log("Invalid or expired reset token used:", token);
      return res.status(400).json({ error: "Invalid or expired reset token - please request a new password reset" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(`
      UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE userid = $2
    `, [hashedPassword, user.rows[0].userid]);

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json("Internal Server Error");
  }
});

// Returns username and onboarding status for the authenticated user
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.slice(7);
    let userid;

    try {
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
      userid = decoded.userid ?? decoded.id ?? decoded.sub ?? decoded.user;
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (!userid) return res.status(401).json({ error: "Invalid token payload" });

    const result = await pool.query(
      `SELECT username, is_onboarded FROM users WHERE userid = $1`,
      [userid]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    res.json({
      userid,
      username: result.rows[0].username,
      is_onboarded: result.rows[0].is_onboarded ?? false,
    });
  } catch (error) {
    console.error("Error in /auth/me:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Seeds topic mastery for every topic at the user's chosen grade ELO and marks them as onboarded
router.post("/onboarding", async (req, res) => {
  try {
    const { userid, grade, grade_center_elo, topic_adjustments = [] } = req.body;

    if (!userid || !grade || grade_center_elo == null) {
      return res.status(400).json({ error: "userid, grade and grade_center_elo are required" });
    }

    const center = parseInt(grade_center_elo);

    const adjustmentMap = {};
    for (const adj of topic_adjustments) {
      adjustmentMap[adj.topic_code] = adj.strength === 'strong' ? center + 100 : center - 100;
    }

    const topicsResult = await pool.query(`SELECT topicid, topic_code FROM topics`);

    const allElos = topicsResult.rows.map(t =>
      Math.max(800, Math.min(2400, adjustmentMap[t.topic_code] ?? center))
    );
    const avgElo = allElos.reduce((a, b) => a + b, 0) / allElos.length;

    for (const topic of topicsResult.rows) {
      const elo = Math.max(800, Math.min(2400, adjustmentMap[topic.topic_code] ?? center));
      const masteryGap = elo - avgElo;
      await pool.query(`
        INSERT INTO user_topic_mastery (
          userid, topicid,
          elo_rating, glicko_rd, glicko_volatility,
          fsrs_state, fsrs_stability, fsrs_difficulty,
          mastery_gap
        )
        VALUES ($1, $2, $3, 200, 0.06, 'new', 1.0, 5.0, $4)
        ON CONFLICT (userid, topicid) DO UPDATE
          SET elo_rating = EXCLUDED.elo_rating,
              mastery_gap = EXCLUDED.mastery_gap
          WHERE user_topic_mastery.fsrs_state = 'new'
      `, [userid, topic.topicid, elo, masteryGap]);
    }

    await pool.query(`UPDATE users SET is_onboarded = TRUE WHERE userid = $1`, [userid]);

    res.json({ message: "Onboarding complete", topics_initialised: topicsResult.rows.length });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;