import React from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';
import './styles.css'; // Ensure this path is correct
import App from './App';

// Set the app element for react-modal
Modal.setAppElement('#root');

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);