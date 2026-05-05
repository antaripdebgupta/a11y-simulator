import React, { useState, useEffect } from 'react';
import { MessageType, type Message } from '../shared/messages';

export const Popup: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready');

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MessageType.POPUP_OPENED } as Message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        return;
      }
      if (response?.success) {
        setStatus('Connected');
      }
    });
  }, []);

  return (
    <div className="popup-container">
      <h1>A11y Simulator</h1>
      <p>Status: {status}</p>
    </div>
  );
};
