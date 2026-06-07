/**
 * 宠物人设编辑器 - 4层提示词编辑
 * 路径: /admin/companions/:id/edit
 * L1 身份 / L2 性格 / L3 准则 / L4 知识库策略
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import client from '../../api/client';

const LAYER_NAMES = ['L1 身份定义', 'L2 性格特征', 'L3 行为准则', 'L4 知识库策略'];
const LAYER_HINTS = [
  '定义宠物是谁、来自哪里、基本身份设定',
  '定义宠物的性格特点、行为风格、语气偏好',
  '定义宠物的行为规范、禁忌、原则',
  '描述何时、如何检索知识库（下方已选知识库会自动关联）'
];

export default function CompanionEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname.endsWith('/companions/new');

  const [pet, setPet] = useState<any>(null);
  const [ragList, setRagList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testResp, setTestResp] = useState('');
  const [testing, setTesting] = useState(false);

  // 4层提示词
  const [layers, setLayers] = useState<string[]>(['', '', '', '']);
  const [selectedRags, setSelectedRags] = useState<number[]>([]);
  const [temperature, setTemperature] = useState(0.3);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // 加载 RAG 列表
      try {
        const ragRes = await client.get('/admin/rag-kbs');
        if (ragRes.data?.data) setRagList(ragRes.data.data);
        else if (Array.isArray(ragRes.data)) setRagList(ragRes.data);
      } catch (e) { console.error('RAG列表加载失败', e); }

      if (!id || isNew) { setLoading(false); return; }

      // 加载宠物数据
      const res = await client.get(`/admin/pets/${id}`);
      if (res.data?.success && res.data.pet) {
        const p = res.data.pet;
        setPet(p);
        setSelectedRags(p.rag_kb_ids || []);
        setTemperature(p.model_temperature ?? 0.3);

        // 解析 system_prompt 中的 4 层
        const prompt = p.system_prompt || '';
        const parsed = parseLayers(prompt);
        setLayers(parsed);
      }
    } catch (err) {
      console.error('加载失败', err);
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const parseLayers = (prompt: string): string[] => {
    const layers = ['', '', '', ''];
    if (!prompt) return layers;
    const names = ['身份', '性格', '准则', '知识'];
    names.forEach((name, i) => {
      const start = prompt.indexOf(`【${name}`);
      if (start !== -1) {
        const end = prompt.indexOf('】', start);
        if (end !== -1) layers[i] = prompt.substring(start + 3 + name.length + 1, end).trim();
      }
    });
    return layers;
  };

  const mergeLayers = (texts: string[]): string => {
    const names = ['身份', '性格', '准则', '知识'];
    return texts
      .map((t, i) => t ? `【${names[i]}】${t}` : '')
      .filter(Boolean)
      .join('\n\n');
  };

  const handleSave = async () => {
    if (!layers[0].trim()) { alert('L1 身份定义不能为空'); return; }
    setSaving(true);
    setError('');
    try {
      await client.put(`/admin/pets/${id}`, {
        system_prompt: mergeLayers(layers),
        rag_kb_ids: selectedRags
      });
      alert('保存成功');
      navigate('/admin/pets');
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestChat = async () => {
    if (!testMsg.trim()) return;
    setTesting(true);
    setTestResp('');
    try {
      const res = await client.post(`/epet/${id}/chat`, { message: testMsg });
      setTestResp(res.data?.reply || res.data?.message || '无响应');
    } catch (err: any) {
      setTestResp('请求失败: ' + (err?.message || '未知错误'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center text-gray-400">加载中...</div>
  );

  if (isNew) return (
    <div className="flex h-64 items-center justify-center text-gray-400">
      新建宠物请通过宠物实体页面创建
    </div>
  );

  if (!pet) return (
    <div className="flex h-64 items-center justify-center text-red-400">宠物不存在</div>
  );

  return (
    <div className="space-y-5">
      {/* 页面头部 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/pets')}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-slate-600"
        >
          ← 返回
        </button>
        <div>
          <h2 className="text-base font-semibold text-white">
            {isNew ? '新建宠物' : `编辑 ${pet.display_name || pet.nfc} 的人设`}
          </h2>
          <p className="text-xs text-gray-500">
            NFC: {pet.nfc} · {pet.model_name || `型号${pet.model_id}`} · L1-L4，L5状态由系统动态注入
          </p>
        </div>
      </div>

      {/* 4层提示词编辑器 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
        <h3 className="text-sm font-medium text-gray-300 border-b border-white/10 pb-2">
          提示词配置（L1-L4 · L5 实时状态系统动态注入）
        </h3>

        {LAYER_NAMES.map((name, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-medium text-purple-300">{name}</span>
              {idx === 3 && selectedRags.length > 0 && (
                <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                  ✓ {selectedRags.length} 个知识库
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-2">{LAYER_HINTS[idx]}</p>
            <textarea
              value={layers[idx]}
              onChange={e => {
                const n = [...layers]; n[idx] = e.target.value; setLayers(n);
              }}
              rows={idx === 3 ? 3 : 4}
              className="form-input font-mono text-xs resize-y"
              placeholder={`请输入 ${name} 内容...`}
            />
          </div>
        ))}

        {/* RAG 知识库 */}
        <div className="border-t border-white/10 pt-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">关联知识库（RAG）</h4>
          {ragList.length === 0 ? (
            <p className="text-xs text-gray-500">暂无知识库，请先去「RAG 知识库管理」创建</p>
          ) : (
            <div className="space-y-2">
              {ragList.map(rag => (
                <label key={rag.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRags.includes(rag.id)}
                    onChange={() => {
                      setSelectedRags(prev =>
                        prev.includes(rag.id) ? prev.filter(x => x !== rag.id) : [...prev, rag.id]
                      );
                    }}
                    className="mt-0.5 accent-purple-500"
                  />
                  <div>
                    <span className="text-sm text-white">{rag.name}</span>
                    {rag.description && (
                      <span className="ml-2 text-xs text-gray-500">{rag.description}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Temperature */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-300 whitespace-nowrap">AI Temperature</span>
          <input
            type="range" min="0" max="1" step="0.1"
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
            className="flex-1 accent-purple-500"
          />
          <span className="text-xs text-gray-400 font-mono w-32">
            {temperature} — {temperature <= 0.3 ? '稳定' : temperature <= 0.7 ? '平衡' : '随机'}
          </span>
          <span className="text-xs text-gray-600 w-28">
            参考型号设置
          </span>
        </div>
      </div>

      {/* 对话测试 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <h4 className="text-sm font-medium text-gray-300">对话测试</h4>
        <div className="flex gap-2">
          <input
            value={testMsg}
            onChange={e => setTestMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTestChat()}
            className="form-input text-sm"
            placeholder="输入测试消息，按回车发送..."
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
          <div className="rounded-lg bg-white/5 p-3 text-sm text-gray-300 whitespace-pre-wrap min-h-[40px]">
            {testResp}
          </div>
        )}
      </div>

      {/* 错误 & 保存 */}
      {error && <div className="rounded-lg bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-400">{error}</div>}

      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate('/admin/pets')}
          className="rounded-lg bg-slate-700 px-5 py-2 text-sm text-gray-300 hover:bg-slate-600"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-purple-500 px-6 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
