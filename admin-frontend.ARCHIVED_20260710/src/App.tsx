import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CompanionList from './pages/companions/CompanionList';
import CompanionEdit from './pages/companions/CompanionEdit';
import CompanionRAG from './pages/companions/CompanionRAG';
import RAGList from './pages/rag/RAGList';
import RAGEdit from './pages/rag/RAGEdit';
import PetEntities from './pages/pets/PetEntities';
import HomeModeSettings from './pages/settings/HomeModeSettings';

const App: React.FC = () => {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/companions" element={<Layout><CompanionList /></Layout>} />
        <Route path="/companions/:id/edit" element={<Layout><CompanionEdit /></Layout>} />
        <Route path="/companions/:id/rag" element={<Layout><CompanionRAG /></Layout>} />
        <Route path="/pets" element={<Layout><PetEntities /></Layout>} />
        <Route path="/rag/new" element={<Layout><RAGEdit /></Layout>} />
        <Route path="/rag/:id/edit" element={<Layout><RAGEdit /></Layout>} />
        <Route path="/rag" element={<Layout><RAGList /></Layout>} />
        <Route path="/settings/home-mode" element={<Layout><HomeModeSettings /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
