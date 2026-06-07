import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface RAGKnowledgeBase {
  id: number;
  name: string;
  description: string;
}

interface PetData {
  nfc: string;
  display_name: string;
  monster_type: string;
  model_id: number;
  model_name: string;
  system_prompt: string | null;
  temperature: number;
  rag_kb_ids: number[];
}

const LAYER_NAMES = [
  'L1 身份定义',
  'L2 性格特征',
  'L3 行为准则',
  'L4 知识库 (RAG)'
];
const LAYER_DESCRIPTIONS = [
  '定义宠物是谁、来自哪里、基本身份设定',
  '定义宠物的性格特点、行为风格',
  '定义宠物的行为规范、禁忌、原则',
  '定义何时、如何检索知识库（下方已选知识库会自动关联）'
];

const CompanionEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pet, setPet] = useState<PetData>({
    nfc: '',
    display_name: '',
    monster_type: '',
    model_id: 0,
    model_name: '',
    system_prompt: '',
    temperature: 0.3,
    rag_kb_ids: []
  });
  const [ragList, setRagList] = useState<RAGKnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 对话测试
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testing, setTesting] = useState(false);

  // 提示词分层（L1-L4，L5 动态生成）
  const [layers, setLayers] = useState<string[]>(['', '', '', '']);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // 加载 RAG 列表
      try {
        const ragRes = await fetch('/api/admin/rag-kbs');
        if (ragRes.ok) {
          const ragData = await ragRes.json();
          setRagList(ragData.data || ragData || []);
        }
      } catch (err) {
        console.error('Error loading RAG list:', err);
      }

      if (!id || id === 'new') {
        setLoading(false);
        return;
      }

      // 加载宠物实体数据（通过 admin pets API）
      const res = await fetch(`/api/admin/pets/${id}`);
      const data = await res.json();

      if (data.success && data.pet) {
        const p = data.pet;
        setPet({
          nfc: p.nfc,
          display_name: p.display_name || '',
          monster_type: p.monster_type || '',
          model_id: p.model_id,
          model_name: p.model_name || '',
          system_prompt: p.system_prompt || '',
          temperature: p.temperature || 0.3,
          rag_kb_ids: p.rag_kb_ids || []
        });

        // 解析 system_prompt 中的 4 层
        const prompt = p.system_prompt || '';
        const layerTexts = parsePromptLayers(prompt);
        setLayers(layerTexts);
      }
    } catch (err) {
      console.error('Error loading pet:', err);
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 解析 4 层提示词（从 system_prompt 中提取）
  const parsePromptLayers = (prompt: string): string[] => {
    const layers = ['', '', '', ''];
    if (!prompt) return layers;
    const layerNames = ['身份', '性格', '准则', '知识'];
    for (let i = 0; i < 4; i++) {
      const startTag = `【${layerNames[i]}`;
      const startIdx = prompt.indexOf(startTag);
      if (startIdx !== -1) {
        const endIdx = prompt.indexOf('】', startIdx);
        if (endIdx !== -1) {
          layers[i] = prompt.substring(startIdx + 3, endIdx).trim();
        }
      }
    }
    return layers;
  };

  // 合并 4 层为完整提示词
  const mergePromptLayers = (layerTexts: string[]): string => {
    const layerNames = ['身份', '性格', '准则', '知识'];
    return layerTexts
      .map((text, i) => `【${layerNames[i]}】${text}`)
      .filter(t => t.includes('】'))
      .join('\n\n');
  };

  const handleLayerChange = (index: number, value: string) => {
    const newLayers = [...layers];
    newLayers[index] = value;
    setLayers(newLayers);
  };

  const handleRAGToggle = (ragId: number) => {
    const newIds = pet.rag_kb_ids.includes(ragId)
      ? pet.rag_kb_ids.filter(i => i !== ragId)
      : [...pet.rag_kb_ids, ragId];
    setPet({ ...pet, rag_kb_ids: newIds });
  };

  const handleSave = async () => {
    if (!layers[0].trim()) {
      alert('请填写 L1 身份定义');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const systemPrompt = mergePromptLayers(layers);
      const payload = {
        system_prompt: systemPrompt,
        temperature: pet.temperature,
        rag_kb_ids: pet.rag_kb_ids
      };

      const res = await fetch(`/api/admin/pets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert('保存成功！');
      navigate('/companions');
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestChat = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResponse('');
    try {
      const res = await fetch(`/api/epet/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage })
      });
      const data = await res.json();
      setTestResponse(data.reply || data.error || '无响应');
    } catch (err: any) {
      setTestResponse('请求失败: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>加载中...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/companions')}
          style={{ marginRight: '12px', padding: '4px 12px', backgroundColor: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' }}
        >
          ← 返回
        </button>
        <h2 style={{ margin: 0 }}>编辑宠物模板</h2>
        <span style={{ marginLeft: '12px', color: '#666', fontSize: '13px' }}>
          {pet.nfc} · {pet.model_name || `型号${pet.model_id}`}
        </span>
      </div>

      {/* 宠物基本信息（只读参考） */}
      <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#666' }}>
        <strong>宠物信息：</strong> NFC={pet.nfc} | 昵称={pet.display_name || '未命名'} | 型号={pet.model_name || `ID:${pet.model_id}`}
        <br />
        <span style={{ fontSize: '12px', color: '#999' }}>
          提示词保存在宠物实体（nfc={pet.nfc}）的 system_prompt 字段，优先于型号模板使用
        </span>
      </div>

      {/* 提示词分层编辑器 */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>提示词配置（L1-L4，L5 实时状态由系统动态注入）</h3>

        {LAYER_NAMES.map((name, idx) => (
          <div key={idx} style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px' }}>
              {name}
              {idx === 3 && pet.rag_kb_ids.length > 0 && (
                <span style={{ fontWeight: 'normal', color: '#52c41a', fontSize: '12px', marginLeft: '8px' }}>
                  ✓ 已选 {pet.rag_kb_ids.length} 个知识库
                </span>
              )}
            </label>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#999' }}>{LAYER_DESCRIPTIONS[idx]}</p>
            <textarea
              value={layers[idx]}
              onChange={(e) => handleLayerChange(idx, e.target.value)}
              rows={idx === 3 ? 3 : 4}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
              placeholder={`请输入 ${name} 内容...`}
            />
          </div>
        ))}

        {/* RAG 知识库选择 */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>关联知识库（RAG）</h4>
          {ragList.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#999' }}>暂无知识库，请先去「RAG 知识库管理」创建</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ragList.map(rag => (
                <label key={rag.id} style={{ display: 'flex', alignItems: 'flex-start', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pet.rag_kb_ids.includes(rag.id)}
                    onChange={() => handleRAGToggle(rag.id)}
                    style={{ marginTop: '2px', marginRight: '8px' }}
                  />
                  <div>
                    <strong>{rag.name}</strong>
                    <div style={{ color: '#999', fontSize: '12px' }}>{rag.description}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Temperature 配置 */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>AI 参数</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ fontWeight: 500 }}>Temperature: {pet.temperature}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={pet.temperature}
            onChange={(e) => setPet({ ...pet, temperature: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '12px', color: '#999', minWidth: '120px' }}>
            0.3=稳定 | 0.7=创造 | 1.0=随机
          </span>
        </div>
      </div>

      {/* 对话测试 */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>对话测试</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTestChat()}
            placeholder="输入测试消息..."
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
          />
          <button
            onClick={handleTestChat}
            disabled={testing}
            style={{ padding: '8px 16px', backgroundColor: testing ? '#d9d9d9' : '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: testing ? 'not-allowed' : 'pointer' }}
          >
            {testing ? '测试中...' : '发送'}
          </button>
        </div>
        {testResponse && (
          <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '13px', whiteSpace: 'pre-wrap', minHeight: '40px' }}>
            {testResponse}
          </div>
        )}
      </div>

      {error && <div style={{ color: 'red', marginBottom: '12px' }}>错误: {error}</div>}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => navigate('/companions')}
          style={{ padding: '8px 20px', border: '1px solid #d9d9d9', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer' }}
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '8px 20px', backgroundColor: saving ? '#d9d9d9' : '#52c41a', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
};

export default CompanionEdit;