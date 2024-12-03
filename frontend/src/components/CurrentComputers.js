import React, { useEffect, useState } from 'react';
import '../styles/CurrentComputers.css';

const CurrentComputersTable = ({ adObjectID }) => {
  const [computers, setComputers] = useState([]);
  const [computerStatuses, setComputerStatuses] = useState({});

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
        setComputers(uniqueComputers);
   //     console.log('Unique computers:', uniqueComputers);
      } catch (error) {
  //      console.error('Error fetching computers:', error);
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
      //  console.log(`Domain status for ${computer}:`, data.length > 0);
        return data.length > 0;
      } catch (error) {
      //  console.error(`Error checking domain status for computer ${computer}:`, error);
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
    
   //     console.log('Parsed data:', parsedData);
    
        const startIndex = parsedData.findIndex(line => line.includes('Users logged on locally:'));
        const usersList = startIndex !== -1
          ? parsedData.slice(startIndex + 1).map(line => line.replace('\\t', '').trim()).filter(line => line)
          : [];
    
    //    console.log('Users list:', usersList);
    
        const username = adObjectID.split('\\').pop().toLowerCase().trim(); // Extract and normalize the username from adObjectID
    //    console.log('Username to match:', username);
    
        const isLoggedIn = usersList.some(user => user.toLowerCase().includes(username));
     //   console.log(`Logged in status for ${computer}:`, isLoggedIn);
        return isLoggedIn;
      } catch (error) {
    //    console.error(`Error fetching logged in users for computer ${computer}:`, error);
        return false;
      }
    };

    const checkComputerStatuses = async () => {
      console.log('Computers to check:', computers);

      const statuses = await Promise.all(computers.map(async (computer) => {
       // console.log(`Checking domain status for computer: ${computer}`);
        const isOnDomain = await checkComputerDomainStatus(computer);
      //  console.log(`Domain status for ${computer}: ${isOnDomain}`);

        if (!isOnDomain) {
          return { computer, status: 'Not on Domain' };
        }

      //  console.log(`Checking logged in status for computer: ${computer}`);
        const isLoggedIn = await fetchLoggedInUsers(computer);
      //  console.log(`Logged in status for ${computer}: ${isLoggedIn}`);

        return { computer, status: isLoggedIn ? 'Logged In' : '------' };
      }));

     // console.log('Statuses:', statuses);

      const statusMap = statuses.reduce((acc, { computer, status }) => {
        acc[computer] = status;
        return acc;
      }, {});

     // console.log('Computed statuses:', statusMap);
      setComputerStatuses(statusMap);
    };

    if (computers.length > 0) {
      checkComputerStatuses();
    }
  }, [computers]);

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
            <tr key={computer}>
              <td className="property-cell">{computer}</td>
              <td className="value-cell">
                {computerStatuses[computer] || 'Checking...'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CurrentComputersTable;