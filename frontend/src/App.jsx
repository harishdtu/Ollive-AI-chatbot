import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import Dashboard from './components/Dashboard';
import LogsView from './components/LogsView';

export default function App() {
  const [view, setView] = useState('chat');           // 'chat' | 'dashboard' | 'logs'
  const [activeConvId, setActiveConvId] = useState(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);

  const handleConvCreated = (id) => {
    setActiveConvId(id);
    setRefreshSidebar(n => n + 1);
  };

  const handleConvSelect = (id) => {
    setActiveConvId(id);
    setView('chat');
  };

  const handleConvCancelled = () => {
    setActiveConvId(null);
    setRefreshSidebar(n => n + 1);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        activeConvId={activeConvId}
        onSelect={handleConvSelect}
        onNewChat={() => { setActiveConvId(null); setView('chat'); }}
        onViewChange={setView}
        currentView={view}
        refresh={refreshSidebar}
      />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        {view === 'chat' && (
          <ChatView
            conversationId={activeConvId}
            onCreated={handleConvCreated}
            onCancelled={handleConvCancelled}
          />
        )}
        {view === 'dashboard' && <Dashboard />}
        {view === 'logs'      && <LogsView />}
      </main>
    </div>
  );
}
