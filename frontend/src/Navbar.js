import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Navbar = ({ permissions }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleADPropertiesClick = () => {
    const currentADObjectID = localStorage.getItem('currentADObjectID');
    if (currentADObjectID) {
      navigate(`/ad-object/${currentADObjectID}`);
    } else {
      navigate('/ad-object');
    }
  };

  // Helper function for navigation styling
  const getNavLinkStyle = (path, isButton = false) => {
    const isActive = location.pathname === path || 
                    (path === '/dashboard' && location.pathname === '/') ||
                    (path === '/ad-object' && location.pathname.startsWith('/ad-object'));
    
    return {
      background: isActive ? 'var(--accent-blue)' : 'none',
      border: 'none',
      color: isActive ? 'white' : 'var(--text-secondary)',
      cursor: 'pointer',
      padding: 'var(--spacing-sm) var(--spacing-md)',
      borderRadius: 'var(--border-radius-sm)',
      textDecoration: 'none',
      transition: 'var(--transition-fast)',
      fontWeight: isActive ? 'var(--font-weight-semibold)' : 'normal',
      ':hover': !isActive ? {
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)'
      } : {}
    };
  };

  return (
    <nav 
      className="navbar"
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-secondary)',
        padding: '0 var(--spacing-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-lg)',
        height: '50px'
      }}
    >
      <Link 
        className={`nav-link ${location.pathname === '/dashboard' || location.pathname === '/' ? 'active' : ''}`}
        to="/dashboard"
        style={getNavLinkStyle('/dashboard')}
      >
        🏠 Dashboard
      </Link>
      <button 
        className={`nav-link ${location.pathname.startsWith('/ad-object') ? 'active' : ''}`}
        onClick={handleADPropertiesClick}
        style={getNavLinkStyle('/ad-object', true)}
      >
        👤 AD Object
      </button>
      <Link 
        className={`nav-link ${location.pathname === '/Profile' ? 'active' : ''}`}
        to="/Profile"
        style={getNavLinkStyle('/Profile')}
      >
        👨‍💼 Profile
      </Link>
      <Link 
        className={`nav-link ${location.pathname === '/dashboard-legacy' ? 'active' : ''}`}
        to="/dashboard-legacy"
        style={getNavLinkStyle('/dashboard-legacy')}
      >
        📊 Legacy View
      </Link>
      {permissions.includes('access_configure_page') && (
        <Link 
          className={`nav-link ${location.pathname === '/configure' ? 'active' : ''}`}
          to="/configure"
          style={getNavLinkStyle('/configure')}
        >
          ⚙️ Configure
        </Link>
      )}
    </nav>
  );
};

export default Navbar;