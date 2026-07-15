import React, { useState, useEffect } from 'react';
import { apiGet } from '../utils/api';
import '../styles/TickerTape.css';

const TickerTape = ({ className = '' }) => {
  const [tickerData, setTickerData] = useState({
    lockedUsers: 0,
    recentLockout: null,
    totalUnlocks: 0,
    offlineServers: 0,
    offlineDCs: 0,
    lastUpdate: null
  });

  // Fetch ticker data using same endpoints as dashboard
  const fetchTickerData = async () => {
    try {
      // Fetch independently so one failing endpoint doesn't blank the whole ticker
      const [lockedData, actionsData, serversData] = await Promise.all([
        apiGet('/api/ledger/current-locked-users').catch(() => null),
        apiGet('/api/actions/recent/50').catch(() => null),
        apiGet('/api/servers/status').catch(() => null)
      ]);

      let lockedUsers = 0;
      let recentLockout = null;
      let totalUnlocks = 0;
      let offlineServers = 0;
      let offlineDCs = 0;

      // Process locked users (same as dashboard)
      if (Array.isArray(lockedData)) {
        lockedUsers = lockedData.length || 0;
        if (lockedData.length > 0) {
          // Sort by lockout time to get most recent
          const sortedByLockout = [...lockedData].sort((a, b) =>
            new Date(b.AccountLockoutTime) - new Date(a.AccountLockoutTime)
          );
          recentLockout = sortedByLockout[0];
        }
      }

      // Process recent actions for unlock count (today only)
      if (Array.isArray(actionsData)) {
        const today = new Date().toDateString();
        totalUnlocks = actionsData.filter(action =>
          action.action_type === 'unlock' &&
          new Date(action.timestamp).toDateString() === today
        ).length;
      }

      // Process servers (same as dashboard)
      if (serversData) {
        // Ensure servers is an array (following dashboard pattern)
        const servers = Array.isArray(serversData) ? serversData : [serversData];

        offlineServers = servers.filter(server =>
          server.Status === 'Offline' && !server.ServerName?.toLowerCase().includes('dc')
        ).length;
        offlineDCs = servers.filter(server =>
          server.Status === 'Offline' && server.ServerName?.toLowerCase().includes('dc')
        ).length;
      }

      setTickerData({
        lockedUsers,
        recentLockout,
        totalUnlocks,
        offlineServers,
        offlineDCs,
        lastUpdate: new Date()
      });

    } catch (error) {
      console.error('Error fetching ticker data:', error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchTickerData();

    // Set up interval for updates every 30 seconds
    const interval = setInterval(fetchTickerData, 30000);

    return () => clearInterval(interval);
  }, []);

  // Generate ticker items
  const generateTickerItems = () => {
    const items = [];

    // Locked users count
    items.push({
      icon: '🔒',
      text: `${tickerData.lockedUsers} users currently locked out`,
      type: tickerData.lockedUsers > 0 ? 'warning' : 'success'
    });

    // Recent lockout
    if (tickerData.recentLockout) {
      const lockoutTime = new Date(tickerData.recentLockout.AccountLockoutTime);
      const timeAgo = Math.floor((Date.now() - lockoutTime.getTime()) / 60000);
      items.push({
        icon: '⏰',
        text: `Most recent lockout: ${tickerData.recentLockout.UserID} (${timeAgo}m ago)`,
        type: 'info'
      });
    }

    // Unlocks today
    items.push({
      icon: '🔓',
      text: `${tickerData.totalUnlocks} unlocks performed today`,
      type: 'info'
    });

    // Offline servers
    if (tickerData.offlineServers > 0) {
      items.push({
        icon: '🖥️',
        text: `${tickerData.offlineServers} servers offline`,
        type: 'error'
      });
    }

    // Offline domain controllers
    if (tickerData.offlineDCs > 0) {
      items.push({
        icon: '🏢',
        text: `${tickerData.offlineDCs} domain controllers offline`,
        type: 'critical'
      });
    }

    // System status
    if (tickerData.lockedUsers === 0 && tickerData.offlineServers === 0 && tickerData.offlineDCs === 0) {
      items.push({
        icon: '✅',
        text: 'All systems operational',
        type: 'success'
      });
    }

    // Last update
    if (tickerData.lastUpdate) {
      items.push({
        icon: '🔄',
        text: `Last updated: ${tickerData.lastUpdate.toLocaleTimeString()}`,
        type: 'neutral'
      });
    }

    return items;
  };

  const tickerItems = generateTickerItems();

  return (
    <div className={`ticker-tape-container ${className}`}>
      <div className="ticker-tape">
        <div className="ticker-content">
          {tickerItems.map((item, index) => (
            <span key={index} className={`ticker-item ${item.type}`}>
              <span className="ticker-icon">{item.icon}</span>
              <span className="ticker-text">{item.text}</span>
              <span className="ticker-separator">•</span>
            </span>
          ))}
          {/* Duplicate for seamless scrolling */}
          {tickerItems.map((item, index) => (
            <span key={`dup-${index}`} className={`ticker-item ${item.type}`}>
              <span className="ticker-icon">{item.icon}</span>
              <span className="ticker-text">{item.text}</span>
              <span className="ticker-separator">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TickerTape;