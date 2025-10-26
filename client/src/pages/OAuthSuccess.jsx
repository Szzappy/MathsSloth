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
      
      // Redirect to dashboard or home page
      navigate('/dashboard', { replace: true });
    } else {
      // No token found, redirect to login
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Authentication Successful!</h2>
      <p>Redirecting you to the app...</p>
    </div>
  );
};

export default OAuthSuccess;