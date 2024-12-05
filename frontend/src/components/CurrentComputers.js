import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/CurrentComputers.css';

const CurrentComputersTable = ({ adObjectID }) => {
  const [computers, setComputers] = useState([]);
  const [computerStatuses, setComputerStatuses] = useState({});
  const [tooltip, setTooltip] = useState({ visible: false, message: '' });
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, computer: null });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchComputers = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/get-logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adObjectID }),
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const logsData = await response.json();
        const uniqueComputers = [...new Set(logsData.map(log => log.Computer))];
        setComputers(uniqueComputers.reverse()); // Reverse the order of the computers
      } catch (error) {
        console.error('Error fetching computers:', error);
      }
    };

    fetchComputers();
  }, [adObjectID]);

  useEffect(() => {
    const checkComputerDomainStatus = async (computer) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const command = `Get-ADComputer -Filter {Name -eq '${computer}'} -ErrorAction SilentlyContinue | ConvertTo-Json -Compress`;
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ command }),
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        return data.length > 0;
      } catch (error) {
        console.error(`Error checking domain status for computer ${computer}:`, error);
        return false;
      }
    };

    const fetchLoggedInUsers = async (computer) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');
    
        const command = `../../../Tools/PsLoggedon.exe -l -x \\\\${computer} | ConvertTo-Json -Compress`;
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ command }),
        });
    
        if (!response.ok) throw new Error('Network response was not ok');
    
        const data = await response.json();
        const parsedData = JSON.parse(data);
    
        if (!Array.isArray(parsedData)) {
          throw new Error('Unexpected data format');
        }
    
        const startIndex = parsedData.findIndex(line => line.includes('Users logged on locally:'));
        const usersList = startIndex !== -1
          ? parsedData.slice(startIndex + 1).map(line => line.replace('\\t', '').trim()).filter(line => line)
          : [];
    
        const username = adObjectID.split('\\').pop().toLowerCase().trim(); // Extract and normalize the username from adObjectID
    
        const isLoggedIn = usersList.some(user => user.toLowerCase().includes(username));
        return isLoggedIn;
      } catch (error) {
        console.error(`Error fetching logged in users for computer ${computer}:`, error);
        return false;
      }
    };

    const checkComputerStatuses = async () => {
      const statuses = await Promise.all(computers.map(async (computer) => {
        const isOnDomain = await checkComputerDomainStatus(computer);

        if (!isOnDomain) {
          return { computer, status: 'Not on Domain' };
        }

        const isLoggedIn = await fetchLoggedInUsers(computer);
        return { computer, status: isLoggedIn ? 'Logged In' : '------' };
      }));

      const statusMap = statuses.reduce((acc, { computer, status }) => {
        acc[computer] = status;
        return acc;
      }, {});

      setComputerStatuses(statusMap);
    };

    if (computers.length > 0) {
      checkComputerStatuses();
    }
  }, [computers, adObjectID]);

  const copyToClipboard = (value) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        setTooltip({ visible: true, message: 'Copied!' });
        setTimeout(() => setTooltip({ visible: false, message: '' }), 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setTooltip({ visible: true, message: 'Copied!' });
        setTimeout(() => setTooltip({ visible: false, message: '' }), 2000);
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleContextMenu = (event, computer) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      computer
    });
  };

  const handleCloseContextMenu = useCallback((event) => {
    if (contextMenu.visible && !event.target.closest('.context-menu')) {
      setContextMenu({ visible: false, x: 0, y: 0, computer: null });
    }
  }, [contextMenu.visible]);

  const handleOpen = () => {
    if (contextMenu.computer) {
      navigate(`/ad-object/${contextMenu.computer}`);
    }
    setContextMenu({ visible: false, x: 0, y: 0, computer: null });
  };

  useEffect(() => {
    document.addEventListener('click', handleCloseContextMenu);
    return () => {
      document.removeEventListener('click', handleCloseContextMenu);
    };
  }, [handleCloseContextMenu]);

  return (
    <div className="current-computers-table-container">
      <table className="current-computers-table">
        <thead>
          <tr>
            <th colSpan="2">
              Current Computers
            </th>
          </tr>
        </thead>
        <tbody>
          {computers.map((computer) => (
            <tr key={computer} onContextMenu={(event) => handleContextMenu(event, computer)}>
              <td className="property-cell clickable-cell" onClick={() => copyToClipboard(computer)}>
                {computer}
              </td>
              <td className="value-cell">
                {computerStatuses[computer] || 'Checking...'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tooltip.visible && <div className="tooltip">{tooltip.message}</div>}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button onClick={handleOpen}>Open {contextMenu.computer}</button>
        </div>
      )}
    </div>
  );
};

export default CurrentComputersTable;