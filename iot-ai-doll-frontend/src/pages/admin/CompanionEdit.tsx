/**
 * 机伴模板编辑器 - 5 层提示词 + 图片 + sprite (2026-06-19 重写)
 * 路径: /admin/companions/:id/edit
 *
 * 5 层提示词 (epet1.pet_models):
 *   L1 identity_anchor       身份锚点 - "你是谁"
 *   L2 core_personality      核心性格 - "你性格如何"
 *   L3 behavior_rules        行为规则 - "什么不能做"
 *   L4 skill_layer           技能层   - "你会什么/RAG能力"
 *   L5 context_memory_template 上下文记忆模板 - "用户信息/情绪值等占位符"
 *
 * 素材:
 *   - portrait (互动立绘) - 上传后写入 model.image_url
 *   - sprite (庭院多状态) - walk/idle/eat/shake 等多张 PNG 或 sprite sheet
 *     写入 model.animations 字段 (jsonb)
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import client from '../../api/client';

// ═══════════════════════════════════════════════════
// 开场视频配置类型
// ═══════════════════════════════════════════════════
interface IntroVideo {
  id: number;
  pet_model_id: number;
  name: string;
  time_start: string;
  time_end: string;
  growth_level: number;
  video_url: string;
  duration_sec: number;
  is_active: boolean;
  sort_order: number;
}

const LAYERS = [
  {
    key: 'identity_anchor',
    code: 'L1',
    name: '身份锚点',
    hint: '定义宠物是谁、来自哪里、使命与基本身份。例: "你是海浪沫沫, 绒绒谷的哎哎兽, 家族二弟。"',
    placeholder: '请输入身份定义...',
  },
  {
    key: 'core_personality',
    code: 'L2',
    name: '核心性格',
    hint: '定义性格特点、行为风格、语气偏好。例: "你性格活泼开朗, 喜欢提各种游玩的建议。"',
    placeholder: '请输入核心性格...',
  },
  {
    key: 'behavior_rules',
    code: 'L3',
    name: '行为规则',
    hint: '绝对不能做的事。例: "绝对不能提人工智能、AI、模型、程序、代码这些词。绝对不能说脏话。"',
    placeholder: '请输入行为规则...',
  },
  {
    key: 'skill_layer',
    code: 'L4',
    name: '技能层',
    hint: '专属知识/技能/RAG能力等。例: "【专属知识】xxx, 【技能】xxx, 【RAG能力】(预留, 暂未启用)"',
    placeholder: '请输入技能层...',
  },
  {
    key: 'context_memory_template',
    code: 'L5',
    name: '上下文记忆模板',
    hint: '对话中需要注入的运行时变量, 用 {var_name} 占位。例: "【用户信息】{user_name}, 【当前情绪】快乐值{joy_value}..."',
    placeholder: '请输入上下文记忆模板...',
  },
];

export default function CompanionEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname.endsWith('/companions/new');

  const [model, setModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<string | null>(null); // 当前上传的类型
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string>('portrait');

  // 5 层提示词独立字段
  const [layers, setLayers] = useState<Record<string, string>>({
    identity_anchor: '',
    core_personality: '',
    behavior_rules: '',
    skill_layer: '',
    context_memory_template: '',
  });

  // sprite 配置 (animations jsonb)
  const [animations, setAnimations] = useState<Record<string, string[]>>({});

  // 编辑中的元数据
  const [meta, setMeta] = useState({
    name: '',
    description: '',
    mbti: '',
    rarity: 'common',
    display_order: 1,
    image_url: '',
  });

  // 对话测试
  const [testMsg, setTestMsg] = useState('');
  const [testResp, setTestResp] = useState('');
  const [testing, setTesting] = useState(false);

  // ═══════════════════════════════════════════════════
  // 开场视频配置
  // ═══════════════════════════════════════════════════
  const [introVideos, setIntroVideos] = useState<IntroVideo[]>([]);
  const [introLoading, setIntroLoading] = useState(false);
  const [introUploading, setIntroUploading] = useState(false);
  const [introEditId, setIntroEditId] = useState<number | null>(null);
  const [showIntroForm, setShowIntroForm] = useState(false);
  const introFileRef = useRef<HTMLInputElement>(null);
  const [introForm, setIntroForm] = useState({
    name: '',
    time_start: '08:00',
    time_end: '12:00',
    growth_level: 0,
    video_url: '',
    duration_sec: 30,
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      if (!id || isNew) { setLoading(false); return; }
      const res = await client.get(`/admin/models/${id}`);
      if (res.data?.success && res.data.data) {
        const m = res.data.data;
        setModel(m);
        setMeta({
          name: m.name || '',
          description: m.description || '',
          mbti: m.mbti || '',
          rarity: m.rarity || 'common',
          display_order: m.display_order || 1,
          image_url: m.image_url || '',
        });
        setLayers({
          identity_anchor: m.identity_anchor || '',
          core_personality: m.core_personality || '',
          behavior_rules: m.behavior_rules || '',
          skill_layer: m.skill_layer || '',
          context_memory_template: m.context_memory_template || '',
        });
        setAnimations(m.animations || {});
      }
      // 加载开场视频配置
      await loadIntroVideos();
    } catch (err) {
      console.error('加载失败', err);
      setError('加载失败: ' + (err as any).message);
    } finally {
      setLoading(false);
    }
  };

  const loadIntroVideos = async () => {
    if (!id) return;
    setIntroLoading(true);
    try {
      const res = await client.get(`/admin/intro-videos?pet_model_id=${id}`);
      if (res.data?.success) {
        setIntroVideos(res.data.videos || []);
      }
    } catch (err) {
      console.error('加载开场视频失败:', err);
    } finally {
      setIntroLoading(false);
    }
  };

  const handleSave = async () => {
    if (!layers.identity_anchor.trim()) {
      alert('L1 身份锚点不能为空');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await client.put(`/admin/models/${id}`, {
        ...meta,
        ...layers,
        animations,
      });
      alert('保存成功');
      navigate('/admin/companions');
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (type: string) => {
    setUploadType(type);
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 清空以便同文件可重复上传
    if (!file || !id) return;
    setUploading(uploadType);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', uploadType);
      const res = await client.post(`/admin/models/${id}/upload-image`, fd, {
        timeout: 5 * 60 * 1000, // 5 分钟
      });
      if (res.data?.success) {
        if (uploadType === 'portrait') {
          setMeta((m) => ({ ...m, image_url: res.data.url }));
        } else {
          // sprite 文件, 加到 animations
          setAnimations((a) => ({
            ...a,
            [uploadType]: [...(a[uploadType] || []), res.data.url],
          }));
        }
        // 重新拉取确保同步
        await loadData();
        alert(`${uploadType} 上传成功: ${res.data.url}`);
      }
    } catch (err: any) {
      alert('上传失败: ' + (err?.response?.data?.error || err.message));
    } finally {
      setUploading(null);
    }
  };

  const removeAnimation = (type: string, url: string) => {
    setAnimations((a) => ({
      ...a,
      [type]: (a[type] || []).filter((u) => u !== url),
    }));
  };

  const handleTestChat = async () => {
    if (!testMsg.trim() || !id) return;
    setTesting(true);
    setTestResp('');
    try {
      const petsRes = await client.get('/admin/pets');
      const pets = petsRes.data?.pets || [];
      const testPet = pets.find((p: any) => String(p.pet_model_id) === String(id)) || pets[0];
      if (!testPet) { setTestResp('无可用宠物实体进行测试'); setTesting(false); return; }
      const res = await client.post(`/epet/${testPet.nfc_id}/chat`, { message: testMsg });
      setTestResp(res.data?.reply || res.data?.message || '无响应');
    } catch (err: any) {
      setTestResp('请求失败: ' + (err?.message || '未知错误'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">加载中...</div>;
  }
  if (isNew) {
    return <div className="flex h-64 items-center justify-center text-gray-400">新建模板请在「机伴管理」中操作</div>;
  }
  if (!model) {
    return <div className="flex h-64 items-center justify-center text-red-400">模板不存在</div>;
  }

  return (
    <div className="space-y-5 p-5 max-w-6xl mx-auto">
      {/* 隐藏的 file input (图片) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onFileChange}
        style={{ display: 'none' }}
      />

      {/* 页头 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/companions')}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-slate-600"
        >
          ← 返回
        </button>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-white">
            机伴模型 — {model.name}
          </h2>
          <p className="text-xs text-gray-500">
            ID: {model.id} · prompt_version: {model.prompt_version || 0} · 所有基于此 model 的实体共享配置
          </p>
        </div>
      </div>

      {/* 基础元数据 + 互动立绘 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-medium text-gray-300 border-b border-white/10 pb-2 mb-4">
          基础信息 + 互动立绘
        </h3>
        <div className="flex gap-6">
          {/* 左: 立绘预览 + 上传 */}
          <div className="flex-shrink-0">
            <div className="w-40 h-40 rounded-xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
              {meta.image_url ? (
                <img src={meta.image_url} alt="立绘" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-500 text-xs text-center px-2">未上传<br />互动立绘</span>
              )}
            </div>
            <button
              onClick={() => handleUploadImage('portrait')}
              disabled={uploading === 'portrait'}
              className="mt-2 w-40 rounded-lg bg-purple-500 px-3 py-1.5 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
            >
              {uploading === 'portrait' ? '上传中...' : '上传立绘'}
            </button>
            <p className="mt-1 text-xs text-gray-500 text-center">
              用于互动页 + 藏品库
            </p>
          </div>

          {/* 右: 元数据 */}
          <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
            <Field label="名称">
              <input
                value={meta.name}
                onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white"
              />
            </Field>
            <Field label="MBTI">
              <input
                value={meta.mbti}
                onChange={(e) => setMeta({ ...meta, mbti: e.target.value })}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white"
                placeholder="例: ENFP"
              />
            </Field>
            <Field label="稀有度">
              <select
                value={meta.rarity}
                onChange={(e) => setMeta({ ...meta, rarity: e.target.value })}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white"
              >
                <option value="common">普通</option>
                <option value="rare">稀有</option>
                <option value="epic">史诗</option>
                <option value="legendary">传说</option>
              </select>
            </Field>
            <Field label="显示顺序">
              <input
                type="number"
                value={meta.display_order}
                onChange={(e) => setMeta({ ...meta, display_order: Number(e.target.value) })}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white"
              />
            </Field>
            <Field label="描述" className="col-span-2">
              <textarea
                value={meta.description}
                onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                rows={2}
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white text-xs resize-y"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* 5 层提示词编辑器 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
        <h3 className="text-sm font-medium text-gray-300 border-b border-white/10 pb-2">
          5 层提示词配置（独立字段存储, 运行时按 L1→L5 顺序注入对话）
        </h3>

        {LAYERS.map((l) => (
          <div key={l.key}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs font-mono text-purple-300">
                {l.code}
              </span>
              <span className="text-sm font-medium text-white">{l.name}</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">{l.hint}</p>
            <textarea
              value={layers[l.key] || ''}
              onChange={(e) => setLayers({ ...layers, [l.key]: e.target.value })}
              rows={l.key === 'context_memory_template' ? 6 : 5}
              className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-white text-xs font-mono resize-y"
              placeholder={l.placeholder}
            />
          </div>
        ))}
      </div>

      {/* 庭院 sprite 多状态 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-300 border-b border-white/10 pb-2">
          庭院 Sprite（多状态/多帧）— 用于在 yard 中行走动画
        </h3>
        <p className="text-xs text-gray-500">
          每种状态可上传多张 PNG, 代码按数组顺序拼接。可同时维护 walk / idle / eat / shake / sleep 等状态。
        </p>
        {(['walk', 'idle', 'eat', 'shake', 'sleep'] as const).map((type) => (
          <div key={type} className="rounded-lg bg-white/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white capitalize">{type}</span>
              <button
                onClick={() => handleUploadImage(type)}
                disabled={uploading === type}
                className="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {uploading === type ? '上传中...' : `+ 添加 ${type} 帧`}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(animations[type] || []).length === 0 ? (
                <span className="text-xs text-gray-500 py-2">未上传</span>
              ) : (
                animations[type].map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url}
                      alt={`${type}_${i}`}
                      className="w-16 h-16 object-cover rounded border border-white/10 bg-black/30"
                    />
                    <button
                      onClick={() => removeAnimation(type, url)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs hidden group-hover:flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 对话测试 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">对话测试</h3>
        <div className="flex gap-2">
          <input
            value={testMsg}
            onChange={(e) => setTestMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTestChat()}
            className="flex-1 rounded bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="输入测试消息, 按回车发送..."
          />
          <button
            onClick={handleTestChat}
            disabled={testing}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
          >
            {testing ? '测试中...' : '发送'}
          </button>
        </div>
        {testResp && (
          <div className="rounded-lg bg-black/30 p-3 text-sm text-gray-300 whitespace-pre-wrap min-h-[60px]">
            {testResp}
          </div>
        )}
      </div>

      {/* ═══════ 开场视频配置 ═══════ */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-300 border-b border-white/10 pb-2">
          🎬 互动页开场视频 — 进入互动页时先播放视频，播完才能进入
        </h3>
        <p className="text-xs text-gray-500">
          按时间段 + 成长等级配置。同一时间段不同等级可播放不同视频。无配置时直接进入互动页。
          时间重叠时按入库顺序优先（先添加的优先）。
        </p>

        {/* 隐藏的视频上传 input */}
        <input
          ref={introFileRef}
          type="file"
          accept="video/mp4,video/webm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !id) return;
            setIntroUploading(true);
            try {
              const fd = new FormData();
              fd.append('file', file);
              fd.append('pet_model_id', id);
              const res = await client.post('/admin/intro-videos/upload', fd, {
                timeout: 10 * 60 * 1000,
              });
              if (res.data?.success) {
                setIntroForm((f) => ({ ...f, video_url: res.data.url }));
                alert('视频上传成功');
              }
            } catch (err: any) {
              alert('上传失败: ' + (err?.response?.data?.error || err.message));
            } finally {
              setIntroUploading(false);
            }
          }}
          style={{ display: 'none' }}
        />

        {/* 新增/编辑表单 */}
        {showIntroForm && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-orange-300">
                {introEditId ? '编辑视频配置' : '新增视频配置'}
              </span>
              <button onClick={() => { setShowIntroForm(false); setIntroEditId(null); }} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="配置名称">
                <input value={introForm.name} onChange={(e) => setIntroForm({ ...introForm, name: e.target.value })}
                  className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm" placeholder="如：早晨问候" />
              </Field>
              <Field label="适用成长等级">
                <select value={introForm.growth_level} onChange={(e) => setIntroForm({ ...introForm, growth_level: Number(e.target.value) })}
                  className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm">
                  <option value={0}>通用（所有等级）</option>
                  <option value={1}>Lv.1</option>
                  <option value={2}>Lv.2</option>
                  <option value={3}>Lv.3</option>
                  <option value={4}>Lv.4</option>
                  <option value={5}>Lv.5</option>
                </select>
              </Field>
              <Field label="起始时间">
                <input type="time" value={introForm.time_start} onChange={(e) => setIntroForm({ ...introForm, time_start: e.target.value })}
                  className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm" />
              </Field>
              <Field label="截止时间">
                <input type="time" value={introForm.time_end} onChange={(e) => setIntroForm({ ...introForm, time_end: e.target.value })}
                  className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm" />
              </Field>
              <Field label="视频时长(秒)">
                <input type="number" value={introForm.duration_sec} onChange={(e) => setIntroForm({ ...introForm, duration_sec: Number(e.target.value) })}
                  className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm" min={1} max={120} />
              </Field>
              <Field label="视频文件">
                <div className="flex items-center gap-2">
                  {introForm.video_url ? (
                    <span className="text-xs text-green-400 truncate max-w-[120px]">已上传</span>
                  ) : (
                    <span className="text-xs text-gray-500">未上传</span>
                  )}
                  <button onClick={() => introFileRef.current?.click()} disabled={introUploading}
                    className="rounded bg-orange-500 px-3 py-1 text-xs text-white hover:bg-orange-600 disabled:opacity-50">
                    {introUploading ? '上传中...' : '上传 MP4'}
                  </button>
                </div>
              </Field>
            </div>
            {/* 视频预览 */}
            {introForm.video_url && (
              <div className="rounded-lg bg-black/30 p-2">
                <video src={introForm.video_url} className="w-full max-h-40 rounded" controls />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowIntroForm(false); setIntroEditId(null); }}
                className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-slate-600">取消</button>
              <button onClick={async () => {
                if (!introForm.video_url) { alert('请先上传视频文件'); return; }
                if (!introForm.time_start || !introForm.time_end) { alert('请设置时间段'); return; }
                try {
                  if (introEditId) {
                    await client.put(`/admin/intro-videos/${introEditId}`, {
                      ...introForm, pet_model_id: Number(id),
                    });
                  } else {
                    await client.post('/admin/intro-videos', {
                      ...introForm, pet_model_id: Number(id),
                    });
                  }
                  setShowIntroForm(false);
                  setIntroEditId(null);
                  setIntroForm({ name: '', time_start: '08:00', time_end: '12:00', growth_level: 0, video_url: '', duration_sec: 30 });
                  await loadIntroVideos();
                } catch (err: any) {
                  alert('保存失败: ' + (err?.response?.data?.error || err.message));
                }
              }}
                className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm text-white hover:bg-orange-600">
                {introEditId ? '更新' : '添加'}
              </button>
            </div>
          </div>
        )}

        {/* 新增按钮 */}
        {!showIntroForm && (
          <button
            onClick={() => {
              setIntroForm({ name: '', time_start: '08:00', time_end: '12:00', growth_level: 0, video_url: '', duration_sec: 30 });
              setIntroEditId(null);
              setShowIntroForm(true);
            }}
            className="rounded-lg border border-dashed border-orange-500/40 px-4 py-2 text-sm text-orange-300 hover:bg-orange-500/10 transition w-full"
          >
            + 新增开场视频配置
          </button>
        )}

        {/* 按时间段分组展示 */}
        {introLoading ? (
          <div className="text-xs text-gray-500 py-4 text-center">加载中...</div>
        ) : introVideos.length === 0 ? (
          <div className="text-xs text-gray-500 py-4 text-center">暂无开场视频配置，互动页将直接进入</div>
        ) : (
          (() => {
            // 按时间段分组
            const groups: Record<string, IntroVideo[]> = {};
            for (const v of introVideos) {
              const key = `${v.time_start.slice(0,5)}~${v.time_end.slice(0,5)}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push(v);
            }
            return Object.entries(groups).map(([slot, videos]) => (
              <div key={slot} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">🕐 {slot}</span>
                  <span className="text-xs text-gray-500">({videos.length} 个配置)</span>
                </div>
                <div className="space-y-1.5">
                  {videos.sort((a, b) => a.growth_level - b.growth_level).map((v) => (
                    <div key={v.id} className="flex items-center gap-3 rounded bg-white/5 px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        v.growth_level === 0
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-green-500/20 text-green-300'
                      }`}>{v.growth_level === 0 ? '通用' : `Lv.${v.growth_level}`}</span>
                      <span className="text-xs text-gray-300 truncate flex-1">{v.name || v.video_url.split('/').pop()}</span>
                      <span className="text-xs text-gray-500">{v.duration_sec}s</span>
                      {!v.is_active && <span className="text-xs text-red-400">停用</span>}
                      {/* 预览 */}
                      <button onClick={() => {
                        const w = window.open('', '_blank', 'width=400,height=300');
                        if (w) { w.document.write(`<video src="${v.video_url}" autoplay controls style="width:100%;height:100%;background:#000"></video>`); w.document.title = v.name || '预览'; }
                      }} className="text-xs text-blue-400 hover:text-blue-300">预览</button>
                      {/* 编辑 */}
                      <button onClick={() => {
                        setIntroEditId(v.id);
                        setIntroForm({
                          name: v.name,
                          time_start: v.time_start.slice(0,5),
                          time_end: v.time_end.slice(0,5),
                          growth_level: v.growth_level,
                          video_url: v.video_url,
                          duration_sec: v.duration_sec,
                        });
                        setShowIntroForm(true);
                      }} className="text-xs text-orange-400 hover:text-orange-300">编辑</button>
                      {/* 启用/停用 */}
                      <button onClick={async () => {
                        try {
                          await client.put(`/admin/intro-videos/${v.id}`, { is_active: !v.is_active });
                          await loadIntroVideos();
                        } catch (err: any) { alert('操作失败: ' + (err?.response?.data?.error || err.message)); }
                      }} className={`text-xs ${v.is_active ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'}`}>
                        {v.is_active ? '停用' : '启用'}
                      </button>
                      {/* 删除 */}
                      <button onClick={async () => {
                        if (!confirm(`删除配置「${v.name || v.id}」？视频文件将保留在服务器上。`)) return;
                        try {
                          await client.delete(`/admin/intro-videos/${v.id}`);
                          await loadIntroVideos();
                        } catch (err: any) { alert('删除失败: ' + (err?.response?.data?.error || err.message)); }
                      }} className="text-xs text-red-400 hover:text-red-300">删除</button>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate('/admin/companions')}
          className="rounded-lg bg-slate-700 px-5 py-2 text-sm text-gray-300 hover:bg-slate-600"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-purple-500 px-6 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存所有改动'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
