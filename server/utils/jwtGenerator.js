import jwt from "jsonwebtoken";
import "dotenv/config"

const jwtGenerator = (user_id, rememberMe) => {
  const payload = {
    user: user_id
  };

  const expiresIn = (rememberMe ? "7d" : "24hr");
  return jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: expiresIn});
}

export default jwtGenerator;