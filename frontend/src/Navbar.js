import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Navbar = ({ permissions }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleNavigation = (action) => {
    closeMobileMenu();
    if (typeof action === 'function') {
      action();
    }
  };

  return (
    <>
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
          height: '50px',
          position: 'relative'
        }}
      >
        {/* Mobile Hamburger Button */}
        <button
          className="mobile-menu-toggle"
          onClick={toggleMobileMenu}
          style={{
            display: 'none',
            position: 'absolute',
            left: 'var(--spacing-md)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: 'var(--spacing-xs)',
            zIndex: 1001
          }}
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>

        {/* Desktop Navigation Links */}
        <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
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
        </div>
      </nav>

      {/* Mobile Dropdown Menu */}
      <div
        className={`mobile-nav-menu ${isMobileMenuOpen ? 'open' : ''}`}
        style={{
          display: 'none',
          position: 'fixed',
          top: '50px',
          left: 0,
          width: '100%',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-secondary)',
          zIndex: 1000,
          maxHeight: isMobileMenuOpen ? '400px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease-in-out',
          boxShadow: isMobileMenuOpen ? 'var(--shadow-lg)' : 'none'
        }}
      >
        <div style={{ padding: 'var(--spacing-sm) 0' }}>
          <Link
            className={`nav-link-mobile ${location.pathname === '/dashboard' || location.pathname === '/' ? 'active' : ''}`}
            to="/dashboard"
            onClick={closeMobileMenu}
            style={{
              display: 'block',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              color: location.pathname === '/dashboard' || location.pathname === '/' ? 'var(--accent-blue)' : 'var(--text-primary)',
              textDecoration: 'none',
              borderLeft: location.pathname === '/dashboard' || location.pathname === '/' ? '4px solid var(--accent-blue)' : '4px solid transparent',
              background: location.pathname === '/dashboard' || location.pathname === '/' ? 'rgba(54, 162, 235, 0.1)' : 'transparent',
              transition: 'var(--transition-fast)',
              fontSize: 'var(--font-size-base)',
              fontWeight: location.pathname === '/dashboard' || location.pathname === '/' ? 'var(--font-weight-semibold)' : 'normal'
            }}
          >
            🏠 Dashboard
          </Link>
          <button
            className={`nav-link-mobile ${location.pathname.startsWith('/ad-object') ? 'active' : ''}`}
            onClick={() => handleNavigation(handleADPropertiesClick)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              color: location.pathname.startsWith('/ad-object') ? 'var(--accent-blue)' : 'var(--text-primary)',
              background: location.pathname.startsWith('/ad-object') ? 'rgba(54, 162, 235, 0.1)' : 'transparent',
              border: 'none',
              borderLeft: location.pathname.startsWith('/ad-object') ? '4px solid var(--accent-blue)' : '4px solid transparent',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              fontSize: 'var(--font-size-base)',
              fontWeight: location.pathname.startsWith('/ad-object') ? 'var(--font-weight-semibold)' : 'normal'
            }}
          >
            👤 AD Object
          </button>
          <Link
            className={`nav-link-mobile ${location.pathname === '/Profile' ? 'active' : ''}`}
            to="/Profile"
            onClick={closeMobileMenu}
            style={{
              display: 'block',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              color: location.pathname === '/Profile' ? 'var(--accent-blue)' : 'var(--text-primary)',
              textDecoration: 'none',
              borderLeft: location.pathname === '/Profile' ? '4px solid var(--accent-blue)' : '4px solid transparent',
              background: location.pathname === '/Profile' ? 'rgba(54, 162, 235, 0.1)' : 'transparent',
              transition: 'var(--transition-fast)',
              fontSize: 'var(--font-size-base)',
              fontWeight: location.pathname === '/Profile' ? 'var(--font-weight-semibold)' : 'normal'
            }}
          >
            👨‍💼 Profile
          </Link>
          <Link
            className={`nav-link-mobile ${location.pathname === '/dashboard-legacy' ? 'active' : ''}`}
            to="/dashboard-legacy"
            onClick={closeMobileMenu}
            style={{
              display: 'block',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              color: location.pathname === '/dashboard-legacy' ? 'var(--accent-blue)' : 'var(--text-primary)',
              textDecoration: 'none',
              borderLeft: location.pathname === '/dashboard-legacy' ? '4px solid var(--accent-blue)' : '4px solid transparent',
              background: location.pathname === '/dashboard-legacy' ? 'rgba(54, 162, 235, 0.1)' : 'transparent',
              transition: 'var(--transition-fast)',
              fontSize: 'var(--font-size-base)',
              fontWeight: location.pathname === '/dashboard-legacy' ? 'var(--font-weight-semibold)' : 'normal'
            }}
          >
            📊 Legacy View
          </Link>
          {permissions.includes('access_configure_page') && (
            <Link
              className={`nav-link-mobile ${location.pathname === '/configure' ? 'active' : ''}`}
              to="/configure"
              onClick={closeMobileMenu}
              style={{
                display: 'block',
                padding: 'var(--spacing-md) var(--spacing-lg)',
                color: location.pathname === '/configure' ? 'var(--accent-blue)' : 'var(--text-primary)',
                textDecoration: 'none',
                borderLeft: location.pathname === '/configure' ? '4px solid var(--accent-blue)' : '4px solid transparent',
                background: location.pathname === '/configure' ? 'rgba(54, 162, 235, 0.1)' : 'transparent',
                transition: 'var(--transition-fast)',
                fontSize: 'var(--font-size-base)',
                fontWeight: location.pathname === '/configure' ? 'var(--font-weight-semibold)' : 'normal'
              }}
            >
              ⚙️ Configure
            </Link>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;