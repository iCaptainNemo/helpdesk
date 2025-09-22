import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/theme.css';

const Sidebar = ({ 
  isOpen = true, 
  onToggle, 
  permissions = [],
  userProfile = {}
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState({});

  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '🏠',
      path: '/dashboard',
      permission: null // Always visible
    },
    {
      id: 'active-issues',
      label: 'Active Issues',
      icon: '🚨',
      path: '/active-issues',
      permission: null,
      badge: 7 // Dynamic badge for locked users count
    },
    {
      id: 'ad-lookup',
      label: 'AD Lookup',
      icon: '🔍',
      path: '/ad-lookup',
      permission: null,
      submenu: [
        {
          id: 'user-search',
          label: 'User Search',
          path: '/ad-lookup/users',
          icon: '👤'
        },
        {
          id: 'computer-search',
          label: 'Computer Search',
          path: '/ad-lookup/computers',
          icon: '💻'
        },
        {
          id: 'group-search',
          label: 'Group Search',
          path: '/ad-lookup/groups',
          icon: '👥'
        }
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📊',
      path: '/analytics',
      permission: 'view_reports'
    },
    {
      id: 'bulk-operations',
      label: 'Bulk Operations',
      icon: '⚡',
      path: '/bulk-operations',
      permission: 'manage_users',
      submenu: [
        {
          id: 'bulk-unlock',
          label: 'Bulk Unlock',
          path: '/bulk-operations/unlock',
          icon: '🔓'
        },
        {
          id: 'bulk-reset',
          label: 'Password Reset',
          path: '/bulk-operations/reset',
          icon: '🔑'
        }
      ]
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: '📋',
      path: '/reports',
      permission: 'view_reports',
      submenu: [
        {
          id: 'daily-summary',
          label: 'Daily Summary',
          path: '/reports/daily',
          icon: '📅'
        },
        {
          id: 'user-activity',
          label: 'User Activity',
          path: '/reports/activity',
          icon: '📈'
        },
        {
          id: 'system-health',
          label: 'System Health',
          path: '/reports/health',
          icon: '🩺'
        }
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      path: '/settings',
      permission: 'access_configure_page',
      submenu: [
        {
          id: 'profile',
          label: 'Profile',
          path: '/profile',
          icon: '👤'
        },
        {
          id: 'configuration',
          label: 'Configuration',
          path: '/configure',
          icon: '🔧'
        },
        {
          id: 'system-settings',
          label: 'System',
          path: '/settings/system',
          icon: '⚙️'
        }
      ]
    }
  ];

  // Check if user has permission for menu item
  const hasPermission = (permission) => {
    if (!permission) return true;
    return permissions.includes(permission);
  };

  // Filter navigation items based on permissions
  const filteredNavItems = navigationItems.filter(item => hasPermission(item.permission));

  const toggleSubmenu = (itemId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const isActiveRoute = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const sidebarClasses = [
    'sidebar',
    isOpen ? 'sidebar-open' : 'sidebar-collapsed',
    'transition'
  ].join(' ');

  return (
    <>
      {/* Sidebar Styles */}
      <style jsx>{`
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-secondary);
          z-index: var(--z-fixed);
          overflow-y: auto;
          overflow-x: hidden;
          box-shadow: var(--shadow-lg);
        }

        .sidebar-open {
          width: var(--sidebar-width);
        }

        .sidebar-collapsed {
          width: 70px;
        }

        .sidebar-header {
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--divider);
          background: var(--primary-gradient);
          color: white;
          position: relative;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
        }

        .sidebar-toggle {
          position: absolute;
          top: 50%;
          right: var(--spacing-md);
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: white;
          font-size: var(--font-size-lg);
          cursor: pointer;
          padding: var(--spacing-xs);
          border-radius: var(--border-radius-sm);
          transition: var(--transition-fast);
        }

        .sidebar-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .sidebar-nav {
          padding: var(--spacing-md) 0;
        }

        .nav-item {
          margin: 0 var(--spacing-sm) var(--spacing-xs) var(--spacing-sm);
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: var(--border-radius-md);
          transition: var(--transition-fast);
          cursor: pointer;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          position: relative;
        }

        .nav-link:hover {
          background: var(--bg-card);
          color: var(--text-primary);
        }

        .nav-link.active {
          background: var(--primary-gradient);
          color: white;
          box-shadow: var(--shadow-md);
        }

        .nav-icon {
          font-size: var(--font-size-lg);
          flex-shrink: 0;
        }

        .nav-label {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
        }

        .nav-badge {
          background: var(--status-error);
          color: white;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }

        .nav-arrow {
          font-size: var(--font-size-sm);
          transition: var(--transition-fast);
        }

        .nav-arrow.expanded {
          transform: rotate(90deg);
        }

        .submenu {
          margin-top: var(--spacing-xs);
          margin-left: var(--spacing-lg);
          border-left: 2px solid var(--divider);
          padding-left: var(--spacing-sm);
        }

        .submenu-item {
          margin-bottom: var(--spacing-xs);
        }

        .submenu-link {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-xs) var(--spacing-sm);
          color: var(--text-muted);
          text-decoration: none;
          border-radius: var(--border-radius-sm);
          transition: var(--transition-fast);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-normal);
        }

        .submenu-link:hover {
          background: var(--bg-card);
          color: var(--text-primary);
        }

        .submenu-link.active {
          background: var(--accent-blue);
          color: white;
        }

        .submenu-icon {
          font-size: var(--font-size-sm);
        }

        .sidebar-footer {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: var(--spacing-md);
          border-top: 1px solid var(--divider);
          background: var(--bg-secondary);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm);
          border-radius: var(--border-radius-md);
          background: var(--bg-card);
          border: 1px solid var(--border-secondary);
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
        }

        .user-info {
          flex: 1;
          min-width: 0;
        }

        .user-name {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Collapsed state adjustments */
        .sidebar-collapsed .nav-label,
        .sidebar-collapsed .nav-badge,
        .sidebar-collapsed .nav-arrow,
        .sidebar-collapsed .submenu,
        .sidebar-collapsed .sidebar-footer {
          display: none;
        }

        .sidebar-collapsed .nav-link {
          justify-content: center;
          padding: var(--spacing-sm);
        }

        .sidebar-collapsed .sidebar-header {
          padding: var(--spacing-md) var(--spacing-sm);
        }

        .sidebar-collapsed .sidebar-logo {
          justify-content: center;
        }

        .sidebar-collapsed .sidebar-toggle {
          position: static;
          transform: none;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .sidebar-open {
            width: 100%;
            max-width: var(--sidebar-width);
          }
        }
      `}</style>

      <div className={sidebarClasses}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="text-2xl">🤖</span>
            {isOpen && <span>Helpdesk Jarvis</span>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={onToggle}
            title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {filteredNavItems.map(item => (
            <div key={item.id} className="nav-item">
              <div
                className={`nav-link ${isActiveRoute(item.path, !item.submenu) ? 'active' : ''}`}
                onClick={() => {
                  if (item.submenu) {
                    toggleSubmenu(item.id);
                  } else {
                    handleNavigation(item.path);
                  }
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                {isOpen && (
                  <>
                    <span className="nav-label">{item.label}</span>
                    {item.badge && (
                      <span className="nav-badge">{item.badge}</span>
                    )}
                    {item.submenu && (
                      <span className={`nav-arrow ${expandedMenus[item.id] ? 'expanded' : ''}`}>
                        ▶
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Submenu */}
              {isOpen && item.submenu && expandedMenus[item.id] && (
                <div className="submenu">
                  {item.submenu.map(subItem => (
                    <div key={subItem.id} className="submenu-item">
                      <div
                        className={`submenu-link ${isActiveRoute(subItem.path, true) ? 'active' : ''}`}
                        onClick={() => handleNavigation(subItem.path)}
                      >
                        <span className="submenu-icon">{subItem.icon}</span>
                        <span>{subItem.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer with User Profile */}
        {isOpen && (
          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="user-avatar">
                {userProfile.AdminID ? userProfile.AdminID.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-info">
                <div className="user-name">
                  {userProfile.AdminID || 'User'}
                </div>
                <div className="user-role">
                  Help Desk Agent
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;