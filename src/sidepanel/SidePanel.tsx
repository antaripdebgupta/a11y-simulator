import React, { useState, useEffect } from 'react';
import { MessageType, type Message } from '../shared/messages';

export const SidePanel: React.FC = () => {
  const [data] = useState<string[]>([]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MessageType.SIDEPANEL_OPENED } as Message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        return;
      }
      if (response?.success) {
        console.log('Side panel connected');
      }
    });
  }, []);

  return (
    <div className="sidepanel-container">
      <header className="sidepanel-header">
        <h1>Side Panel</h1>
      </header>
      <main className="sidepanel-content">
        <p>Welcome to the side panel</p>
        {data.length > 0 && (
          <ul>
            {data.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};
