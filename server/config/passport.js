import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import pool from "../config/db.js"

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // check if user already exists
        const existingUser = await pool.query(
          "SELECT * FROM users WHERE email = $1",
          [profile.emails[0].value]
        );

        const nonOAuthUser = await pool.query(
          "SELECT * FROM users WHERE email = $1 AND using_oauth = false",
          [profile.emails[0].value]
        );

        if (nonOAuthUser.rows.length > 0) {
          return done(null, false, { message: "An account with this email already exists. Please log in using your email and password." });
        }

        if (existingUser.rows.length > 0) {
          return done(null, existingUser.rows[0]);
        }

        // if not, create one
        const newUser = await pool.query(
          "INSERT INTO users (username, email, is_verified, using_oauth) VALUES ($1, $2, $3, $4) RETURNING *",
          [profile.displayName, profile.emails[0].value, true, true]
        );

        return done(null, newUser.rows[0]);
      } catch (err) {
        console.error("Passport error:", err);
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.userid);
});

passport.deserializeUser(async (id, done) => {
  try {
    const res = await pool.query("SELECT * FROM users WHERE userid = $1", [id]);
    done(null, res.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
