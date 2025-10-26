import React, {useState} from 'react';
import { Link } from "react-router";

function Register() {
  const API_URL = import.meta.env.VITE_API_URL;
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // hide the passwords and add a retype password functionality to it
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreements, setAgreements] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const [needsVerification, setNeedsVerification] = useState(false);
  const [userEmail, setUserEmail] = useState(""); // stores email to resend verification email to 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({username, email, password, confirmPassword})
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Registration successful - show verification message
        setMessage(data.message || "Registration successful! Please check your email to verify your account.");
        setRegistrationSuccess(true);
        
        setUsername("");
        setPassword("");
        setConfirmPassword("");
      } else if (response.status === 409 && data.needsVerification) {
        setError(data.error);
        setUserEmail(data.email || email);
        setNeedsVerification(true);
      } else {
        setError(data.error || data || "Registration failed. Please try again.");
      }
      
    } catch (error) {
      console.error(error.message);
      setError("Network error. Please try again.");
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
        body: JSON.stringify({ email: userEmail || email })
      });
      
      const data = await response.json();
      
      if (response.ok)
        setMessage(data.message || "Verification email sent!");
      else
        setError(data.error || data || "Failed to resend verification email.");

      if (data.status === 429) 
        setError(data.error)
      
    } catch (error) {
      console.error(error.message);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (<>
  <h1>Register</h1>

  {registrationSuccess ? (
        // Show success message after registration
        <div>
          <h3 >✓ Registration Successful!</h3>
          <p>
            We've sent a verification email to <strong>{email}</strong>. 
            Please check your inbox and click the verification link to activate your account.
          </p>
          <p>
            Don't see the email? Check your spam folder.
          </p>
          <button onClick={handleResendVerification} disabled={loading}>
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>
          <p>{error}</p>
        </div>
      ) : (
        // Show registration form
        <div>
          {needsVerification ? (
              <div className="warning-message">
                <p>
                  An unverified account with this email already exists. 
                  Please check your email or request a new verification link.
                </p>
                <button 
                  type="button"
                  onClick={handleResendVerification}
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Resend Verification Email'}
                </button>
              </div>
            ) : (
          <div>
            <form onSubmit={handleSubmit}>
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

              <input
                type='text'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder='username...'
                required
                disabled={loading}
              />
              
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='email...'
                required
                disabled={loading}
              />
              
              <input
                type= {showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='password...'
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide Password' : 'Show Password'}
              </button>

              <input
                type= {showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder='retype password...'
                required
                disabled={loading}
              />

              <input
                type="checkbox"
                checked={agreements}
                onChange={(e) => setAgreements(e.target.checked)}
                disabled={loading}
              />
              <label> I agree to the <Link to="/terms">Terms and Conditions</Link> and <Link to="/privacy">Privacy Policy</Link></label>

              <button type="submit" disabled={loading || !agreements}>
                {loading ? 'Registering...' : 'Register'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setError("");
                setMessage("");
                setLoading(true);
                // Redirect the browser to the backend Google OAuth endpoint
                window.location.href = `${API_URL}/auth/google`;
              }}
              disabled={loading}
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? 'Redirecting...' : 'Register with Google'}
            </button>
          
            <div style={{ marginTop: '1rem' }}>
              <p>
                Already have an account?{' '}
                <Link to="/login">
                  Login
                </Link>
              </p>
            </div> 
          </div>
        )}
        </div>
      )}
  </>)
}

export default Register