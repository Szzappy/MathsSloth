import { createContext, useContext, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [userid, setUserid]       = useState(null);
  const [loading, setLoading]     = useState(true);
  // Start as false - always verify from server on load so stale localStorage
  // can never cause an instant redirect to /dashboard
  const [isOnboarded, setIsOnboarded] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;

  const getUserData = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/dashboard/get-user/${userId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.username && data.username.length > 25) {
        data.username = data.username.substring(0, 25) + "...";
      }
      setUser(data.username || null);
      setUserid(userId || null);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem("token");
          localStorage.removeItem("is_onboarded");
          setUser(null);
          setLoading(false);
          return;
        }

        // Set userid immediately from token
        // Dashboard useEffects depend on userid; if it's null they return early and never re-fire when navigating from onboarding without a page refresh
        setUserid(decoded.user);

        // Load username + verify onboarding status from server in parallel
        await Promise.all([
          getUserData(decoded.user),
          (async () => {
            try {
              const res = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                const data = await res.json();
                const onboarded = data.is_onboarded === true;
                setIsOnboarded(onboarded);
                localStorage.setItem("is_onboarded", String(onboarded));
              } else {
                // Fall back to localStorage if /auth/me fails
                setIsOnboarded(localStorage.getItem("is_onboarded") === "true");
              }
            } catch {
              setIsOnboarded(localStorage.getItem("is_onboarded") === "true");
            }
          })(),
        ]);
      } catch (error) {
        console.error("Error decoding token:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("is_onboarded");
        setUser(null);
      }

      setLoading(false);
    };

    init();
  }, []);

  const login = (token, userData, is_onboarded = false) => {
    localStorage.setItem("token", token);
    localStorage.setItem("is_onboarded", String(is_onboarded));
    setUser(userData);
    setIsOnboarded(is_onboarded);
    try {
      const decoded = jwtDecode(token);
      setUserid(decoded.user);
    } catch (e) {
      console.error("login: failed to decode token for userid", e);
    }
  };

  const markOnboarded = () => {
    localStorage.setItem("is_onboarded", "true");
    setIsOnboarded(true);
    // Ensure userid/user are populated before navigating to dashboard
    // getUserData() is async on mount and may not have resolved yet when onboarding finishes, leaving userid null and breaking all fetches
    if (!userid) {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const decoded = jwtDecode(token);
          const uid = decoded.user;
          setUserid(uid);
          getUserData(uid);
        }
      } catch (e) {
        console.error("markOnboarded: failed to decode token", e);
      }
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("is_onboarded");
    setUser(null);
    setUserid(null);
    setIsOnboarded(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, userid, login, logout, loading, getUserData, isOnboarded, markOnboarded }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};