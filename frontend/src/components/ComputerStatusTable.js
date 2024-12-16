import React, { useEffect, useState } from 'react';
import '../styles/ComputerStatusTable.css';

const ComputerStatusTable = ({ adObjectID }) => {
  const [computerStatus, setComputerStatus] = useState('Checking...');
  const [ipv4Address, setIpv4Address] = useState('Fetching...');
  const [users, setUsers] = useState('Fetching...');
  const [autoRefresh, setAutoRefresh] = useState(true); // State to control auto-refresh
  const [ipFetched, setIpFetched] = useState(false); // State to track if IP address has been fetched

  useEffect(() => {
    const fetchComputerStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');

        const statusCommand = `Test-Connection -ComputerName ${adObjectID} -Count 1 -Quiet -ErrorAction Stop | ConvertTo-Json -Compress`;

        const statusResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ command: statusCommand }),
        });

        if (!statusResponse.ok) throw new Error('Network response was not ok');

        const statusData = await statusResponse.json();
        setComputerStatus(statusData === true ? 'Online' : 'Offline');

        if (statusData === true && !ipFetched) {
          fetchIpv4Address();
          fetchLoggedInUsers();
          setIpFetched(true); // Mark IP address as fetched
        } else if (statusData !== true) {
          setIpv4Address('Not Online');
          setUsers('No logged in users');
        }
      } catch (error) {
        console.error('Error fetching computer status:', error);
        setComputerStatus('Offline');
        setIpv4Address('Not Online');
        setUsers('No logged in users');
      }
    };

    fetchComputerStatus();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchComputerStatus, 5000); // Refresh every 5 seconds
    }

    return () => clearInterval(interval); // Cleanup interval on component unmount
  }, [adObjectID, autoRefresh, ipFetched]);

  const fetchIpv4Address = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const ipCommand = `Invoke-Command -ComputerName ${adObjectID} -ScriptBlock { Get-WmiObject -Class Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true } | Select-Object -ExpandProperty IPAddress | Where-Object { $_ -match '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' } } | ConvertTo-Json -Compress`;

      const ipResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ command: ipCommand }),
      });

      if (!ipResponse.ok) throw new Error('Network response was not ok');

      const ipData = await ipResponse.json();
      const ipAddress = ipData.value; // Extract the IP address value
      setIpv4Address(ipAddress);
    } catch (error) {
      console.error('Error fetching IP address:', error);
      setIpv4Address('Unavailable');
    }
  };

  const fetchLoggedInUsers = async () => {
    try {
      //  console.log(`Fetching logged in users for adObjectID: ${adObjectID}`);
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found');
      //  console.log('Token retrieved successfully');

        const usersCommand = `../../../Tools/PsLoggedon.exe -l -x \\\\${adObjectID} | ConvertTo-Json -Compress`;
      //  console.log(`Command to be executed: ${usersCommand}`);

        const usersResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/execute-command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ command: usersCommand }),
        });

        if (!usersResponse.ok) throw new Error('Network response was not ok');
      //  console.log('Command executed successfully');

        const usersData = await usersResponse.json();
      //  console.log('Response data:', usersData);

        // The response is already JSON, no need to parse it again
        const parsedData = usersData;
      //  console.log('Parsed output:', parsedData);

        if (!Array.isArray(parsedData)) {
            throw new Error('Unexpected data format');
        }

        const startIndex = parsedData.findIndex(line => line.includes('Users logged on locally:'));
      //  console.log('Start index of users list:', startIndex);

        const usersList = startIndex !== -1
            ? parsedData.slice(startIndex + 1).map(line => line.replace(/\t/g, '').trim()).filter(line => line)
            : [];
      // console.log('Users list:', usersList);

        setUsers(usersList.length > 0 ? usersList.join(', ') : 'No logged in users');
    } catch (error) {
      //  console.error('Error fetching logged in users:', error);
        setUsers('No logged in users');
    }
};

  return (
    <div className="computer-status-table-container">
      <table className="computer-status-table">
        <thead>
          <tr>
            <th colSpan="2">
              Stats
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={() => setAutoRefresh(!autoRefresh)}
                />
                <span className="slider round" title="Auto Status Refresh"></span>
              </label>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="property-cell">Status</td>
            <td className={`value-cell ${computerStatus.toLowerCase()}`}>
              {computerStatus}
            </td>
          </tr>
          <tr>
            <td className="property-cell">IPv4 Address</td>
            <td className="value-cell">
              {ipv4Address}
            </td>
          </tr>
          <tr>
            <td className="property-cell">Users</td>
            <td className="value-cell">
              {users}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ComputerStatusTable;