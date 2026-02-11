import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  console.log("Reset token:", token);
  
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
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/password/reset`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({password, confirmPassword, token})
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log("Password reset successful");
        setSuccess(true);
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch (error) {
      setError("An error occurred. Please try again later.");
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
              Reset Your Password
            </p>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>
              Choose a strong new password for your account
            </p>
          </div>

          {success ? (
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
                  ✓ Password Reset Successful!
                </h3>
                <p style={{ color: '#d1fae5', fontSize: '0.875rem' }}>
                  Your password has been updated. Redirecting to login...
                </p>
              </div>
            </div>
          ) : (
            // Reset Form
            <>
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

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* New Password */}
                <div>
                  <label htmlFor="password" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#d1d5db',
                    marginBottom: '0.25rem'
                  }}>
                    New Password{' '}
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
                      placeholder="Enter new password..."
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
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password..."
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

                {/* Password Requirements Info */}
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #404040',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#9ca3af'
                }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#d1d5db' }}>
                    Password must contain:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: '1.5' }}>
                    <li style={{ color: password.length > 8 ? '#10b981' : '#9ca3af' }}>
                      More than 8 characters
                    </li>
                    <li style={{ color: /[A-Z]/.test(password) ? '#10b981' : '#9ca3af' }}>
                      At least one uppercase letter
                    </li>
                    <li style={{ color: /\d/.test(password) ? '#10b981' : '#9ca3af' }}>
                      At least one number
                    </li>
                    <li style={{ color: /[!@#$%^&*(),.?":{}|<>]/.test(password) ? '#10b981' : '#9ca3af' }}>
                      At least one special character
                    </li>
                  </ul>
                </div>

                {/* Submit Button */}
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
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;