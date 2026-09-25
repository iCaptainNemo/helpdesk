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
    // devicePixelRatio intentionally left unset - Chart.js computes this itself by
    // default; forcing it was redundant even now that the CSS zoom hack is gone.
    plugins: {
      legend: {
        // Replaced by a custom HTML legend below the chart (colored boxes with the
        // department name rendered in white inside each box) - Chart.js's built-in
        // legend only supports a swatch next to separately-colored text, it can't
        // render the label inside the colored shape itself.
        display: false
      },
      title: {
        display: false
      },
      // Tooltip removed - the data is already directly readable from the plotted
      // lines and the custom legend below the chart, and getting hover-accuracy
      // right across ~10 closely-clustered department lines wasn't worth it.
      tooltip: {
        enabled: false
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: false
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
          <>
            <div className="chart-container">
              <Line data={chartData} options={chartOptions} />
            </div>

            {/* Custom legend: colored box per department with the name in white
                inside it, since Chart.js's built-in legend can't render that. */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-sm)',
                marginTop: 'var(--spacing-sm)',
              }}
            >
              {chartData.datasets.map((dataset) => (
                <span
                  key={dataset.label}
                  style={{
                    backgroundColor: dataset.borderColor,
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: 'var(--border-radius-sm)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-medium)',
                  }}
                >
                  {dataset.label}
                </span>
              ))}
            </div>
          </>
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