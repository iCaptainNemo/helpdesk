import React from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';
import './styles.css'; // Ensure this path is correct
import MainApp from './MainApp';

// Set the app element for react-modal
Modal.setAppElement('#root');

ReactDOM.render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>,
  document.getElementById('root')
);