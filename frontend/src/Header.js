import React from 'react';

const Header = ({ AdminID, onLogout, onFormSubmit }) => {
  const handleFormSubmit = (event) => {
    event.preventDefault();
    const adObjectID = event.target.adObjectID.value;
    console.log('AD Object ID:', adObjectID); // Debug log

    if (!adObjectID) {
      console.error('AD Object ID is empty');
      return;
    }

    onFormSubmit(adObjectID);
  };

  return (
    <header 
      className="dashboard-header"
      style={{
        height: 'var(--header-height)',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--spacing-lg)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)'
      }}
    >
      {/* Left side - Welcome */}
      <div style={{ color: 'var(--text-primary)', fontWeight: 'var(--font-weight-semibold)', flex: '1' }}>
        Welcome, {AdminID}
      </div>
      
      {/* Center - AD Object ID Search */}
      <form 
        id="fetchAdObjectForm" 
        onSubmit={handleFormSubmit}
        className="flex items-center gap-sm"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: '1', justifyContent: 'center' }}
      >
        <label htmlFor="adObjectID" className="text-sm text-secondary" style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          AD Object:
        </label>
        <input 
          type="text" 
          id="adObjectID" 
          name="adObjectID" 
          placeholder="Enter User ID"
          className="px-sm py-xs bg-bg-card border border-border-primary rounded-sm text-sm placeholder-text-muted"
          style={{ 
            width: '140px', 
            color: '#ffffff',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-sm)'
          }}
        />
        <button 
          type="submit"
          className="px-sm py-xs bg-accent-blue text-white rounded-sm text-xs hover-lift transition"
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            background: 'var(--accent-blue)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-xs)',
            cursor: 'pointer',
            transition: 'var(--transition-fast)'
          }}
        >
          Go
        </button>
      </form>
      
      {/* Right side - Logout */}
      <div style={{ flex: '1', display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          onClick={onLogout}
          className="logout-button"
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background: 'var(--status-error)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
            transition: 'var(--transition-fast)'
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;