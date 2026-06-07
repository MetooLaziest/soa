/**
 * 主剧情框架管理 - 列表 + 子剧情展开
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

interface MainStory {
  id: string; name: string; description: string;
  era_background: string; history_background: string;
  main_story_description: string; created_at: string;
}

interface SubStory {
  id: string; title: string; description: string;
  main_story_id: string; ordering: number; created_at: string;
}

export default function Stories() {
  const [stories, setStories] = useState<MainStory[]>([]);
  const [subStories, setSubStories] = useState<Record<string, SubStory[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    client.get('/db/main-stories').then(res => {
      setStories(res.data.stories || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadSubStories = async (mainStoryId: string) => {
    if (subStories[mainStoryId]) return;
    try {
      const res = await client.get('/db/sub-stories');
      setSubStories(prev => ({
        ...prev,
        [mainStoryId]: (res.data.subStories || []).filter((s: SubStory) => s.main_story_id === mainStoryId)
      }));
    } catch {}
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    await loadSubStories(id);
  };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 animate-fade-in-up">
      <h2 className="mb-6 text-xl font-bold text-white">主剧情框架管理</h2>
      <div className="space-y-3">
        {stories.map(s => (
          <div key={s.id} className="rounded-xl border border-white/10 bg-card overflow-hidden">
            <button onClick={() => toggleExpand(s.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition">
              <div>
                <h3 className="font-semibold text-white">{s.name}</h3>
                <p className="mt-1 line-clamp-1 text-sm text-gray-400">{s.description || s.main_story_description}</p>
              </div>
              <span className={`text-gray-500 transition-transform ${expandedId === s.id ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedId === s.id && (
              <div className="border-t border-white/10 px-5 py-4 space-y-3">
                {/* 元信息 */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-gray-500">时代背景：</span><span className="text-gray-300">{s.era_background || '未设置'}</span></div>
                  <div><span className="text-gray-500">历史背景：</span><span className="text-gray-300">{s.history_background || '未设置'}</span></div>
                </div>
                {/* 子剧情列表 */}
                {(subStories[s.id] || []).length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">子剧情</h4>
                    {subStories[s.id].map(sub => (
                      <div key={sub.id} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                        <div>
                          <span className="text-sm font-medium text-white">{sub.title}</span>
                          <span className="ml-2 text-xs text-gray-500">#{sub.ordering}</span>
                        </div>
                        <button onClick={() => navigate(`/admin/stories/${s.id}/sub/${sub.id}/nodes`)}
                          className="rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-500/30">
                          编辑节点
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">暂无子剧情</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {stories.length === 0 && <div className="py-12 text-center text-sm text-gray-500">暂无剧情框架数据</div>}
    </div>
  );
}
