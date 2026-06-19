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
    } catch (err) {
      console.error('加载失败', err);
      setError('加载失败: ' + (err as any).message);
    } finally {
      setLoading(false);
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
      {/* 隐藏的 file input */}
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
