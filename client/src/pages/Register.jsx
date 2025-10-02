import React, {useState} from 'react';
import { useNavigate, Link } from "react-router";

function Register() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // hide the passwords and add a retype password functionality to it
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
        // setEmail("");
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
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='password...'
                required
                disabled={loading}
              />
              
              <input
                type='password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder='retype password...'
                required
                disabled={loading}
              />
              
              <button type="submit" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
              </button>
            </form>

            
          
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
