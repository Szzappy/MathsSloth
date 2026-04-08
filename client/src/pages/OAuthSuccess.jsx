import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OAuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const ran = useRef(false); // prevent double-fire in React StrictMode
  const API_URL = import.meta.env.VITE_API_URL;

  const token = searchParams.get('token');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // Fetch username + is_onboarded so we can route correctly
    const resolve = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.ok ? await res.json() : {};
        login(token, data.username ?? null, data.is_onboarded ?? false);

        setTimeout(() => {
          navigate(data.is_onboarded ? '/dashboard' : '/onboarding', { replace: true });
        }, 1500);
      } catch {
        login(token, null, false);
        setTimeout(() => navigate('/onboarding', { replace: true }), 1500);
      }
    };

    resolve();
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
        <div style={{
          backgroundColor: '#2d2d2d',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          padding: '2.5rem',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '0.25rem' }}>
              🦥 Maths Sloth
            </h1>
          </div>

          <div style={{
            width: '5rem', height: '5rem',
            margin: '0 auto 1.5rem',
            backgroundColor: '#14532d',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', color: '#10b981',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            ✓
          </div>
          <style>{`
            @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } }
          `}</style>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '0.75rem' }}>
            Authentication Successful!
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#10b981', marginBottom: '1rem' }}>
            You've successfully signed in with Google
          </p>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Redirecting you to the app...
          </p>

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            {[0, 0.2, 0.4].map((delay, i) => (
              <div key={i} style={{
                width: '0.5rem', height: '0.5rem',
                backgroundColor: '#10b981', borderRadius: '50%',
                animation: `bounce 1.4s ease-in-out ${delay}s infinite`
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OAuthSuccess;