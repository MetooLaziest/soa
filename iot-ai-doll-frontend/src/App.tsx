/**
 * 艾瑟拉奇幻谭 - 路由配置
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import DeviceBind from './pages/DeviceBind';
import MainUI from './pages/MainUI';
import AdminLayout from './pages/admin/Layout';
import Dashboard from './pages/admin/Dashboard';
import Companions from './pages/admin/Companions';
import Stories from './pages/admin/Stories';
import StoryNodes from './pages/admin/StoryNodes';
import Locations from './pages/admin/Locations';
import Items from './pages/admin/Items';
import CGGallery from './pages/admin/CGGallery';
import AIModels from './pages/admin/AIModels';
import AIPersonality from './pages/admin/AIPersonality';
import DeviceSN from './pages/admin/DeviceSN';
import Users from './pages/admin/Users';
import SystemConfig from './pages/admin/SystemConfig';
import MiniGameAssets from './pages/admin/MiniGameAssets';
import PetEntities from './pages/admin/PetEntities';
import CompanionEdit from './pages/admin/CompanionEdit';
import YardSceneEditor from './pages/admin/YardSceneEditor';
import FishingAdmin from './pages/admin/FishingAdmin';
import ShopAdmin from './pages/admin/ShopAdmin';
import SpotDiffAdmin from './pages/admin/SpotDiffAdmin';
import Match3Admin from './pages/admin/Match3Admin';
import CompanionRAG from './pages/admin/CompanionRAG';
import RAGList from './pages/admin/RAGKnowledgeBases';
import RAGEdit from './pages/admin/RAGEdit';

/** 需要登录才能访问的路由包装器 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, init } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login', { replace: true });
  }, [loading, isAuthenticated, navigate]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-dark text-gray-400">加载中...</div>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}

/** 公开路由（已登录时重定向到首页） */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, init } = useAuthStore();
  useEffect(() => { init(); }, [init]);
  if (loading) return <div className="flex h-screen items-center justify-center bg-dark text-gray-400">加载中...</div>;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        
        {/* 私有路由 */}
        <Route path="/" element={<PrivateRoute><MainUI /></PrivateRoute>} />
        <Route path="/bind-device" element={<PrivateRoute><DeviceBind /></PrivateRoute>} />
        
        {/* 管理后台 */}
        <Route path="/admin" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="companions" element={<Companions />} />
          <Route path="stories" element={<Stories />} />
          <Route path="stories/:mainStoryId/sub/:subStoryId/nodes" element={<StoryNodes />} />
          <Route path="locations" element={<Locations />} />
          <Route path="items" element={<Items />} />
          <Route path="cgs" element={<CGGallery />} />
          <Route path="ai-models" element={<AIModels />} />
          <Route path="ai-personality" element={<AIPersonality />} />
          <Route path="devices" element={<DeviceSN />} />
          <Route path="users" element={<Users />} />
          <Route path="sys-config" element={<SystemConfig />} />
          <Route path="minigame-assets" element={<MiniGameAssets />} />
          <Route path="pets" element={<PetEntities />} />
          <Route path="companions/:id/edit" element={<CompanionEdit />} />
          <Route path="companions/:id/rag" element={<CompanionRAG />} />
          <Route path="rag" element={<RAGList />} />
          <Route path="rag/new" element={<RAGEdit />} />
          <Route path="rag/:id/edit" element={<RAGEdit />} />
          <Route path="yard-editor" element={<YardSceneEditor />} />
          <Route path="fishing" element={<FishingAdmin />} />
          <Route path="shop" element={<ShopAdmin />} />
          <Route path="spotdiff" element={<SpotDiffAdmin />} />
          <Route path="match3" element={<Match3Admin />} />
        </Route>

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
