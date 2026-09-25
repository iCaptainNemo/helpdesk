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

  // Single source of truth for nav items - rendered once. Labels are hidden via CSS
  // on small screens (see .nav-label in mobile.css) so mobile gets icon-only buttons
  // instead of the old hamburger/dropdown overlay.
  const navItems = [
    {
      key: 'dashboard',
      to: '/dashboard',
      icon: 'bx bx-home-alt',
      label: 'Dashboard',
      match: (p) => p === '/dashboard' || p === '/',
    },
    {
      key: 'ad-object',
      icon: 'bx bx-id-card',
      label: 'AD Object',
      onClick: handleADPropertiesClick,
      match: (p) => p.startsWith('/ad-object'),
    },
    {
      key: 'profile',
      to: '/Profile',
      icon: 'bx bx-user-circle',
      label: 'Profile',
      match: (p) => p === '/Profile',
    },
    {
      key: 'configure',
      to: '/configure',
      icon: 'bx bx-cog',
      label: 'Configure',
      permission: 'access_configure_page',
      match: (p) => p === '/configure',
    },
  ];

  const getNavLinkStyle = (isActive) => ({
    background: isActive ? 'var(--accent-blue)' : 'none',
    border: 'none',
    color: isActive ? 'white' : 'var(--text-secondary)',
    cursor: 'pointer',
    // Below the smallest spacing token (--spacing-xs is 4px) - the token scale is
    // fixed in px and doesn't shrink with font-size, so at xs/sm the button padding
    // still dwarfed the now-tiny text. Raw values here to keep shrinking past that.
    padding: '2px 6px',
    borderRadius: 'var(--border-radius-sm)',
    textDecoration: 'none',
    transition: 'var(--transition-fast)',
    fontWeight: 'normal',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  });

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
        gap: 'var(--spacing-sm)',
        height: '28px',
      }}
    >
      {navItems.map((item) => {
        if (item.permission && !permissions.includes(item.permission)) {
          return null;
        }

        const isActive = item.match(location.pathname);
        const className = `nav-link ${isActive ? 'active' : ''}`;
        const content = (
          <>
            <i className={item.icon} aria-hidden="true"></i>
            <span className="nav-label">{item.label}</span>
          </>
        );

        if (item.onClick) {
          return (
            <button
              key={item.key}
              className={className}
              onClick={item.onClick}
              style={getNavLinkStyle(isActive)}
              aria-label={item.label}
              title={item.label}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={item.key}
            className={className}
            to={item.to}
            style={getNavLinkStyle(isActive)}
            aria-label={item.label}
            title={item.label}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
};

export default Navbar;
