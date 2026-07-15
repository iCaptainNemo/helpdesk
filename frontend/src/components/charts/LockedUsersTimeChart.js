import React, { useEffect, useState } from 'react';
import { apiGet } from '../../utils/api'; // shared API client
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LockedUsersTimeChart = ({ 
  data = [], 
  refreshInterval = 300000, // 5 minutes
  className = '' 
}) => {
  const [chartData, setChartData] = useState(null);
  const [selectedHours, setSelectedHours] = useState(3);

  // Generate time labels based on selected hours (current time on the right)
  const generateTimeLabels = (hours = selectedHours) => {
    const labels = [];
    const now = new Date();
    
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - (i * 60 * 60 * 1000)); // i hours ago
      labels.push(time.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }));
    }
    
    return labels;
  };

  // Fetch data from ledger API
  const fetchChartData = async () => {
    try {
      const apiData = await apiGet(`/api/ledger/locked-users-timeline/${selectedHours}`);
      
      // API returns data in the format we need for Chart.js
      return apiData;
    } catch (error) {
      console.error('Error fetching timeline data:', error);
      
      // Fallback to empty state
      const labels = generateTimeLabels();
      return {
        labels,
        datasets: [{
          label: 'No Data Available',
          data: new Array(selectedHours).fill(0),
          borderColor: '#7a8694',
          backgroundColor: '#7a869420',
          borderWidth: 1,
          fill: true,
          tension: 0.4
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
  }, [selectedHours, data]); // Refetch when hours selection changes OR data prop changes
  
  // Legacy support for prop data (fallback)
  useEffect(() => {
    if (data && data.length > 0 && (!chartData || chartData.datasets.length === 0)) {
      // If API fails, fall back to processing prop data
      const labels = generateTimeLabels();
      setChartData({
        labels,
        datasets: [{
          label: 'Fallback Data',
          data: new Array(selectedHours).fill(data.length || 0),
          borderColor: '#7a8694',
          backgroundColor: '#7a869420',
          borderWidth: 1,
          fill: true
        }]
      });
    }
  }, [data, selectedHours]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    devicePixelRatio: window.devicePixelRatio || 1,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#b8c5d1',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 12,
            family: 'Inter, sans-serif'
          }
        }
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'point',
        intersect: false,
        position: 'nearest',
        backgroundColor: '#242b3d',
        titleColor: '#ffffff',
        bodyColor: '#b8c5d1',
        borderColor: '#364153',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        xAlign: 'right',
        yAlign: 'top',
        caretPadding: 20,
        caretSize: 8,
        callbacks: {
          title: (context) => {
            return `Time: ${context[0].label}`;
          },
          label: (context) => {
            const value = context.parsed.y;
            const plural = value === 1 ? 'user' : 'users';
            return `${context.dataset.label}: ${value} locked ${plural}`;
          }
        }
      }
    },
    interaction: {
      mode: 'point',
      intersect: false
    },
    hover: {
      mode: 'point',
      intersect: false,
      animationDuration: 0
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time (12-hour period)',
          color: '#7a8694',
          font: {
            size: 12,
            family: 'Inter, sans-serif'
          }
        },
        grid: {
          color: '#364153',
          drawBorder: false
        },
        ticks: {
          color: '#7a8694',
          font: {
            size: 11,
            family: 'Inter, sans-serif'
          },
          maxRotation: 45
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Locked Users',
          color: '#7a8694',
          font: {
            size: 12,
            family: 'Inter, sans-serif'
          }
        },
        grid: {
          color: '#364153',
          drawBorder: false
        },
        ticks: {
          color: '#7a8694',
          font: {
            size: 11,
            family: 'Inter, sans-serif'
          },
          beginAtZero: true,
          precision: 0
        },
        suggestedMin: 0,
        suggestedMax: 10
      }
    },
    elements: {
      point: {
        hoverBackgroundColor: '#ffffff',
        hoverRadius: 8,
        hoverBorderWidth: 2
      }
    }
  };

  const cardClasses = [
    'dashboard-card',
    'chart-card',
    'grid-chart-timeline',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses}>
      <div className="card-header">
        <div>
          <h3 className="card-title">Locked Users Over Time</h3>
          <p className="card-subtitle">Last {selectedHours} hours by department</p>
        </div>
        <div className="card-actions">
          <select 
            value={selectedHours} 
            onChange={(e) => setSelectedHours(parseInt(e.target.value))}
            className="px-sm py-xs bg-bg-card border border-border-primary rounded-sm text-sm mr-sm"
            style={{ 
              color: '#000000',
              backgroundColor: '#ffffff'
            }}
          >
            <option value={1} style={{ color: '#000000', backgroundColor: '#ffffff' }}>1 hour</option>
            <option value={3} style={{ color: '#000000', backgroundColor: '#ffffff' }}>3 hours</option>
            <option value={6} style={{ color: '#000000', backgroundColor: '#ffffff' }}>6 hours</option>
            <option value={9} style={{ color: '#000000', backgroundColor: '#ffffff' }}>9 hours</option>
            <option value={12} style={{ color: '#000000', backgroundColor: '#ffffff' }}>12 hours</option>
          </select>
        </div>
      </div>
      
      <div className="card-content">
        {chartData ? (
          <div className="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No Timeline Data</div>
            <div className="empty-state-description">
              Locked user timeline data will appear here once available
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LockedUsersTimeChart;