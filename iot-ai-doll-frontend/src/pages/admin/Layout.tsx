/**
 * 管理后台布局 - 左侧导航 + 右侧内容区
 */
import { Link, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { key: 'dashboard', label: '仪表盘', icon: '📊', path: '/admin/dashboard' },
  { key: 'companions', label: '机伴管理', icon: '🐱', path: '/admin/companions' },
  { key: 'locations', label: '地点管理', icon: '🗺️', path: '/admin/locations' },
  { key: 'ai-models', label: 'AI模型配置', icon: '🤖', path: '/admin/ai-models' },
  { key: 'ai-personality', label: '对话风格设定', icon: '💬', path: '/admin/ai-personality' },
  { key: 'stories', label: '主剧情框架', icon: '📖', path: '/admin/stories' },
  { key: 'items', label: '道具管理', icon: '🎒', path: '/admin/items' },
  { key: 'cgs', label: 'CG图鉴管理', icon: '🖼️', path: '/admin/cgs' },
  // { key: 'devices', label: '设备SN录入', icon: '📱', path: '/admin/devices' },  // 已废弃, 统一用宠物实体管理
  { key: 'users', label: '用户列表', icon: '👥', path: '/admin/users' },
  { key: 'sys-config', label: '系统配置', icon: '⚙️', path: '/admin/sys-config' },
  { key: 'pets', label: '宠物实体管理', icon: '🐾', path: '/admin/pets' },
  { key: 'rag', label: 'RAG 知识库管理', icon: '📚', path: '/admin/rag' },
  { key: 'minigame-assets', label: '美术素材', icon: '🎨', path: '/admin/minigame-assets' },
  { key: 'fishing', label: '钓鱼管理', icon: '🎣', path: '/admin/fishing' },
  { key: 'assets', label: '素材管理', icon: '📁', path: '/admin/assets' },
  { key: 'shop', label: '商店管理', icon: '🛍️', path: '/admin/shop' },
  { key: 'spotdiff', label: '找不同管理', icon: '🔍', path: '/admin/spotdiff' },
  { key: 'match3', label: '消消乐管理', icon: '💎', path: '/admin/match3' },
  { key: 'cooking', label: '料理管理', icon: '🍳', path: '/admin/cooking' },
  { key: 'travel', label: '旅游管理', icon: '🧳', path: '/admin/travel' },
  { key: 'yard-editor', label: '庭院地图编辑', icon: '🗺️', path: '/admin/yard-editor' },
  { key: 'zones', label: '区域管理', icon: '🌏', path: '/admin/zones' },
  { key: 'icons', label: '图标素材', icon: '🎨', path: '/admin/icons' },
  { key: 'pet-series', label: '机伴系列', icon: '🏠', path: '/admin/pet-series' },
  { key: 'site-config', label: '首页配置', icon: '🏠', path: '/admin/site-config' },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-dark">
      {/* 左侧导航 */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-slate-900">
        <div className="border-b border-white/10 px-5 py-4">
          <h1 className="text-lg font-bold text-white">艾瑟拉奇幻谭</h1>
          <p className="text-xs text-gray-500">后台管理系统</p>
        </div>
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navItems.map(item => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link key={item.key} to={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link to="/" className="block rounded-lg px-3 py-2.5 text-sm text-gray-500 hover:bg-white/5 hover:text-white">
            ← 返回体验
          </Link>
        </div>
      </aside>

      {/* 右侧内容 */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
