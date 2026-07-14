import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import MetricsCard, { StatusMetricsCard } from '../components/MetricsCard';
import { executePowerShellScript } from '../utils/apiUtils';
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

      // Fetch actual data from endpoints (following original component patterns)

      // Fetch locked out users from ledger (optimized) - use same endpoint as pie chart for consistency
      const lockedUsersRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ledger/current-locked-users`);

      // Check if this response came from cache
      if (lockedUsersRes.headers.get('X-Cache') === 'HIT') {
        hasCachedData = true;
      }

      const lockedUsersData = await lockedUsersRes.json();
      // Ensure locked users is an array (following LockedOutUsers component pattern)
      const lockedUsers = Array.isArray(lockedUsersData) ? lockedUsersData : [];
      
      // Also fetch department data to get total count for metrics consistency
      let totalLockedFromDepartments = 0;
      try {
        const deptRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ledger/locked-users-by-department`);
        if (deptRes.ok) {
          const deptData = await deptRes.json();
          totalLockedFromDepartments = deptData.reduce((total, dept) => total + dept.locked_count, 0);
        }
      } catch (error) {
        console.error('Error fetching department totals:', error);
      }
      
      // Fetch server status (using same endpoint as ServerStatus component)
      let servers = [];
      try {
        const serversRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/servers/status`);
        if (serversRes.ok) {
          servers = await serversRes.json();
          // Ensure servers is an array (following ServerStatus component pattern)
          servers = Array.isArray(servers) ? servers : [servers];
        }
      } catch (error) {
        console.error('Error fetching servers:', error);
        servers = [];
      }

      // Fetch domain controllers (using same endpoint as DomainControllers component)
      let domainControllers = [];
      try {
        const dcRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/domain-controllers`);
        if (dcRes.ok) {
          const dcData = await dcRes.json();
          domainControllers = dcData.domainControllers || [];
        }
      } catch (error) {
        console.error('Error fetching domain controllers:', error);
        domainControllers = [];
      }

      // Calculate metrics from real data
      const offlineServers = servers.filter(server => server.Status === 'Offline').length;
      const offlineDomainControllers = domainControllers.filter(dc => dc.Status === 'Offline').length;
      
      // Calculate today's unlocks by current admin from RecentActions
      let todayUnlocks = 0;
      try {
        const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
        const unlockActionsRes = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/actions/by-admin/${encodeURIComponent(adminID)}/100`
        );
        if (unlockActionsRes.ok) {
          const unlockActions = await unlockActionsRes.json();
          // Count successful unlocks by this admin today
          todayUnlocks = unlockActions.filter(action => 
            action.action_type === 'unlock' && 
            action.result === 'success' &&
            action.timestamp.startsWith(today)
          ).length;
        }
      } catch (error) {
        console.error('Error fetching today\'s unlock count:', error);
        todayUnlocks = 0;
      }
      
      // Note: Total actions tracking available for future dashboard metrics

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

      // Fetch recent actions from database
      let recentActivity = [];
      try {
        const actionsRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/actions/recent/10`);
        if (actionsRes.ok) {
          const actionsData = await actionsRes.json();
          console.log('Recent actions response:', actionsData); // Debug log
          recentActivity = actionsData.map(action => ({
            id: action.ID,
            time: new Date(action.timestamp + (action.timestamp.includes('Z') ? '' : 'Z')), // Ensure UTC parsing
            title: getActionTitle(action.action_type),
            description: action.activity,
            type: action.action_type || 'general',
            adminID: action.adminID,
            target: action.target,
            result: action.result
          }));
        } else {
          console.log('Recent actions request failed:', actionsRes.status);
        }
      } catch (error) {
        console.error('Error fetching recent actions:', error);
        // Fallback to empty array
        recentActivity = [];
      }

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
    }
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
    navigate(`/active-issues?department=${encodeURIComponent(department)}`);
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
          const token = localStorage.getItem('token');
          if (token) {
            // Update user stats using the correct endpoint
            await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/fetch-user/update`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                adObjectID: userID,
                updates: updates
              }),
            });
          }
        } catch (dbError) {
          console.warn('Error updating user stats in database:', dbError);
        }

        // Log the successful unlock action
        await ActionLogger.logUnlock(adminID, userID, true);

        console.log(`Successfully unlocked user: ${userID}`);
      } else {
        throw new Error(result.message || 'Unlock failed');
      }
    } catch (error) {
      console.error('Error unlocking user:', error);
      
      // Log the failed unlock action
      await ActionLogger.logUnlock(adminID, userID, false);
      
      alert(`Failed to unlock user ${userID}: ${error.message}`);
    }
  };



  return (
    <div className={`dashboard-content ${!initialLoad ? 'dashboard-loaded' : ''}`} style={{ background: 'var(--bg-primary)', minHeight: '100%' }}>
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
            onClick={() => navigate('/active-issues')}
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
            onClick={() => navigate('/reports/health')}
          />

          <StatusMetricsCard
            className="grid-metrics-4"
            title="Domain Controllers"
            value={dashboardData.metrics.offlineDomainControllers}
            status={dashboardData.metrics.offlineDomainControllers > 0 ? 'critical' : 'normal'}
            icon="🏢"
            loading={loading}
            onClick={() => navigate('/infrastructure/domain-controllers')}
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
          <div className="dashboard-card grid-active-issues">
            <div className="card-header">
              <div>
                <h3 className="card-title">Currently Locked Users</h3>
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
                        const displayUsers = showAllLockedUsers ? sortedUsers : sortedUsers.slice(0, 6);
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
                            <span className="text-sm" style={isRecentLockout ? {color: '#000000'} : {color: 'var(--text-primary)'}}>
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

          <div className="dashboard-card grid-domain-controllers">
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
          <div className="dashboard-card grid-system-status">
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
              <div className="card-actions">
                <button 
                  className="px-sm py-xs bg-accent-blue text-white rounded-sm text-xs hover-lift transition"
                  onClick={() => navigate('/reports/activity')}
                >
                  View All
                </button>
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