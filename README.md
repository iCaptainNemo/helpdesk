# Helpdesk Jarvis

Helpdesk Jarvis is a comprehensive tool designed to assist helpdesk teams with common tasks and procedures. This repository contains a collection of domain-agnostic PowerShell scripts and a web-based GUI to streamline helpdesk operations, making it easier to manage user accounts, retrieve system information, and perform various administrative tasks.

## Features

- **PowerShell Scripts**: A collection of scripts to automate common helpdesk tasks.
- **Web-Based GUI**: A user-friendly interface built with React to interact with the PowerShell scripts.
- **Session Management**: Secure session handling with JWT authentication.
- **Database Integration**: SQLite database for storing user and session data.
- **Real-Time Updates**: Integration with Socket.IO for real-time updates.


## Installation

### Prerequisites

- Node.js (v14.x or later)
- npm (v6.x or later)
- PowerShell (v5.1 or later)
- SQLite3

### Backend Setup

1. **Navigate to the Backend directory**:
    ```sh
    cd Backend
    ```

2. **Install dependencies**:
    ```sh
    npm install
    ```

3. **Create a [`.env`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fh%3A%2Fhelpdesk-GUI%2FBackend%2Fdb%2Finit.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A4%2C%22character%22%3A46%7D%7D%5D%2C%22c819a34a-31cc-494a-963c-5d945048c05e%22%5D "Go to definition") file**:
    ```sh
    cp .env.example .env
    ```

4. **Configure the [`.env`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fh%3A%2Fhelpdesk-GUI%2FBackend%2Fdb%2Finit.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A4%2C%22character%22%3A46%7D%7D%5D%2C%22c819a34a-31cc-494a-963c-5d945048c05e%22%5D "Go to definition") file** with your environment variables.

5. **Start the backend server**:
    ```sh
    npm start
    ```

### Frontend Setup

1. **Navigate to the frontend directory**:
    ```sh
    cd frontend
    ```

2. **Install dependencies**:
    ```sh
    npm install
    ```

3. **Create a [`.env`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fh%3A%2Fhelpdesk-GUI%2FBackend%2Fdb%2Finit.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A4%2C%22character%22%3A46%7D%7D%5D%2C%22c819a34a-31cc-494a-963c-5d945048c05e%22%5D "Go to definition") file**:
    ```sh
    cp .env.example .env
    ```

4. **Configure the [`.env`](command:_github.copilot.openSymbolFromReferences?%5B%22%22%2C%5B%7B%22uri%22%3A%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fh%3A%2Fhelpdesk-GUI%2FBackend%2Fdb%2Finit.js%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22pos%22%3A%7B%22line%22%3A4%2C%22character%22%3A46%7D%7D%5D%2C%22c819a34a-31cc-494a-963c-5d945048c05e%22%5D "Go to definition") file** with your environment variables.

5. **Start the frontend server**:
    ```sh
    npm start
    ```

### Running the Project

1. **Navigate to the project root directory**:
    ```sh
    cd ..
    ```

2. **Start both backend and frontend servers concurrently**:
    ```sh
    npm run start
    ```

The backend server will run on `http://localhost:3001` and the frontend server will run on `http://localhost:3000`.

## Usage

1. **Access the web-based GUI**:
    Open your browser and navigate to `http://localhost:3000`.

2. **Login**:
    Use your credentials to log in.

3. **Execute Scripts**:
    Use the provided interface to execute various PowerShell scripts and manage helpdesk tasks.

## License

This project is licensed under the GNU General Public License. See the [`LICENSE`](command:_github.copilot.openRelativePath?%5B%7B%22scheme%22%3A%22file%22%2C%22authority%22%3A%22%22%2C%22path%22%3A%22%2Fh%3A%2Fhelpdesk-GUI%2FLICENSE%22%2C%22query%22%3A%22%22%2C%22fragment%22%3A%22%22%7D%2C%22c819a34a-31cc-494a-963c-5d945048c05e%22%5D "h:\helpdesk-GUI\LICENSE") file for details.

## Contributing

Contributions are welcome! 

## Contact

For any questions or issues, please open an issue on GitHub or contact the project maintainers.
