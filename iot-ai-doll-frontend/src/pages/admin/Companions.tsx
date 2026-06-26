/**
 * 机伴管理 + 数字生命宠物管理
 * 包含：机伴 CRUD（12字段）+ 数字生命宠物的5层提示词配置
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { CompanionForm } from './CompanionForm';

// ============ 类型定义 ============

interface CompanionModel {
  id: string;
  name: string;
  model_code: string;
  description: string;
  contractor_setting: string;
  initial_node_id: string;
  voice_id: string;
  avatar_asset_id: string;
  knowledge_scope: string | string[];
  initial_items: string | string[];
  mbti_base: any;
  catchphrases: string | string[];
  system_prompt_template: string;
  created_at: string;
}

interface EpetPet {
  petId: string;
  displayName: string;
  monsterType: string;
  modelId: number;        // pet_models.id
  systemPrompt: string;
  stats?: {
    fullness: number;
    totalFeeds: number;
    totalPets: number;
    totalPoops: number;
  };
}

interface PromptLayers {
  identity_anchor: string;
  core_personality: string;
  behavior_rules: string;
  skill_layer: string;
  context_memory_template: string;
  prompt_version: number;
}

const PET_ASSETS: Record<string, { img: string; color: string; bg: string; label: string }> = {
  white: { img: '/epet/pet-idle.png',  color: '#f5f5f5', bg: 'rgba(245,245,245,0.1)',  label: '白系' },
  blue:  { img: '/epet/pet-blue.png',  color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', label: '蓝系' },
  pink:  { img: '/epet/pet-pink.png',  color: '#f472b6', bg: 'rgba(244,114,182,0.15)', label: '粉系' },
  green: { img: '/epet/pet-idle.png',  color: '#86efac', bg: 'rgba(134,239,172,0.15)', label: '绿系' },
};

// NFC → model_id 映射
const NFC_TO_MODEL: Record<string, number> = {
  '2333': 1,   // 海浪沫沫
  '9527': 2,   // 团子糯糯
  '10086': 3,  // 糖心莓莓
};

// ============ 5层提示词编辑器 ============

const LAYER_TABS = [
  { key: 'identity_anchor',        label: 'L1 身份锚定',   icon: '🪪', hint: '定义"你是谁"，防止被 prompt 注入或上下文覆盖。用绝对肯定的陈述句。' },
  { key: 'core_personality',       label: 'L2 核心性格',   icon: '🎭', hint: '声线、口癖、说话风格、情绪阈值、禁忌。不可被其他层修改。' },
  { key: 'behavior_rules',         label: 'L3 行为准则',   icon: '📋', hint: '交互规则、响应优先级、价值观。可动态调整，优先级低于性格层。' },
  { key: 'skill_layer',            label: 'L4 技能层',     icon: '🔧', hint: '专属知识、技能、RAG/MCP能力。必须服从性格层。RAG预留，暂未启用。' },
  { key: 'context_memory_template',label: 'L5 上下文记忆', icon: '🧠', hint: '短期记忆模板。支持 {user_name}、{emotion_status} 等变量。' },
];

function LayerEditModal({ pet, onSave, onCancel }: {
  pet: EpetPet;
  onSave: (modelId: number, layers: PromptLayers) => Promise<void>;
  onCancel: () => void;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [layers, setLayers] = useState<PromptLayers>({
    identity_anchor: '',
    core_personality: '',
    behavior_rules: '',
    skill_layer: '',
    context_memory_template: '',
    prompt_version: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // 加载现有数据
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/epet1/admin/pet-models/${pet.modelId}/layers`);
        const d = await r.json();
        if (d.success && d.data) {
          setLayers({
            identity_anchor: d.data.identity_anchor || '',
            core_personality: d.data.core_personality || '',
            behavior_rules: d.data.behavior_rules || '',
            skill_layer: d.data.skill_layer || '',
            context_memory_template: d.data.context_memory_template || '',
            prompt_version: d.data.prompt_version || 1,
          });
        }
      } catch (e) {
        console.error('加载层数据失败:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [pet.modelId]);

  const currentKey = LAYER_TABS[activeTab].key as keyof PromptLayers;

  const handleChange = (val: string) => {
    setLayers(prev => ({ ...prev, [currentKey]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(pet.modelId, layers);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch('/api/epet1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 2, pet_instance_id: pet.petId, message: '你好！简单介绍一下自己吧~' }),
      });
      const d = await r.json();
      setTestResult(d.success ? d.reply : `错误：${d.error || '未知'}`);
    } catch (e: any) {
      setTestResult(`网络错误：${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  // 预览区：显示完整 prompt 拼接效果
  const previewPrompt = [
    `【第一层：身份锚定层】\n${layers.identity_anchor || '（未设置）'}`,
    `【第二层：核心性格层】\n${layers.core_personality || '（未设置）'}`,
    `【第三层：行为准则层】\n${layers.behavior_rules || '（未设置）'}`,
    `【第四层：技能层】\n${layers.skill_layer || '（未设置）'}`,
    `【第五层：上下文记忆层】\n${layers.context_memory_template || '（未设置）'}`,
    `\n【输出规则】\n直接以宠物身份说话，严禁加动作描写、旁白或"作为AI"。`,
  ].join('\n\n');

  const versionBadge = layers.prompt_version >= 2
    ? { text: 'v2 多层架构', style: 'bg-green-500/20 text-green-400' }
    : { text: 'v1 兼容模式', style: 'bg-yellow-500/20 text-yellow-400' };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-8">
          <div className="animate-pulse text-gray-400">加载提示词层数据...</div>
        </div>
      </div>
    );
  }

  const asset = PET_ASSETS[pet.monsterType] || PET_ASSETS.white;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8"
         onClick={onCancel}>
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
           onClick={e => e.stopPropagation()}>

        {/* 头部 */}
        <div className="flex items-center justify-between rounded-t-2xl border-b border-white/10 bg-gradient-to-r from-orange-500/20 to-pink-500/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={asset.img} alt={pet.displayName}
                 className="h-12 w-12 rounded-full border-2 border-white/30 object-cover" />
            <div>
              <h3 className="text-lg font-bold text-white">{pet.displayName} · 提示词配置</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400" style={{ color: asset.color }}>{asset.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${versionBadge.style}`}>{versionBadge.text}</span>
              </div>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white text-2xl leading-none">✕</button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-white/10 overflow-x-auto">
          {LAYER_TABS.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap transition border-b-2 ${
                i === activeTab
                  ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              <span>{tab.icon}</span>
              <span className="font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 编辑区 */}
        <div className="px-6 py-4 space-y-4">
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
            <p className="text-xs text-orange-300/80">{LAYER_TABS[activeTab].hint}</p>
          </div>

          <textarea
            value={layers[currentKey] as string}
            onChange={e => handleChange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-orange-500/60 focus:bg-slate-800/80 transition resize-y min-h-[200px] font-mono leading-relaxed"
            placeholder="在此编写该层的内容..."
          />

          {/* 预览 */}
          <details className="rounded-xl border border-white/5 bg-slate-800/40 overflow-hidden">
            <summary className="px-4 py-2.5 text-xs text-gray-500 cursor-pointer hover:text-gray-300 font-semibold">
              📄 完整 System Prompt 预览（5层拼接效果）
            </summary>
            <div className="px-4 pb-4">
              <pre className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">{previewPrompt}</pre>
            </div>
          </details>

          {/* 测试结果 */}
          {testResult && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              <span className="font-bold">🤖 AI 回复：</span>{testResult}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between rounded-b-2xl border-t border-white/10 bg-slate-800/50 px-6 py-4">
          <div className="text-xs text-gray-600">
            Token 估算：~{previewPrompt.length} 字符
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50">
              {testing ? '测试中...' : '🧪 测试对话'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50">
              {saving ? '保存中...' : '💾 保存全部5层'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 主组件 ============

export default function Companions() {
  const navigate = useNavigate();
  const [models, setModels] = useState<CompanionModel[]>([]);
  const [pets, setPets] = useState<EpetPet[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
    loadPets();
  }, []);

  // ===== 加载机伴列表（从 epet1.pet_models）=====
  const loadModels = async () => {
    try {
      const res = await client.get('/admin/models');
      const modelsData = (res.data.models || []).map((m: any) => ({
        ...m,
        id: String(m.id), // 统一为 string 兼容旧代码
        epet_model_id: m.id, // 关联 pet_models.id
      }));
      setModels(modelsData);
    } catch (err) {
      console.error('加载机伴列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // ===== 加载数字生命宠物 =====
  const loadPets = async () => {
    setPetsLoading(true);
    try {
      const r = await fetch('/api/epet/monsters');
      const d = await r.json();
      const petList: EpetPet[] = (d.success ? (d.monsters || []) : []).map((p: any) => ({
        petId: p.petId,
        displayName: p.displayName,
        monsterType: p.monsterType,
        modelId: NFC_TO_MODEL[p.petId] || 0,
        systemPrompt: '',
        stats: p.stats,
      }));
      setPets(petList);
    } catch (e) {
      console.error('加载宠物失败:', e);
    } finally {
      setPetsLoading(false);
    }
  };

  const handleSave = async (data: Record<string, any>) => {
    if (editingId) {
      await client.put(`/admin/models/${editingId}`, data);
    } else {
      await client.post('/admin/models', data);
    }
    await loadModels();
    setShowModal(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此机伴吗？')) return;
    try {
      await client.delete(`/admin/models/${id}`);
      await loadModels();
    } catch { alert('删除失败'); }
  };

  // ===== 保存5层提示词 =====
  const handleLayerSave = async (modelId: number, layers: PromptLayers) => {
    const r = await fetch(`/api/epet1/admin/pet-models/${modelId}/layers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...layers,
        prompt_version: 2,  // 保存即激活 v2
      }),
    });
    const d = await r.json();
    if (!d.success) throw new Error(d.error || '保存失败');
    setEditingPetId(null);
  };

  const openAdd = () => { setEditingId(null); setShowModal(true); };
  // 跳到独立路由: 5 层提示词 + 图片 + sprite 编辑器 (调 pet_models, 不是老 companion_models)
  // m.epet_model_id 是新表 id (1/2/3), m.id 是老表 UUID
  const openEdit = (m: any) => {
    const newId = m.epet_model_id || m.id;
    if (m.epet_model_id) {
      navigate(`/admin/companions/${newId}/edit`);
    } else {
      alert(`此机伴 "${m.name}" 还没绑定到新 pet_models (epet_model_id 为空),\n请先在 DB 把 m.id=${m.id} 关联到 pet_models.id`);
    }
  };
  const closeModal = () => { setShowModal(false); setEditingId(null); };

  const parseMbti = (raw: any) => {
    if (!raw) return { E: 50, I: 50, S: 50, T: 50 };
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return {}; } }
    return raw as Record<string, number>;
  };

  const toArr = (v: string | string[] | null | undefined) =>
    Array.isArray(v) ? v : (v ? [v] : []);

  const editingPet = editingPetId ? pets.find(p => p.petId === editingPetId) : null;

  return (
    <div className="p-6 animate-fade-in-up space-y-10">

      {/* ===== 数字生命宠物区域 ===== */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🪄</span> 数字生命宠物 · 5层提示词
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">5层架构：身份锚定 → 核心性格 → 行为准则 → 技能 → 上下文记忆</p>
          </div>
          <button
            onClick={loadPets}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition">
            🔄 刷新
          </button>
        </div>

        {petsLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-48 rounded-xl border border-white/10 bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {pets.map(p => {
              const asset = PET_ASSETS[p.monsterType] || PET_ASSETS.white;
              return (
                <div key={p.petId}
                     className="rounded-2xl border border-white/10 bg-card p-5 hover:border-orange-500/40 transition group">

                  {/* 宠物头部 */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={asset.img} alt={p.displayName}
                             className="h-14 w-14 rounded-full border-2 border-white/20 object-cover" />
                        <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] font-bold"
                              style={{ background: asset.bg, color: asset.color }}>
                          {asset.label}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{p.displayName}</h3>
                        <p className="text-xs text-gray-500 font-mono">Model #{p.modelId}</p>
                      </div>
                    </div>
                    {/* 状态指示 */}
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-bold text-green-400">
                      v2
                    </span>
                  </div>

                  {/* 饱腹度 */}
                  {p.stats && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>饱腹感</span>
                        <span className="font-mono text-gray-400">{p.stats.fullness}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                             style={{
                               width: `${p.stats.fullness}%`,
                               background: p.stats.fullness > 60 ? '#52c41a' : p.stats.fullness > 30 ? '#faad14' : '#ff4d4f',
                             }} />
                      </div>
                    </div>
                  )}

                  {/* 提示词概况 */}
                  <div className="mb-3 rounded-lg border border-white/5 bg-slate-800/60 p-2.5">
                    <div className="text-[10px] text-gray-600 uppercase mb-1 font-bold">5层提示词架构</div>
                    <div className="flex flex-wrap gap-1">
                      {['🪪身份','🎭性格','📋行为','🔧技能','🧠记忆'].map((label, i) => (
                        <span key={i} className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] text-orange-300">{label}</span>
                      ))}
                    </div>
                  </div>

                  {/* 宠物图片 */}
                  <div className="mb-3">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id={`upload-${p.petId}`}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const formData = new FormData();
                        formData.append('image', file);
                        formData.append('modelId', String(p.modelId));
                        
                        try {
                          const r = await fetch('/api/pet-images/upload', {
                            method: 'POST',
                            body: formData,
                          });
                          const d = await r.json();
                          if (d.success) {
                            alert('上传成功！');
                            loadPets();
                          } else {
                            alert(`上传失败：${d.error}`);
                          }
                        } catch (err: any) {
                          alert(`上传错误：${err.message}`);
                        }
                      }}
                    />
                    <label
                      htmlFor={`upload-${p.petId}`}
                      className="block w-full cursor-pointer rounded-xl border-2 border-dashed border-orange-500/30 bg-orange-500/5 py-2 text-center text-sm text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50 transition"
                    >
                      📷 点击上传图片
                    </label>
                  </div>

                  {/* 操作按钮 */}
                  <button
                    onClick={() => setEditingPetId(p.petId)}
                    className="w-full rounded-xl border border-orange-500/30 bg-orange-500/10 py-2 text-sm text-orange-400 font-semibold
                               hover:bg-orange-500/20 hover:border-orange-500/50 transition">
                    ✏️ 编辑5层提示词
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== 机伴管理区域 ===== */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🤖</span> 机伴管理
          </h2>
          <button onClick={openAdd}
                  className="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600 transition">
            + 新增机伴
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-56 rounded-xl border border-white/10 bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {models.map(m => {
              const mbti = parseMbti(m.mbti_base);
              const items = toArr(m.initial_items).join('、') || '无';
              return (
                <div key={m.id} className="rounded-xl border border-white/10 bg-card p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{m.name}</h3>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-gray-400 font-mono">{m.model_code}</span>
                      </div>
                      {m.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-400">{m.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(m)}
                              className="rounded-lg bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                              title="编辑">✏️</button>
                      <button onClick={() => handleDelete(m.id)}
                              className="rounded-lg bg-white/5 p-2 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
                              title="删除">🗑️</button>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {toArr(m.knowledge_scope).slice(0, 4).map(k => (
                      <span key={k} className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">{k}</span>
                    ))}
                    {toArr(m.knowledge_scope).length > 4 && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-500">+{toArr(m.knowledge_scope).length - 4}</span>
                    )}
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                    {m.voice_id && (
                      <div className="rounded bg-white/5 px-2 py-1.5">
                        <div className="text-gray-500">音色</div>
                        <div className="text-white font-mono truncate">{m.voice_id}</div>
                      </div>
                    )}
                    {m.system_prompt_template && (
                      <div className="rounded bg-white/5 px-2 py-1.5">
                        <div className="text-gray-500">SysPrompt</div>
                        <div className="text-green-400">✓ 已配置</div>
                      </div>
                    )}
                    {m.initial_node_id && (
                      <div className="rounded bg-white/5 px-2 py-1.5">
                        <div className="text-gray-500">初始剧情节点</div>
                        <div className="text-white font-mono truncate text-xs">{m.initial_node_id.slice(0, 8)}...</div>
                      </div>
                    )}
                    {m.avatar_asset_id && (
                      <div className="rounded bg-white/5 px-2 py-1.5">
                        <div className="text-gray-500">立绘</div>
                        <div className="text-blue-400">✓ 已设置</div>
                      </div>
                    )}
                  </div>

                  <div className="mb-3 space-y-1">
                    <div className="text-xs text-gray-500">MBTI 倾向</div>
                    {[['E', mbti.E], ['S', mbti.S], ['T', mbti.T]].map(([dim, val]) => (
                      <div key={dim} className="flex gap-1 items-center">
                        <span className="text-xs text-gray-500 w-4">{dim}</span>
                        <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${val || 50}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-4">{dim === 'E' ? 'I' : dim === 'S' ? 'N' : 'F'}</span>
                      </div>
                    ))}
                  </div>

                  {m.contractor_setting && (
                    <div className="mb-2 text-xs text-gray-500">
                      <span className="text-purple-400">契约者：</span>
                      <span className="text-gray-400 line-clamp-1">{m.contractor_setting.slice(0, 30)}...</span>
                    </div>
                  )}
                  {m.catchphrases && toArr(m.catchphrases).length > 0 && (
                    <div className="mb-2 text-xs text-gray-500">
                      <span className="text-yellow-400">口头禅：</span>
                      <span className="text-gray-400">{toArr(m.catchphrases)[0]}</span>
                    </div>
                  )}
                  {items !== '无' && (
                    <div className="mb-2 text-xs text-gray-500">
                      <span className="text-green-400">初始道具：</span>
                      <span className="text-gray-400">{items}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-600">{new Date(m.created_at).toLocaleDateString()} 创建</div>
                </div>
              );
            })}
          </div>
        )}

        {models.length === 0 && !loading && (
          <div className="rounded-xl border border-white/10 bg-card py-12 text-center">
            <div className="mb-3 text-4xl">🐱</div>
            <p className="text-sm text-gray-500">暂无机伴，点击上方按钮添加</p>
          </div>
        )}
      </section>

      {/* ===== 机伴编辑弹窗 ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8"
             onClick={closeModal}>
          <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-slate-900 p-6"
               onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editingId ? '编辑机伴' : '新增机伴'}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <CompanionForm
              initialData={editingId ? models.find(m => m.id === editingId) : undefined}
              onSave={handleSave}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}

      {/* ===== 5层提示词编辑器 ===== */}
      {editingPet && (
        <LayerEditModal
          pet={editingPet}
          onSave={handleLayerSave}
          onCancel={() => setEditingPetId(null)}
        />
      )}
    </div>
  );
}
