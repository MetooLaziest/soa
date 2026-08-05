/**
 * 管理后台布局 - 左侧 2 级导航 + 右侧内容区
 */
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

interface SubItem {
  key: string;
  label: string;
  icon: string;
  path: string;
}

interface NavGroup {
  key: string;
  label: string;
  icon: string;
  items: SubItem[];
}

// 顶栏独立项 (无分组, 1 项无需展开)
const topItems: SubItem[] = [
  { key: 'dashboard', label: '仪表盘', icon: '📊', path: '/admin/dashboard' },
];

// 8 个分组
const navGroups: NavGroup[] = [
  {
    key: 'pets',
    label: '宠物管理',
    icon: '🐾',
    items: [
      { key: 'pets', label: '宠物实体管理', icon: '🐾', path: '/admin/pets' },
      { key: 'waves', label: '量产波段', icon: '📦', path: '/admin/waves' },
      { key: 'companions', label: '机伴管理', icon: '🐱', path: '/admin/companions' },
      { key: 'pet-series', label: '机伴系列', icon: '🏠', path: '/admin/pet-series' },
    ],
  },
  {
    key: 'map',
    label: '场景地图',
    icon: '🗺️',
    items: [
      { key: 'locations', label: '地点管理', icon: '🗺️', path: '/admin/locations' },
      { key: 'zones', label: '区域管理', icon: '🌏', path: '/admin/zones' },
      { key: 'yard-editor', label: '庭院地图编辑', icon: '🗺️', path: '/admin/yard-editor' },
      { key: 'icons', label: '图标素材', icon: '🎨', path: '/admin/icons' },
    ],
  },
  {
    key: 'story',
    label: '剧情 / 对话',
    icon: '📖',
    items: [
      { key: 'stories', label: '主剧情框架', icon: '📖', path: '/admin/stories' },
      { key: 'ai-personality', label: '对话风格设定', icon: '💬', path: '/admin/ai-personality' },
      { key: 'ai-models', label: 'AI模型配置', icon: '🤖', path: '/admin/ai-models' },
      { key: 'ai-resources', label: 'AI资源监控', icon: '📊', path: '/admin/ai-resources' },
      { key: 'rag', label: 'RAG 知识库管理', icon: '📚', path: '/admin/rag' },
    ],
  },
  {
    key: 'assets',
    label: '素材资产',
    icon: '🎨',
    items: [
      { key: 'minigame-assets', label: '美术素材', icon: '🎨', path: '/admin/minigame-assets' },
      { key: 'assets', label: '素材管理', icon: '📁', path: '/admin/assets' },
      { key: 'cgs', label: 'CG 图鉴管理', icon: '🖼️', path: '/admin/cgs' },
    ],
  },
  {
    key: 'gameplay',
    label: '玩法',
    icon: '🎮',
    items: [
      { key: 'fishing', label: '钓鱼管理', icon: '🎣', path: '/admin/fishing' },
      { key: 'spotdiff', label: '找不同管理', icon: '🔍', path: '/admin/spotdiff' },
      { key: 'match3', label: '消消乐管理', icon: '💎', path: '/admin/match3' },
      { key: 'cooking', label: '料理管理', icon: '🍳', path: '/admin/cooking' },
      { key: 'travel', label: '旅游管理', icon: '🧳', path: '/admin/travel' },
    ],
  },
  {
    key: 'commerce',
    label: '商业化',
    icon: '🛍️',
    items: [
      { key: 'shop', label: '商店管理', icon: '🛍️', path: '/admin/shop' },
      { key: 'outfits', label: '装扮管理', icon: '👔', path: '/admin/outfits' },
      { key: 'items', label: '道具管理', icon: '🎒', path: '/admin/items' },
    ],
  },
  {
    key: 'users',
    label: '用户运营',
    icon: '👥',
    items: [
      { key: 'users', label: '用户列表', icon: '👥', path: '/admin/users' },
      { key: 'demo-time', label: '演示时间', icon: '🕐', path: '/admin/demo-time' },
    ],
  },
  {
    key: 'system',
    label: '系统',
    icon: '⚙️',
    items: [
      { key: 'sys-config', label: '系统配置', icon: '⚙️', path: '/admin/sys-config' },
      { key: 'site-config', label: '首页配置', icon: '🏠', path: '/admin/site-config' },
      { key: 'pwa-icon', label: 'PWA 图标', icon: '🖼', path: '/admin/pwa-icon' },
    ],
  },
];

export default function AdminLayout() {
  const location = useLocation();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // 默认展开当前 active 路径所在的 group
    const initial = new Set<string>();
    for (const g of navGroups) {
      if (g.items.some(it => location.pathname.startsWith(it.path))) {
        initial.add(g.key);
      }
    }
    return initial;
  });

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-dark">
      {/* 左侧导航 */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-slate-900">
        <div className="border-b border-white/10 px-5 py-4">
          <h1 className="text-lg font-bold text-white">艾瑟拉奇幻谭</h1>
          <p className="text-xs text-gray-500">后台管理系统</p>
        </div>
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {/* 顶栏独立项: 仪表盘 */}
          {topItems.map(item => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link key={item.key} to={item.path}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}>
                <span>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* 分组分隔线 */}
          <div className="my-3 border-t border-white/5" />

          {/* 8 个分组 */}
          {navGroups.map(group => {
            const activeItem = group.items.find(it => location.pathname.startsWith(it.path));
            const isOpen = expanded.has(group.key);
            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggle(group.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                    activeItem ? 'text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span>{group.icon}</span>
                    <span className="font-medium">{group.label}</span>
                  </span>
                  <span
                    className={`text-xs text-gray-500 transition-transform duration-200 ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  >
                    ▶
                  </span>
                </button>
                {isOpen && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                    {group.items.map(item => {
                      const active = location.pathname.startsWith(item.path);
                      return (
                        <Link key={item.key} to={item.path}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                            active ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}>
                          <span className="text-xs">{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
