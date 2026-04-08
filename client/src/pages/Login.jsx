import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;
  const { login } = useAuth();

  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [rateLimit, setRateLimit] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);
  
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
        login(data.token, data.username, data.is_onboarded ?? false);
        navigate(data.is_onboarded ? "/dashboard" : "/onboarding");
      } else if (response.status === 403 && data.needsVerification) {
        setNeedsVerification(true);
        setUserEmail(data.email || email);
        setError(data.error || "Please verify your email before logging in.");
      } else {
        setError(data.error || data || "Login failed. Please try again.");

        if (data.rateLimitTimer) {
          console.log("rate limiting in action")
        }
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
      const response = await fetch(`${API_URL}/auth/verification/resend`, {
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
              Back for another calm session? Login!
            </p>
          </div>

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
                Your email address has not been verified yet. Please check your inbox for the verification email.
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

          {/* Login Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="email" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#d1d5db',
                marginBottom: '0.25rem'
              }}>
                Email or username
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

            <div>
              <label htmlFor="password" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#d1d5db',
                marginBottom: '0.25rem'
              }}>
                Password
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                  style={{
                    width: '1rem',
                    height: '1rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    accentColor: '#10b981'
                  }}
                />
                <label htmlFor="rememberMe" style={{
                  marginLeft: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#d1d5db'
                }}>
                  Remember me
                </label>
              </div>
              
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                disabled={loading}
                style={{
                  fontSize: '0.875rem',
                  color: '#10b981',
                  background: 'none',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  textDecoration: 'none'
                }}
              >
                Forgot Password?
              </button>
            </div>

            <button 
              type="submit" 
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
                opacity: loading ? 0.5 : 1,
                marginTop: '0.5rem'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#059669')}
              onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#10b981')}
            >
              {loading ? 'Logging in...' : 'Login'}
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

          {/* Google Login */}
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
            {/* Google "G" logo */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Redirecting...' : 'Login with Google'}
          </button>

          {/* Register Link */}
          <div style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#9ca3af'
          }}>
            Don't have an account?{" "}
            <Link to="/register" style={{
              color: '#10b981',
              fontWeight: '500',
              textDecoration: 'none'
            }}>
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;