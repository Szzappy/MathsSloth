// components/Navbar.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const token = localStorage.getItem('token');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  let userName = user || 'User';
  
  useEffect(() => {
    setIsDropdownOpen(false);
  }, [location]);
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  
  return (
    <nav style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '16px 24px',
      backgroundColor: '#2d2d2d',
      borderBottom: '1px solid #404040',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {token ? (
        <>
          {/* Logo */}
          <Link 
            to="/dashboard"
            style={{
              fontSize: '26px',
              fontWeight: 'bold',
              color: '#fff',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.color = '#10b981'}
            onMouseLeave={(e) => e.target.style.color = '#fff'}
          >
            🦥 Maths Sloth
          </Link>
          
          {/* User Dropdown */}
          <div
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
            style={{ 
              position: 'relative', 
              marginLeft: 'auto'
            }}
          >
            <button 
              onClick={toggleDropdown} 
              aria-haspopup="true" 
              aria-expanded={isDropdownOpen}
              style={{
                backgroundColor: isDropdownOpen ? '#10b981' : '#1a1a1a',
                color: '#fff',
                border: '1px solid #404040',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isDropdownOpen) {
                  e.target.style.backgroundColor = '#262626';
                  e.target.style.borderColor = '#10b981';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDropdownOpen) {
                  e.target.style.backgroundColor = '#1a1a1a';
                  e.target.style.borderColor = '#404040';
                }
              }}
            >
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                {userName.charAt(0).toUpperCase()}
              </span>
              <span>{userName}</span>
              <span style={{ 
                fontSize: '12px',
                transition: 'transform 0.2s',
                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>
                ▼
              </span>
            </button>
            
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: '#2d2d2d',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  padding: '8px',
                  minWidth: '200px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                  animation: 'fadeIn 0.2s ease',
                  marginTop: '0'
                }}
              >
                <style>{`
                  @keyframes fadeIn {
                    from {
                      opacity: 0;
                      transform: translateY(-8px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                `}</style>
                
                <ul style={{ 
                  listStyle: 'none', 
                  margin: 0, 
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <li>
                    <Link 
                      to={location.pathname === "/dashboard" ? "/analytics" : "/dashboard"}
                      style={{
                        display: 'block',
                        padding: '10px 12px',
                        color: '#d1d5db',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#1a1a1a';
                        e.target.style.color = '#10b981';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#d1d5db';
                      }}
                    >
                      📊 {location.pathname === "/dashboard" ? "Analytics" : "Dashboard"}
                    </Link>
                  </li>
                  <li>
                    <Link 
                      to="/settings"
                      style={{
                        display: 'block',
                        padding: '10px 12px',
                        color: '#d1d5db',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#1a1a1a';
                        e.target.style.color = '#10b981';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#d1d5db';
                      }}
                    >
                      ⚙️ Settings
                    </Link>
                  </li>
                  <li>
                    <hr style={{ 
                      margin: '8px 0', 
                      border: 'none',
                      borderTop: '1px solid #404040'
                    }} />
                  </li>
                  <li>
                    <button 
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        backgroundColor: 'transparent',
                        color: '#ef4444',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#7f1d1d';
                        e.target.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#ef4444';
                      }}
                    >
                      🚪 Logout
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Logo for non-authenticated users */}
          <Link 
            to="/"
            style={{
              fontSize: '26px',
              fontWeight: 'bold',
              color: '#fff',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.color = '#10b981'}
            onMouseLeave={(e) => e.target.style.color = '#fff'}
          >
            🦥 Maths Sloth
          </Link>
          
          {/* Login Button */}
          <Link 
            to="/login"
            style={{
              marginLeft: 'auto',
              backgroundColor: '#10b981',
              color: '#fff',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            Login
          </Link>
        </>
      )}
    </nav>
  );
}

export default Navbar;