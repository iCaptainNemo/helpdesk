import React, { memo } from 'react';

const MetricsCard = memo(({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', // 'positive', 'negative', 'neutral'
  icon, 
  color = 'default',
  loading = false,
  onClick,
  className = ''
}) => {
  const formatValue = (val) => {
    if (loading) return '---';
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString();
    }
    return val;
  };

  const formatChange = (changeVal) => {
    if (!changeVal && changeVal !== 0) return null;
    
    const sign = changeVal > 0 ? '+' : '';
    const percentage = Math.abs(changeVal);
    
    return (
      <div className={`metrics-change ${changeType}`}>
        {changeType === 'positive' && <span>↗</span>}
        {changeType === 'negative' && <span>↘</span>}
        {changeType === 'neutral' && <span>→</span>}
        <span>{sign}{percentage}%</span>
      </div>
    );
  };

  const getColorClass = () => {
    switch (color) {
      case 'success': return 'status-success';
      case 'warning': return 'status-warning';
      case 'error': return 'status-error';
      case 'info': return 'status-info';
      default: return '';
    }
  };

  const cardClasses = [
    'dashboard-card',
    'metrics-card',
    'transition',
    'hover-lift',
    className
  ].filter(Boolean).join(' ');

  const valueClasses = [
    'metrics-value',
    getColorClass(),
    loading ? 'animate-pulse' : ''
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={cardClasses}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {icon && (
        <div className="card-icon text-2xl mb-sm" style={{ opacity: 0.7 }}>
          {icon}
        </div>
      )}
      
      <div className="metrics-label">
        {title}
      </div>
      
      {loading ? (
        <div className="loading-skeleton skeleton-text wide mx-auto" style={{ height: '3rem', width: '80%' }}></div>
      ) : (
        <div className={valueClasses}>
          {formatValue(value)}
        </div>
      )}
      
      {change !== undefined && !loading && formatChange(change)}
    </div>
  );
});

// Status-specific metric cards
export const StatusMetricsCard = memo(({ 
  title, 
  value, 
  status = 'normal', // 'normal', 'warning', 'critical'
  threshold,
  icon,
  loading = false,
  onClick,
  className = ''
}) => {
  const getStatusInfo = () => {
    if (loading) return { color: 'default', changeType: 'neutral' };
    
    const numValue = typeof value === 'number' ? value : parseInt(value) || 0;
    
    if (status === 'critical' || (threshold && numValue >= threshold.critical)) {
      return { color: 'error', changeType: 'negative' };
    } else if (status === 'warning' || (threshold && numValue >= threshold.warning)) {
      return { color: 'warning', changeType: 'negative' };
    } else {
      return { color: 'success', changeType: 'positive' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <MetricsCard
      title={title}
      value={value}
      icon={icon}
      color={statusInfo.color}
      changeType={statusInfo.changeType}
      loading={loading}
      onClick={onClick}
      className={className}
    />
  );
});

// Time-based metric card (for response times, durations, etc.)
export const TimeMetricsCard = memo(({ 
  title, 
  seconds, 
  target,
  icon,
  loading = false,
  onClick,
  className = ''
}) => {
  const formatTime = (secs) => {
    if (loading) return '---';
    if (!secs && secs !== 0) return 'N/A';
    
    if (secs < 60) {
      return `${secs.toFixed(1)}s`;
    } else if (secs < 3600) {
      const minutes = Math.floor(secs / 60);
      const remainingSeconds = secs % 60;
      return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    } else {
      const hours = Math.floor(secs / 3600);
      const minutes = Math.floor((secs % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const getPerformanceStatus = () => {
    if (loading || !target) return { changeType: 'neutral', color: 'default' };
    
    if (seconds <= target.excellent) {
      return { changeType: 'positive', color: 'success' };
    } else if (seconds <= target.good) {
      return { changeType: 'neutral', color: 'info' };
    } else {
      return { changeType: 'negative', color: 'warning' };
    }
  };

  const performance = getPerformanceStatus();

  return (
    <MetricsCard
      title={title}
      value={formatTime(seconds)}
      icon={icon}
      color={performance.color}
      changeType={performance.changeType}
      loading={loading}
      onClick={onClick}
      className={className}
    />
  );
});

// Percentage-based metric card
export const PercentageMetricsCard = memo(({ 
  title, 
  percentage, 
  target,
  icon,
  loading = false,
  onClick,
  className = ''
}) => {
  const formatPercentage = (pct) => {
    if (loading) return '---';
    if (!pct && pct !== 0) return 'N/A';
    return `${pct.toFixed(1)}%`;
  };

  const getPerformanceStatus = () => {
    if (loading || !target) return { changeType: 'neutral', color: 'default' };
    
    if (percentage >= target.excellent) {
      return { changeType: 'positive', color: 'success' };
    } else if (percentage >= target.good) {
      return { changeType: 'neutral', color: 'info' };
    } else {
      return { changeType: 'negative', color: 'warning' };
    }
  };

  const performance = getPerformanceStatus();

  return (
    <MetricsCard
      title={title}
      value={formatPercentage(percentage)}
      icon={icon}
      color={performance.color}
      changeType={performance.changeType}
      loading={loading}
      onClick={onClick}
      className={className}
    />
  );
});

export default MetricsCard;