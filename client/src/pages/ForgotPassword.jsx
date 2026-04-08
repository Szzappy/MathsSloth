import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/password/reset/email`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email})
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setEmailSent(true);
      } else {
        setError(data.error || "An error occurred. Please try again.");
      }
    } catch (error) {
      console.error(error.message);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
        {/* Back to Login */}
        <button 
          onClick={() => navigate('/login')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '0.875rem',
            color: '#9ca3af',
            marginBottom: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0'
          }}
        >
          ← Login
        </button>

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
              marginBottom: '0.5rem' 
            }}>
              Maths Sloth
            </h1>
            <p style={{ fontSize: '1rem', color: '#d1d5db', marginBottom: '0.25rem' }}>
              The sloth forgot their password?
            </p>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>
              Happens to the best of us. Lets get you back in
            </p>
          </div>

          {!emailSent ? (
            <>
              {/* Info Box */}
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #404040',
                borderRadius: '0.5rem',
                display: 'flex',
                gap: '0.75rem'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  color: '#10b981',
                  flexShrink: 0
                }}>
                  ℹ️
                </div>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#d1d5db',
                  lineHeight: '1.5',
                  margin: 0
                }}>
                  Please enter your email address to get started with recovering your account.
                </p>
              </div>

              {/* Error Message */}
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

              {/* Form */}
              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label htmlFor="email" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#d1d5db',
                    marginBottom: '0.25rem'
                  }}>
                    email
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
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Success Info Box */}
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #10b981',
                borderRadius: '0.5rem',
                display: 'flex',
                gap: '0.75rem'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  color: '#10b981',
                  flexShrink: 0
                }}>
                  ℹ️
                </div>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#d1d5db',
                  lineHeight: '1.5',
                  margin: 0
                }}>
                  We're sending you an email with the next steps
                  <br />
                  Delivered to <strong style={{ color: '#10b981' }}>{email}</strong>
                </p>
              </div>

              {/* Instructions Box */}
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #404040',
                borderRadius: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#ffffff',
                  marginBottom: '1rem'
                }}>
                  What now?
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#10b981',
                  fontWeight: '600',
                  marginBottom: '1rem'
                }}>
                  The email has been sent successfully!
                </p>

                {/* Step 1 */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}>
                    ✉
                  </div>
                  <div>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#d1d5db',
                      lineHeight: '1.5',
                      margin: 0
                    }}>
                      <strong>Check your inbox</strong>
                      <br />
                      Look for an email from <strong>Maths Sloth</strong> with subject line <strong>Reset your Password</strong>
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem'
                }}>
                  <div style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}>
                    🔗
                  </div>
                  <div>
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#d1d5db',
                      lineHeight: '1.5',
                      margin: 0
                    }}>
                      <strong>Click the link</strong>
                      <br />
                      Click the link in the email and follow the steps to get logged in, you can close this tab now
                    </p>
                  </div>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;