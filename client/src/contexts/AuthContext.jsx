import { createContext, useContext, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userid, setUserid] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL;


  const getUserData = async (userId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/dashboard/get-user/${userId}`, {
        method: "GET",
        headers: {"Content-Type": "application/json"}
      });
      console.log("HELLO THIS IS RESPONSE", response)
      const data = await response.json();
      // check if username is longer than 25 characters, if so truncate it
      if (data.username && data.username.length > 25) {
        data.username = data.username.substring(0, 25) + "...";
      }

      setUser(data.username || null);
      setUserid(userId || null);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem("token");
          setUser(null);
        } else {
          console.log("Decoded token:", decoded.user);
          getUserData(decoded.user);
        }
      } catch (error) {
        console.error("Error decoding token:", error);
        localStorage.removeItem("token");
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("token", token);
    console.log("userData in login:", userData);
    setUser(userData);
  };

  // can't call useNavigate() here directly because it's outside a component
  const logout = () => {
    console.log("Logging out");
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, userid, login, logout, loading, getUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};