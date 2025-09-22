import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import '../../styles/theme.css';
import '../../styles/grid.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const LockedUsersPieChart = ({ 
  data = [], 
  onDepartmentClick,
  className = '' 
}) => {
  const [chartData, setChartData] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);

  // Fetch data from ledger API
  const fetchChartData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ledger/locked-users-by-department`);
      if (!response.ok) {
        throw new Error('Failed to fetch department data');
      }
      const departmentData = await response.json();
      
      // Color wheel colors based on the primary blue theme (#667eea) - matching timeline chart
      const colorWheel = [
        '#667eea',  // Primary blue
        '#4bc0c0',  // Complementary teal
        '#ff9f40',  // Triadic orange
        '#ff6384',  // Triadic red-pink
        '#9966ff',  // Split-complementary purple
        '#36a2eb',  // Analogous light blue
        '#10b981',  // Tetradic green
        '#3b82f6',  // Analogous blue
        '#764ba2',  // Split-complementary purple-blue
        '#f59e0b',  // Tetradic yellow
        '#e74c3c',  // Additional red
        '#8e44ad',  // Additional purple
        '#2ecc71',  // Additional green
        '#f39c12',  // Additional orange
        '#7a8694'   // Fallback grey
      ];

      const departments = departmentData.map(item => item.department);
      const counts = departmentData.map(item => item.count);
      const colors = departments.map((dept, index) => colorWheel[index % colorWheel.length]);
      const hoverColors = colors.map(color => `${color}dd`);

      const total = counts.reduce((sum, count) => sum + count, 0);
      setTotalUsers(total);

      return {
        labels: departments,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          hoverBackgroundColor: hoverColors,
          borderColor: '#242b3d',
          borderWidth: 2,
          hoverBorderWidth: 3,
          hoverOffset: 8
        }]
      };
    } catch (error) {
      console.error('Error fetching department data:', error);
      setTotalUsers(0);
      return {
        labels: ['No Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['#7a8694'],
          borderColor: '#242b3d',
          borderWidth: 2
        }]
      };
    }
  };

  useEffect(() => {
    const loadChartData = async () => {
      const chartDataResult = await fetchChartData();
      setChartData(chartDataResult);
    };
    
    loadChartData();
  }, [data]); // React to data prop changes
  
  // Legacy support for prop data (fallback)
  useEffect(() => {
    if (data && data.length > 0 && (!chartData || totalUsers === 0)) {
      // If API fails, fall back to prop data processing
      setTotalUsers(data.length);
      setChartData({
        labels: ['Fallback Data'],
        datasets: [{
          data: [data.length],
          backgroundColor: ['#7a8694'],
          borderColor: '#242b3d',
          borderWidth: 2
        }]
      });
    }
  }, [data, chartData, totalUsers]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#b8c5d1',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15,
          font: {
            size: 12,
            family: 'Inter, sans-serif'
          },
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const percentage = totalUsers > 0 ? ((value / totalUsers) * 100).toFixed(1) : '0';
                return {
                  text: `${label} (${value}) - ${percentage}%`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  fontColor: '#b8c5d1',
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        backgroundColor: '#242b3d',
        titleColor: '#ffffff',
        bodyColor: '#b8c5d1',
        borderColor: '#364153',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (context) => {
            return context[0].label;
          },
          label: (context) => {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            const plural = value === 1 ? 'user' : 'users';
            return `${value} locked ${plural} (${percentage}%)`;
          }
        }
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0 && onDepartmentClick) {
        const index = elements[0].index;
        const department = chartData.labels[index];
        onDepartmentClick(department);
      }
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length > 0 && onDepartmentClick ? 'pointer' : 'default';
    },
    cutout: '50%',
    radius: '80%'
  };

  const cardClasses = [
    'dashboard-card',
    'chart-card',
    'grid-chart-pie',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses}>
      <div className="card-header">
        <div>
          <h3 className="card-title">Locked Users by Department</h3>
          <p className="card-subtitle">Current distribution</p>
        </div>
        <div className="card-actions">
          <div className="text-sm text-secondary">
            Total: <span className="font-semibold text-primary">{totalUsers}</span>
          </div>
        </div>
      </div>
      
      <div className="card-content">
        {chartData && totalUsers > 0 ? (
          <div className="chart-container">
            <Doughnut data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <div className="empty-state-title">No Locked Users</div>
            <div className="empty-state-description">
              {data.length === 0 
                ? "Great! No users are currently locked out."
                : "Department distribution will appear here when users are locked."
              }
            </div>
          </div>
        )}
      </div>
      
      {/* Department Summary */}
      {chartData && totalUsers > 0 && (
        <div className="mt-md pt-md" style={{ borderTop: '1px solid var(--divider)' }}>
          <div className="grid status-grid">
            {chartData.labels.map((department, index) => (
              <div 
                key={department}
                className="status-item"
              >
                <div 
                  className="status-indicator"
                  style={{ 
                    backgroundColor: chartData.datasets[0].backgroundColor[index],
                    boxShadow: `0 0 8px ${chartData.datasets[0].backgroundColor[index]}40`
                  }}
                ></div>
                <div className="text-xs text-center">
                  <div className="font-medium" style={{ color: '#ffffff' }}>{department}</div>
                  <div style={{ color: '#b8c5d1' }}>{chartData.datasets[0].data[index]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LockedUsersPieChart;