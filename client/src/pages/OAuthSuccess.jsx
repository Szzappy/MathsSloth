import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const OAuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      // Store the token
      localStorage.setItem('token', token);
      
      // Redirect to dashboard after a brief delay to show success message
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    } else {
      // No token found, redirect to login
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

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
            color: '#10b981',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            ✓
          </div>

          <style>{`
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
          `}</style>
          
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: '0.75rem'
          }}>
            Authentication Successful!
          </h2>
          
          <p style={{
            fontSize: '0.875rem',
            color: '#10b981',
            marginBottom: '1rem'
          }}>
            You've successfully signed in with Google
          </p>
          
          <p style={{
            fontSize: '0.875rem',
            color: '#9ca3af'
          }}>
            Redirecting you to the app...
          </p>

          {/* Loading dots animation */}
          <div style={{
            marginTop: '1.5rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            <div style={{
              width: '0.5rem',
              height: '0.5rem',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out infinite'
            }}></div>
            <div style={{
              width: '0.5rem',
              height: '0.5rem',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out 0.2s infinite'
            }}></div>
            <div style={{
              width: '0.5rem',
              height: '0.5rem',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              animation: 'bounce 1.4s ease-in-out 0.4s infinite'
            }}></div>
          </div>

          <style>{`
            @keyframes bounce {
              0%, 80%, 100% { transform: translateY(0); }
              40% { transform: translateY(-10px); }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
};

export default OAuthSuccess;