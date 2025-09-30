import jwt from "jsonwebtoken";
import "dotenv/config";

const authMiddleware = async (req, res, next) => {
  try {
    const jwtToken = req.header('token');
    if (!jwtToken) {
      return res.status(403).json("Not authorised")
    }

    const payload = jwt.verify(jwtToken, process.env.JWT_SECRET);
    req.user = payload.user;
    console.log("authMiddleware.js 13: ", req.user)
    
  } catch (error) {
    console.error(error.message);
    return res.status(403).json("Not authorised")
  }
  next();
}

export default authMiddleware;