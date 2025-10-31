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

  // Get user's name from context or use a default
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
    <nav style={{ display: 'flex', alignItems: 'center', padding: '8px 16px' }}>
      {token ? (
        <>
          <Link to="/dashboard">
            Maths Sloth
          </Link>

          <div
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
            style={{ position: 'relative', marginLeft: 'auto', cursor: 'pointer' }}
          >
            <button onClick={toggleDropdown} aria-haspopup="true" aria-expanded={isDropdownOpen}>
              {userName} ↓
            </button>

            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  padding: '8px',
                  minWidth: '150px',
                  zIndex: 1000
                }}
              >
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  <li>
                    <Link to={location.pathname === "/dashboard" ? "/analytics" : "/dashboard"}>
                      {location.pathname === "/dashboard" ? "Analytics" : "Dashboard"}
                    </Link>
                  </li>
                  <li>
                    <Link to="/settings">
                      Settings
                    </Link>
                  </li>
                  <li>
                    <hr style={{ margin: '4px 0' }} />
                  </li>
                  <li>
                    <button onClick={handleLogout} style={{ width: '100%', textAlign: 'left' }}>
                      Logout
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </>
      ) : (
        <Link to="/login">
          Login
        </Link>
      )}
    </nav>
  );
}

export default Navbar;