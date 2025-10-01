import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setNeedsVerification(false);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email, password, rememberMe})
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // Login successful
        localStorage.setItem('token', data.token);
        navigate("/dashboard");
      } else if (response.status === 403 && data.needsVerification) {
        // Email not verified
        setNeedsVerification(true);
        setUserEmail(data.email || email);
        setError(data.error || "Please verify your email before logging in.");
      } else {
        // Other errors
        setError(data.error || data || "Login failed. Please try again.");
      }

    } catch (error) {
      console.log("Error logging in,", error.message)
    } finally {
      setLoading(false);
    }
  }

  const handleResendVerification = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail })
      });
      
      const data = await response.json();
      
      if (response.ok)
        setMessage(data.message || "Verification email sent! Please check your inbox.");
      else
        setError(data.error || data || "Failed to resend verification email.");
      
    } catch (error) {
      console.error(error.message);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // button to log in
  // function to handle log in
  return (
    <>
      <h1>Login</h1>
      
      <form onSubmit={handleLogin}>
        {error && (
          <div>
            {error}
          </div>
        )}
        
        {message && (
          <div>
            {message}
          </div>
        )}
        
        {needsVerification && (
          <div>
            <p>
              Your email address has not been verified yet. Please check your inbox for the verification email.
            </p>
            <button type="button" onClick={handleResendVerification} disabled={loading}>
              {loading ? 'Sending...' : 'Resend Verification Email'}
            </button>
          </div>
        )}
        
        <input
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='email...'
          required
          disabled={loading}
        />
        
        <input
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder='password...'
          required
          disabled={loading}
        />
        
        <label>
          <input
            type='checkbox'
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          <span>Remember me</span>
        </label>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      
      <div>
        <p>
          Don't have an account?{' '}
          <Link to="/register">
            Register
          </Link>
        </p>
      </div>
    </>
  );
}

export default Login;