import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { jwtDecode } from "jwt-decode";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;
  const { login, getUserData } = useAuth();
  
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  const verified = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const alreadyExistingToken = localStorage.getItem('token');
    
    if (alreadyExistingToken) {
      navigate('/dashboard');
      return;
    }
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }
    
    if (verified.current)
      return;
    
    verified.current = true;
    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      const response = await fetch(`${API_URL}/auth/email/verify?token=${token}`);
      const data = await response.json();
      
      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'Email verified successfully!');
        
        // Store the JWT token if provided
        if (data.token) {
          localStorage.setItem('token', data.token);
          const decoded = jwtDecode(data.token);
          console.log("Decoded token after verification:", decoded.user);
          getUserData(decoded.user);
          
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
          return;
        }
      } else {
        setStatus('error');
        setMessage(data.error || data || 'Verification failed. The link may be invalid or expired.');
      }
    } catch (error) {
      console.error(error.message);
      setStatus('error');
      setMessage('Network error. Please try again later.');
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
        {/* Main Card */}
        <div style={{
          backgroundColor: '#2d2d2d',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          padding: '2.5rem',
          textAlign: 'center'
        }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ 
              fontSize: '1.75rem', 
              fontWeight: 'bold', 
              color: '#ffffff', 
              marginBottom: '0.25rem' 
            }}>
              Maths Sloth
            </h1>
          </div>

          {/* VERIFYING STATE */}
          {status === 'verifying' && (
            <div>
              {/* Spinning Animation */}
              <div style={{
                fontSize: '4rem',
                marginBottom: '1.5rem',
                animation: 'spin 2s linear infinite'
              }}>
                ⏳
              </div>
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
              
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: '0.75rem'
              }}>
                Verifying your email...
              </h2>
              
              <p style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                lineHeight: '1.5'
              }}>
                Please wait while we verify your email address.
              </p>
            </div>
          )}

          {/* SUCCESS STATE */}
          {status === 'success' && (
            <div>
              {/* Success Icon */}
              <div style={{
                width: '5rem',
                height: '5rem',
                margin: '0 auto 1.5rem',
                backgroundColor: '#14532d',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                color: '#10b981'
              }}>
                ✓
              </div>
              
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: '0.75rem'
              }}>
                Email Verified!
              </h2>
              
              <p style={{
                fontSize: '0.875rem',
                color: '#10b981',
                marginBottom: '1rem',
                lineHeight: '1.5'
              }}>
                {message}
              </p>
              
              <p style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                marginBottom: '1.5rem'
              }}>
                Redirecting you to the dashboard...
              </p>
              
              <Link 
                to="/dashboard"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                Go to Dashboard Now
              </Link>
            </div>
          )}

          {/* ERROR STATE */}
          {status === 'error' && (
            <div>
              {/* Error Icon */}
              <div style={{
                width: '5rem',
                height: '5rem',
                margin: '0 auto 1.5rem',
                backgroundColor: '#7f1d1d',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                color: '#ef4444'
              }}>
                ✗
              </div>
              
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: '0.75rem'
              }}>
                Verification Failed
              </h2>
              
              <p style={{
                fontSize: '0.875rem',
                color: '#fca5a5',
                marginBottom: '2rem',
                lineHeight: '1.5'
              }}>
                {message}
              </p>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <Link 
                  to="/login"
                  style={{
                    display: 'block',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                >
                  Go to Login
                </Link>
                
                <Link 
                  to="/register"
                  style={{
                    display: 'block',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#1a1a1a',
                    color: '#d1d5db',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '0.5rem',
                    border: '1px solid #404040',
                    textDecoration: 'none',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#262626'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#1a1a1a'}
                >
                  Register Again
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;