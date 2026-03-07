import React, { useState } from 'react';
import { Link } from "react-router-dom";

function Register() {
  const API_URL = import.meta.env.VITE_API_URL;
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreements, setAgreements] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const [needsVerification, setNeedsVerification] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Password strength calculation
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { level: 'weak', color: '#ef4444' };
    
    let score = 0;
    
    // Check for special character
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;
    
    // Check for number
    if (/\d/.test(pwd)) score++;
    
    // Check for uppercase letter
    if (/[A-Z]/.test(pwd)) score++;
    
    // Check for length > 8
    if (pwd.length > 8) score++;
    
    if (score === 4) return { level: 'strong', color: '#10b981' };
    if (score >= 2) return { level: 'moderate', color: '#f59e0b' };
    return { level: 'weak', color: '#ef4444' };
  };

  const passwordStrength = calculatePasswordStrength(password);

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
      const response = await fetch(`${API_URL}/auth/verification/resend`, {
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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{ width: '100%', maxWidth: '28rem' }}>
        {/* Back to Home */}
        <Link 
          to="/" 
          style={{
            display: 'inline-block',
            fontSize: '0.875rem',
            color: '#9ca3af',
            marginBottom: '1rem',
            textDecoration: 'none'
          }}
        >
          ← Home
        </Link>

        {/* Main Card */}
        <div style={{
          backgroundColor: '#2d2d2d',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          padding: '2rem'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ 
              fontSize: '1.75rem', 
              fontWeight: 'bold', 
              color: '#ffffff', 
              marginBottom: '0.25rem' 
            }}>
              Maths Sloth
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
              Join the troop! Register!
            </p>
          </div>

          {registrationSuccess ? (
            // Success Message
            <div>
              <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: '#14532d',
                border: '1px solid #166534',
                borderRadius: '0.5rem',
                textAlign: 'center'
              }}>
                <h3 style={{ 
                  color: '#86efac', 
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  marginBottom: '0.5rem'
                }}>
                  ✓ Registration Successful!
                </h3>
                <p style={{ color: '#d1fae5', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  We've sent a verification email to <strong>{email}</strong>.
                </p>
                <p style={{ color: '#d1fae5', fontSize: '0.875rem' }}>
                  Please check your inbox and click the verification link to activate your account.
                </p>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem', textAlign: 'center' }}>
                Don't see the email? Check your spam folder.
              </p>

              <button 
                onClick={handleResendVerification} 
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
                }}
                onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#059669')}
                onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#10b981')}
              >
                {loading ? 'Sending...' : 'Resend Verification Email'}
              </button>

              {error && (
                <p style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#7f1d1d',
                  border: '1px solid #991b1b',
                  color: '#fca5a5',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem'
                }}>
                  {error}
                </p>
              )}
            </div>
          ) : (
            // Registration Form
            <div>
              {/* Error/Success Messages */}
              {error && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#7f1d1d',
                  border: '1px solid #991b1b',
                  color: '#fca5a5',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem'
                }}>
                  {error}
                </div>
              )}
              
              {message && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#14532d',
                  border: '1px solid #166534',
                  color: '#86efac',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem'
                }}>
                  {message}
                </div>
              )}

              {needsVerification && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  backgroundColor: '#713f12',
                  border: '1px solid #92400e',
                  borderRadius: '0.5rem'
                }}>
                  <p style={{ color: '#fde68a', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                    An unverified account with this email already exists. 
                    Please check your email or request a new verification link.
                  </p>
                  <button 
                    type="button"
                    onClick={handleResendVerification}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#d97706',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.5 : 1
                    }}
                  >
                    {loading ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Username */}
                <div>
                  <label htmlFor="username" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#d1d5db',
                    marginBottom: '0.25rem'
                  }}>
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username..."
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      fontSize: '0.875rem',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #404040',
                      borderRadius: '0.375rem',
                      color: '#ffffff',
                      outline: 'none',
                      cursor: loading ? 'not-allowed' : 'text'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                    onBlur={(e) => e.target.style.borderColor = '#404040'}
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#d1d5db',
                    marginBottom: '0.25rem'
                  }}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email..."
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      fontSize: '0.875rem',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #404040',
                      borderRadius: '0.375rem',
                      color: '#ffffff',
                      outline: 'none',
                      cursor: loading ? 'not-allowed' : 'text'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                    onBlur={(e) => e.target.style.borderColor = '#404040'}
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#d1d5db',
                    marginBottom: '0.25rem'
                  }}>
                    Password{' '}
                    <span style={{ 
                      color: passwordStrength.color, 
                      fontWeight: 'normal' 
                    }}>
                      Strength: {passwordStrength.level}
                    </span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="password..."
                      required
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.625rem 2.5rem 0.625rem 0.75rem',
                        fontSize: '0.875rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #404040',
                        borderRadius: '0.375rem',
                        color: '#ffffff',
                        outline: 'none',
                        cursor: loading ? 'not-allowed' : 'text'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#10b981'}
                      onBlur={(e) => e.target.style.borderColor = '#404040'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                        padding: '0'
                      }}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#d1d5db',
                    marginBottom: '0.25rem'
                  }}>
                    Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="retype password..."
                      required
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.625rem 2.5rem 0.625rem 0.75rem',
                        fontSize: '0.875rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #404040',
                        borderRadius: '0.375rem',
                        color: '#ffffff',
                        outline: 'none',
                        cursor: loading ? 'not-allowed' : 'text'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#10b981'}
                      onBlur={(e) => e.target.style.borderColor = '#404040'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                        padding: '0'
                      }}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {/* Agreements Checkbox */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <input
                    id="agreements"
                    type="checkbox"
                    checked={agreements}
                    onChange={(e) => setAgreements(e.target.checked)}
                    disabled={loading}
                    style={{
                      width: '1rem',
                      height: '1rem',
                      marginTop: '0.125rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      accentColor: '#10b981'
                    }}
                  />
                  <label htmlFor="agreements" style={{
                    fontSize: '0.875rem',
                    color: '#d1d5db',
                    lineHeight: '1.25rem'
                  }}>
                    I agree to the{' '}
                    <Link to="/terms" style={{ color: '#10b981', textDecoration: 'none' }}>
                      Terms and Conditions
                    </Link>
                    {' '}and{' '}
                    <Link to="/privacy" style={{ color: '#10b981', textDecoration: 'none' }}>
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                {/* Register Button */}
                <button 
                  type="submit" 
                  disabled={loading || !agreements}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    backgroundColor: agreements ? '#10b981' : '#404040',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: (loading || !agreements) ? 'not-allowed' : 'pointer',
                    opacity: (loading || !agreements) ? 0.5 : 1,
                    marginTop: '0.5rem'
                  }}
                  onMouseEnter={(e) => agreements && !loading && (e.target.style.backgroundColor = '#059669')}
                  onMouseLeave={(e) => agreements && !loading && (e.target.style.backgroundColor = '#10b981')}
                >
                  {loading ? 'Registering...' : 'Register'}
                </button>
              </form>

              {/* Divider */}
              <div style={{ position: 'relative', margin: '1.5rem 0' }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{ width: '100%', borderTop: '1px solid #404040' }}></div>
                </div>
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  fontSize: '0.75rem'
                }}>
                  <span style={{
                    padding: '0 0.5rem',
                    backgroundColor: '#2d2d2d',
                    color: '#6b7280'
                  }}>or</span>
                </div>
              </div>

              {/* Google Register */}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setMessage("");
                  setLoading(true);
                  window.location.href = `${API_URL}/auth/google`;
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#1a1a1a',
                  color: '#d1d5db',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  borderRadius: '0.5rem',
                  border: '1px solid #404040',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#262626')}
                onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#1a1a1a')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Redirecting...' : 'Register with Google'}
              </button>

              {/* Login Link */}
              <div style={{
                marginTop: '1.5rem',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: '#9ca3af'
              }}>
                Already have an account?{' '}
                <Link to="/login" style={{
                  color: '#10b981',
                  fontWeight: '500',
                  textDecoration: 'none'
                }}>
                  Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Register;