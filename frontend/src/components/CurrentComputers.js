import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/CurrentComputers.css';

const CurrentComputersTable = ({ adObjectID }) => {
  const [computers, setComputers] = useState([]);
  const [computerStatuses, setComputerStatuses] = useState({});
  const [tooltip, setTooltip] = useState({ visible: false, message: '' });
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, computer: null });
  const [isFetching, setIsFetching] = useState(false);
  const navigate = useNavigate();

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
      setComputers(uniqueComputers);
    } catch (error) {
      console.error('Error fetching computers:', error);
    }
  };

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

      if (data && data.DNSHostName) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(`Error checking domain status for computer ${computer}:`, error);
      return false;
    }
  };

  const fetchLoggedInUsers = async (computer, adObjectID) => {
    console.log(`Checking logged in users for computer: ${computer}, adObjectID: ${adObjectID}`);
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

      if (!Array.isArray(data)) {
        throw new Error('Unexpected data format');
      }

      const startIndex = data.findIndex(line => line.includes('Users logged on locally:'));
      const usersList = startIndex !== -1
        ? data.slice(startIndex + 1).map(line => line.replace(/\t/g, '').trim()).filter(line => line)
        : [];

      const isLoggedIn = usersList.some(user => {
        const userId = user.split('\\').pop().trim().toLowerCase();
        return userId === adObjectID.toLowerCase();
      });

      return isLoggedIn;
    } catch (error) {
      console.error(`Error fetching logged in users for computer ${computer}:`, error);
      return false;
    }
  };

  const checkComputerStatuses = async () => {
    const statusMap = { ...computerStatuses };

    for (const computer of computers) {
      const isOnDomain = await checkComputerDomainStatus(computer);

      if (!isOnDomain) {
        statusMap[computer] = 'Not on Domain';
      } else {
        const isLoggedIn = await fetchLoggedInUsers(computer, adObjectID);
        statusMap[computer] = isLoggedIn ? 'Logged In' : '------';
      }

      setComputerStatuses({ ...statusMap });
    }
  };

  const handleFetchComputers = async () => {
    setIsFetching(true);
    await fetchComputers();
    setIsFetching(false);
  };

  useEffect(() => {
    if (computers.length > 0) {
      checkComputerStatuses();
    }
  }, [computers]);

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
      <button className="fetch-computers-button" onClick={handleFetchComputers} disabled={isFetching}>
        {isFetching ? 'Searching...' : 'Search Current Computers'}
      </button>
      {computers.length > 0 && (
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
                <td className={`value-cell ${computerStatuses[computer] === 'Logged In' ? 'logged-in' : ''}`}>
                  {computerStatuses[computer] || 'Checking...'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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