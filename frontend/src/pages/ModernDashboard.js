import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import MetricsCard, { StatusMetricsCard } from '../components/MetricsCard';
import Notification from '../components/Notification';
import { executePowerShellScript, apiGet, apiPut, apiRequestRaw, invalidateCache } from '../utils/api';
import { ActionLogger } from '../utils/actionLogger';

// Lazy load chart components to reduce initial bundle size
const LockedUsersTimeChart = React.lazy(() => import('../components/charts/LockedUsersTimeChart'));
const LockedUsersPieChart = React.lazy(() => import('../components/charts/LockedUsersPieChart'));

const ModernDashboard = ({ 
  permissions = [], 
  adminID = '',
  adminComputer = ''
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showAllServers, setShowAllServers] = useState(false);
  const [showAllLockedUsers, setShowAllLockedUsers] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [departmentFilter, setDepartmentFilter] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    lockedUsers: [],
    metrics: {
      lockedUsersCount: 0,
      offlineServers: 0,
      todayUnlocks: 0,
      offlineDomainControllers: 0
    },
    systemStatus: [],
    domainControllers: [],
    recentActivity: []
  });

  // Fetch dashboard data
  const fetchDashboardData = async (showFullLoading = false) => {
    let hasCachedData = false;

    try {
      // Only show loading if it's the first load or explicitly requested
      if (showFullLoading || initialLoad) {
        setLoading(true);
      }

      // Fetch every endpoint concurrently rather than sequentially. Each request
      // falls back to null on failure (via .catch) so one slow/failing endpoint
      // doesn't block or blank the rest of the dashboard.
      const [lockedUsersRes, deptData, serversData, dcData, unlockActions, actionsData] = await Promise.all([
        apiRequestRaw('/api/ledger/current-locked-users').catch(() => null),
        apiGet('/api/ledger/locked-users-by-department').catch(() => null),
        apiGet('/api/servers/status').catch(() => null),
        apiGet('/api/domain-controllers').catch(() => null),
        apiGet(`/api/actions/by-admin/${encodeURIComponent(adminID)}/100`).catch(() => null),
        apiGet('/api/actions/recent/10').catch(() => null),
      ]);

      // Locked users (raw response so we can read the X-Cache header)
      let lockedUsers = [];
      if (lockedUsersRes) {
        if (lockedUsersRes.headers.get('X-Cache') === 'HIT') {
          hasCachedData = true;
        }
        const lockedUsersData = await lockedUsersRes.json().catch(() => []);
        lockedUsers = Array.isArray(lockedUsersData) ? lockedUsersData : [];
      }

      // Department totals (used for metric consistency)
      const totalLockedFromDepartments = Array.isArray(deptData)
        ? deptData.reduce((total, dept) => total + dept.locked_count, 0)
        : 0;

      // Servers (ensure array, following ServerStatus component pattern)
      const servers = Array.isArray(serversData) ? serversData : (serversData ? [serversData] : []);

      // Domain controllers
      const domainControllers = (dcData && dcData.domainControllers) || [];

      // Calculate metrics from real data
      const offlineServers = servers.filter(server => server.Status === 'Offline').length;
      const offlineDomainControllers = domainControllers.filter(dc => dc.Status === 'Offline').length;

      // Count this admin's successful unlocks today
      let todayUnlocks = 0;
      if (Array.isArray(unlockActions)) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        todayUnlocks = unlockActions.filter(action =>
          action.action_type === 'unlock' &&
          action.result === 'success' &&
          action.timestamp.startsWith(today)
        ).length;
      }

      const metrics = {
        lockedUsersCount: totalLockedFromDepartments > 0 ? totalLockedFromDepartments : lockedUsers.length || 0,
        offlineServers: offlineServers,
        todayUnlocks: todayUnlocks,
        offlineDomainControllers: offlineDomainControllers
      };

      // Transform server data for system status display
      const systemStatus = servers.map(server => ({
        name: server.ServerName,
        status: server.Status ? server.Status.toLowerCase() : 'unknown',
        type: server.Description || 'Server',
        fileShareService: server.FileShareService || 'Unknown',
        printSpoolerService: server.PrintSpoolerService || 'Unknown',
        onlineTime: server.OnlineTime,
        offlineTime: server.OfflineTime,
        location: server.Location
      }));

      // Recent actions (already fetched above via Promise.all)
      const recentActivity = Array.isArray(actionsData)
        ? actionsData.map(action => ({
            id: action.ID,
            time: new Date(action.timestamp + (action.timestamp.includes('Z') ? '' : 'Z')), // Ensure UTC parsing
            title: getActionTitle(action.action_type),
            description: action.activity,
            type: action.action_type || 'general',
            adminID: action.adminID,
            target: action.target,
            result: action.result
          }))
        : [];

      setDashboardData({
        lockedUsers: lockedUsers || [],
        metrics: metrics,
        systemStatus: systemStatus,
        domainControllers: domainControllers,
        recentActivity: recentActivity
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set fallback data
      setDashboardData({
        lockedUsers: [],
        metrics: {
          lockedUsersCount: 0,
          offlineServers: 0,
          todayUnlocks: 0,
          offlineDomainControllers: 0
        },
        systemStatus: [],
        domainControllers: [],
        recentActivity: []
      });
    } finally {
      // If data came from cache, don't show loading skeleton
      if (hasCachedData && !initialLoad) {
        setLoading(false);
      } else {
        // For fresh data or initial load, show loading briefly to prevent flashing
        setTimeout(() => {
          setLoading(false);
        }, initialLoad ? 0 : 150);
      }

      if (initialLoad) {
        setInitialLoad(false);
      }
      setLastUpdated(new Date());
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData(true);
    setRefreshing(false);
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 4000);
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    fetchDashboardData(true); // Show full loading on initial mount

    // Set up real-time updates (matching original component intervals)
    const interval = setInterval(() => fetchDashboardData(false), 60000); // 60 seconds, no loading skeleton

    return () => clearInterval(interval);
  }, []);

  const getActionTitle = (actionType) => {
    switch (actionType) {
      case 'unlock': return 'User Unlocked';
      case 'reset_password': return 'Password Reset';
      case 'system_check': return 'System Check';
      case 'bulk_unlock': return 'Bulk Unlock';
      case 'ad_lookup': return 'AD Lookup';
      case 'report_generated': return 'Report Generated';
      default: return 'Action Performed';
    }
  };

  const getActionVerb = (actionType) => {
    switch (actionType) {
      case 'unlock': return 'unlocked';
      case 'password_reset': return 'reset password for';
      default: return 'acted on';
    }
  };

  const calculateUpDowntime = (onlineTime, offlineTime) => {
    const currentTime = new Date();
    let diffTime;

    if (onlineTime) {
      diffTime = Math.abs(currentTime - new Date(onlineTime));
    } else if (offlineTime) {
      diffTime = Math.abs(currentTime - new Date(offlineTime));
    } else {
      return 'N/A';
    }

    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const days = Math.floor(diffMinutes / 1440); // 1440 minutes in a day
    const hours = Math.floor((diffMinutes % 1440) / 60);
    const remainingMinutes = diffMinutes % 60;

    let formattedTime = '';
    if (days > 0) {
      formattedTime += `${days} days `;
    }
    if (hours > 0) {
      formattedTime += `${hours} hours `;
    }
    formattedTime += `${remainingMinutes} minutes`;

    return formattedTime;
  };

  const handleDepartmentClick = (department) => {
    // Toggle a filter on the locked-users table and scroll to it (no separate page exists)
    setDepartmentFilter(prev => (prev === department ? null : department));
    setShowAllLockedUsers(true);
    scrollToSection('dash-locked-users');
  };

  const handleUnlockUser = async (userID) => {
    try {
      // Execute PowerShell unlock script
      const result = await executePowerShellScript('Unlocker', { userID: userID });
      
      if (result.message.includes('Unlocked')) {
        // Remove user from locked users list and increment today's unlock count
        setDashboardData(prevData => ({
          ...prevData,
          lockedUsers: prevData.lockedUsers.filter(user => user.UserID !== userID),
          metrics: {
            ...prevData.metrics,
            lockedUsersCount: prevData.lockedUsers.filter(user => user.UserID !== userID).length,
            todayUnlocks: prevData.metrics.todayUnlocks + 1
          }
        }));

        // Update user stats in database
        const updates = {
          LastHelped: new Date().toISOString(),
          TimesHelped: 1,
          TimesUnlocked: 1
        };

        try {
          // Update user stats using the correct endpoint
          await apiPut('/api/fetch-user/update', { adObjectID: userID, updates });
          // Drop cached fetch-user so the AD properties view reflects the unlock
          invalidateCache('/api/fetch-user');
        } catch (dbError) {
          console.warn('Error updating user stats in database:', dbError);
        }

        // Log the successful unlock action
        await ActionLogger.logUnlock(adminID, userID, true);

        showNotification(`Unlocked ${userID}`, 'success');
        console.log(`Successfully unlocked user: ${userID}`);
      } else {
        throw new Error(result.message || 'Unlock failed');
      }
    } catch (error) {
      console.error('Error unlocking user:', error);

      // Log the failed unlock action
      await ActionLogger.logUnlock(adminID, userID, false);

      showNotification(`Failed to unlock ${userID}: ${error.message}`, 'error');
    }
  };



  return (
    <div className={`dashboard-content ${!initialLoad ? 'dashboard-loaded' : ''}`} style={{ background: 'var(--bg-primary)', minHeight: '100%' }}>
      <Notification
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ message: '', type: '' })}
      />

      {/* Dashboard header: last-updated indicator + manual refresh */}
      <div className="flex items-center justify-between px-md py-sm" style={{ gap: 'var(--spacing-md)' }}>
        <span className="text-xs text-muted">
          {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}
        </span>
        <button
          className="px-sm py-xs bg-primary-gradient text-white rounded-sm text-xs hover-lift transition"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh dashboard data"
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* Dashboard Grid */}
      <main className="dashboard-grid dashboard-main">
          {/* Metrics Cards Row */}
          <StatusMetricsCard
            className="grid-metrics-1"
            title="Locked Users"
            value={dashboardData.metrics.lockedUsersCount}
            status={dashboardData.metrics.lockedUsersCount > 5 ? 'critical' : dashboardData.metrics.lockedUsersCount > 2 ? 'warning' : 'normal'}
            icon="🔒"
            loading={loading}
            onClick={() => scrollToSection('dash-locked-users')}
          />

          <MetricsCard
            className="grid-metrics-2"
            title="Unlocks Today"
            value={dashboardData.metrics.todayUnlocks}
            icon="✅"
            color="success"
            loading={loading}
          />

          <StatusMetricsCard
            className="grid-metrics-3"
            title="Offline Servers"
            value={dashboardData.metrics.offlineServers}
            status={dashboardData.metrics.offlineServers > 0 ? 'warning' : 'normal'}
            icon="⚠️"
            loading={loading}
            onClick={() => scrollToSection('dash-server-health')}
          />

          <StatusMetricsCard
            className="grid-metrics-4"
            title="Domain Controllers"
            value={dashboardData.metrics.offlineDomainControllers}
            status={dashboardData.metrics.offlineDomainControllers > 0 ? 'critical' : 'normal'}
            icon="🏢"
            loading={loading}
            onClick={() => scrollToSection('dash-domain-controllers')}
          />

          {/* Charts Row */}
          <Suspense fallback={<div className="grid-chart-timeline dashboard-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Timeline Chart...</div>}>
            <LockedUsersTimeChart
              className="grid-chart-timeline"
              data={dashboardData.lockedUsers}
            />
          </Suspense>

          <Suspense fallback={<div className="grid-chart-pie dashboard-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Pie Chart...</div>}>
            <LockedUsersPieChart
              className="grid-chart-pie"
              data={dashboardData.lockedUsers}
              onDepartmentClick={handleDepartmentClick}
            />
          </Suspense>

          {/* Active Issues & Quick Actions Row */}
          <div id="dash-locked-users" className="dashboard-card grid-active-issues">
            <div className="card-header">
              <div>
                <h3 className="card-title">Currently Locked Users</h3>
                {departmentFilter && (
                  <button
                    className="text-xs text-accent-blue"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => setDepartmentFilter(null)}
                    title="Clear department filter"
                  >
                    Filtered by {departmentFilter} ✕
                  </button>
                )}
              </div>
              <div className="card-actions">
                <button
                  className="px-sm py-xs bg-primary-gradient text-white rounded-sm text-xs hover-lift transition"
                  onClick={() => setShowAllLockedUsers(!showAllLockedUsers)}
                >
                  {showAllLockedUsers ? 'Show Less' : 'View All'}
                </button>
              </div>
            </div>

            <div className="card-content">
              {loading ? (
                <div className="space-y-md">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="loading-skeleton skeleton-text wide" style={{ height: '60px' }}></div>
                  ))}
                </div>
              ) : dashboardData.lockedUsers.length > 0 ? (
                <div className="table-responsive">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>UserID</th>
                        <th>Name</th>
                        <th>Department</th>
                        <th>Locked Time</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Sort by most recent lockout time first
                        const sortedUsers = [...dashboardData.lockedUsers].sort((a, b) =>
                          new Date(b.AccountLockoutTime) - new Date(a.AccountLockoutTime)
                        );
                        // Apply department filter (set by clicking a pie-chart slice)
                        const filteredUsers = departmentFilter
                          ? sortedUsers.filter(u => (u.department || 'Unknown Dept') === departmentFilter)
                          : sortedUsers;
                        const displayUsers = showAllLockedUsers ? filteredUsers : filteredUsers.slice(0, 6);
                        return displayUsers.map(user => {
                          // Check if lockout occurred within last 5 minutes
                          const lockoutTime = new Date(user.AccountLockoutTime);
                          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                          const isRecentLockout = lockoutTime > fiveMinutesAgo;

                          return (
                        <tr
                          key={user.UserID}
                          className={isRecentLockout ? 'recent-lockout' : ''}
                          style={isRecentLockout ? {
                            backgroundColor: '#ffeb3b',
                            color: '#000000',
                            fontWeight: '500'
                          } : {}}
                        >
                          <td>
                            <span
                              className="text-sm"
                              style={{ color: isRecentLockout ? '#000000' : 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => navigate(`/ad-object/${user.UserID}`)}
                              title={`Open AD object for ${user.UserID}`}
                            >
                              {user.UserID}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm" style={isRecentLockout ? {color: '#000000'} : {color: 'var(--text-primary)'}}>
                              {user.name || 'N/A'}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm" style={isRecentLockout ? {color: '#000000'} : {color: 'var(--text-secondary)'}}>
                              {user.department || 'Unknown Dept'}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm" style={isRecentLockout ? {color: '#000000'} : {color: 'var(--text-muted)'}}>
                              {new Date(user.AccountLockoutTime).toLocaleString()}
                            </span>
                          </td>
                          <td>
                            <button
                              className="px-sm py-xs bg-accent-blue text-white rounded-sm text-xs hover-lift transition"
                              onClick={() => handleUnlockUser(user.UserID)}
                            >
                              Unlock
                            </button>
                          </td>
                        </tr>
                        );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🎉</div>
                  <div className="empty-state-title">No Locked Users</div>
                  <div className="empty-state-description">
                    Great! All users are currently able to access their accounts.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div id="dash-domain-controllers" className="dashboard-card grid-domain-controllers">
            <div className="card-header">
              <div>
                <h3 className="card-title">Domain Controllers</h3>
                <p className="card-subtitle">Active Directory infrastructure status</p>
              </div>
            </div>
            
            <div className="card-content">
              {loading ? (
                <div className="space-y-md">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="loading-skeleton skeleton-text wide" style={{ height: '40px' }}></div>
                  ))}
                </div>
              ) : dashboardData.domainControllers.length > 0 ? (
                <div className="table-responsive">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Controller Name</th>
                        <th>Role</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.domainControllers.map((controller, index) => (
                        <tr key={index}>
                          <td>
                            <span className="font-medium text-primary">
                              {controller.ControllerName}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm text-secondary">
                              {controller.Role}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-sm">
                              <div className={`status-indicator ${controller.Status === 'Online' ? 'online' : 'offline'}`}></div>
                              <span className={`text-sm ${controller.Status === 'Online' ? 'text-status-success' : 'text-status-error'}`}>
                                {controller.Status}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🏢</div>
                  <div className="empty-state-title">No Domain Controllers</div>
                  <div className="empty-state-description">
                    Domain controller information will appear here when available.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* System Status & Recent Activity Row */}
          <div id="dash-server-health" className="dashboard-card grid-system-status">
            <div className="card-header">
              <div>
                <h3 className="card-title">Server Health Status</h3>
                <p className="card-subtitle">Server and service status</p>
              </div>
              <div className="card-actions">
                <button 
                  className="px-sm py-xs bg-primary-gradient text-white rounded-sm text-xs hover-lift transition"
                  onClick={() => setShowAllServers(!showAllServers)}
                >
                  {showAllServers ? 'Show Less' : 'View All'}
                </button>
              </div>
            </div>
            
            <div className="card-content">
              {loading ? (
                <div className="space-y-md">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="loading-skeleton skeleton-text wide" style={{ height: '40px' }}></div>
                  ))}
                </div>
              ) : dashboardData.systemStatus.length > 0 ? (
                <div className="table-responsive">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Server Name</th>
                        <th>Status</th>
                        <th>File Share</th>
                        <th>Print Spooler</th>
                        <th>Up/Downtime</th>
                        <th>Online Time</th>
                        <th>Offline Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Filter servers based on toggle - show only servers with issues when collapsed
                        const filteredServers = showAllServers
                          ? dashboardData.systemStatus
                          : dashboardData.systemStatus.filter(server =>
                              server.status !== 'online' ||
                              server.fileShareService !== 'Running' ||
                              server.printSpoolerService !== 'Running'
                            );

                        // Show "All servers online" message when no issues and collapsed
                        const allServersHealthy = dashboardData.systemStatus.every(server =>
                          server.status === 'online' &&
                          server.fileShareService === 'Running' &&
                          server.printSpoolerService === 'Running'
                        );
                        
                        if (!showAllServers && allServersHealthy) {
                          return (
                            <tr className="all-servers-online">
                              <td colSpan="7" className="text-center text-status-success">
                                All Servers Are Online and All Services Running
                              </td>
                            </tr>
                          );
                        }
                        
                        return filteredServers.map(server => (
                        <tr key={server.name} title={`Location: ${server.location || 'N/A'}\nType: ${server.type || 'N/A'}`}>
                          <td>
                            <span className="font-medium text-primary">
                              {server.name}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-sm">
                              <div className={`status-indicator ${server.status}`}></div>
                              <span className={`text-sm capitalize ${server.status === 'online' ? 'text-status-success' : 'text-status-error'}`}>
                                {server.status}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`text-sm ${
                              server.fileShareService === 'Running'
                                ? 'text-status-success'
                                : server.status === 'online'
                                  ? 'text-status-warning'
                                  : 'text-status-error'
                            }`}>
                              {server.fileShareService}
                            </span>
                          </td>
                          <td>
                            <span className={`text-sm ${
                              server.printSpoolerService === 'Running'
                                ? 'text-status-success'
                                : server.status === 'online'
                                  ? 'text-status-warning'
                                  : 'text-status-error'
                            }`}>
                              {server.printSpoolerService}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm text-muted">
                              {calculateUpDowntime(server.onlineTime, server.offlineTime)}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm text-muted">
                              {server.onlineTime ? new Date(server.onlineTime).toLocaleString() : 'N/A'}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm text-muted">
                              {server.offlineTime ? new Date(server.offlineTime).toLocaleString() : 'N/A'}
                            </span>
                          </td>
                        </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🏥</div>
                  <div className="empty-state-title">No Server Data</div>
                  <div className="empty-state-description">
                    Server status information will appear here once available.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-card grid-recent-activity">
            <div className="card-header">
              <div>
                <h3 className="card-title">Recent Activity</h3>
                <p className="card-subtitle">Latest help desk actions</p>
              </div>
            </div>
            
            <div className="card-content">
              {loading ? (
                <div className="activity-feed">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="activity-item">
                      <div className="loading-skeleton skeleton-text narrow" style={{ height: '1em' }}></div>
                      <div className="loading-skeleton skeleton-text wide" style={{ height: '1em' }}></div>
                    </div>
                  ))}
                </div>
              ) : dashboardData.recentActivity.length > 0 ? (
                <div className="activity-feed">
                  {dashboardData.recentActivity.map(activity => (
                    <div key={activity.id} className="activity-item">
                      <div className="activity-content">
                        <div className="activity-summary">
                          {activity.time.toLocaleTimeString()} {activity.adminID} {getActionVerb(activity.type)} {activity.target || 'unknown'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📝</div>
                  <div className="empty-state-title">No Recent Activity</div>
                  <div className="empty-state-description">
                    Recent help desk actions will appear here as they occur.
                  </div>
                </div>
              )}
            </div>
          </div>

        </main>
    </div>
  );
};

export default ModernDashboard;