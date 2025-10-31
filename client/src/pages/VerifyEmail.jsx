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
  const verified = useRef(false)

  useEffect(() => {
    const token = searchParams.get('token');
    
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
      const response = await fetch(`${API_URL}/auth/verify-email?token=${token}`);
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

          // login(data.token, decoded.user);
          
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
    <div>
      {status === 'verifying' && (
        <div>
          <div>
            ⏳
          </div>
          <h2>Verifying your email...</h2>
          <p>Please wait while we verify your email address.</p>
        </div>
      )}

      {status === 'success' && (
        <div>
          <div>✓</div>
          <h2>Email Verified!</h2>
          <p>{message}</p>
          <p>
            Redirecting you to the dashboard...
          </p>
          <Link to="/dashboard">
            Go to Dashboard Now
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div>
          <div>✗</div>
          <h2>Verification Failed</h2>
          <p>{message}</p>
          
          <div style={{ marginTop: '2rem' }}>
            <Link to="/login">
              Go to Login
            </Link>
            <Link to="/register">
              Register Again
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default VerifyEmail;