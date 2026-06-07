/**
 * 机伴模型完整表单 - 用于新增/编辑
 * 包含所有 12 个字段：型号名称、型号代码、人格描述、契约者设定、
 * 初始化剧情节点、语音播报音色、关键立绘、知识范围、初始属性、
 * 口头禅、System Prompt 模板、初始道具
 */
import { useState } from 'react';

interface CompanionFormProps {
  initialData?: Record<string, any>;
  onSave: (data: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

interface FormData {
  name: string;
  model_code: string;
  description: string;
  contractor_setting: string;
  initial_node_id: string;
  voice_id: string;
  avatar_asset_id: string;
  knowledge_scope: string;
  initial_items: string;
  mbti_E: number;
  mbti_I: number;
  mbti_S: number;
  mbti_T: number;
  catchphrases: string;
  system_prompt_template: string;
}

const empty = (): FormData => ({
  name: '',
  model_code: '',
  description: '',
  contractor_setting: '',
  initial_node_id: '',
  voice_id: '',
  avatar_asset_id: '',
  knowledge_scope: '',
  initial_items: '',
  mbti_E: 50,
  mbti_I: 50,
  mbti_S: 50,
  mbti_T: 50,
  catchphrases: '',
  system_prompt_template: '',
});

function parseMbti(raw: any): Partial<Record<string, number>> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return {}; }
  }
  return raw as Record<string, number>;
}

export function CompanionForm({ initialData, onSave, onCancel }: CompanionFormProps) {
  const [form, setForm] = useState<FormData>(() => {
    if (!initialData) return empty();
    const mbti = parseMbti(initialData.mbti_base);
    return {
      name: initialData.name || '',
      model_code: initialData.model_code || '',
      description: initialData.description || '',
      contractor_setting: initialData.contractor_setting || '',
      initial_node_id: initialData.initial_node_id || '',
      voice_id: initialData.voice_id || '',
      avatar_asset_id: initialData.avatar_asset_id || '',
      knowledge_scope: Array.isArray(initialData.knowledge_scope) ? initialData.knowledge_scope.join(', ') : (initialData.knowledge_scope || ''),
      initial_items: Array.isArray(initialData.initial_items) ? initialData.initial_items.join(', ') : (initialData.initial_items || ''),
      mbti_E: mbti['E'] ?? 50,
      mbti_I: mbti['I'] ?? 50,
      mbti_S: mbti['S'] ?? 50,
      mbti_T: mbti['T'] ?? 50,
      catchphrases: Array.isArray(initialData.catchphrases) ? initialData.catchphrases.join(', ') : (initialData.catchphrases || ''),
      system_prompt_template: initialData.system_prompt_template || '',
    };
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormData, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) return alert('型号名称必填');
    if (!form.model_code.trim()) return alert('型号代码必填');
    setSaving(true);
    try {
      const knowledgeArr = form.knowledge_scope.split(',').map(s => s.trim()).filter(Boolean);
      const itemsArr = form.initial_items.split(',').map(s => s.trim()).filter(Boolean);
      const catchphrasesArr = form.catchphrases.split(',').map(s => s.trim()).filter(Boolean);
      await onSave({
        name: form.name.trim(),
        model_code: form.model_code.trim(),
        description: form.description.trim(),
        contractor_setting: form.contractor_setting.trim(),
        initial_node_id: form.initial_node_id.trim() || null,
        voice_id: form.voice_id.trim(),
        avatar_asset_id: form.avatar_asset_id.trim() || null,
        knowledge_scope: knowledgeArr.length ? knowledgeArr : null,
        initial_items: itemsArr.length ? itemsArr : null,
        mbti_base: JSON.stringify({ E: form.mbti_E, I: form.mbti_I, S: form.mbti_S, T: form.mbti_T }),
        catchphrases: catchphrasesArr.length ? catchphrasesArr : null,
        system_prompt_template: form.system_prompt_template.trim(),
      });
    } catch (e: any) {
      alert(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const MbtiBar = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center gap-2">
      <span className="w-4 text-xs text-gray-400">{label}</span>
      <input
        type="range" min="0" max="100" value={value}
        onChange={e => set(label as keyof FormData, parseInt(e.target.value))}
        className="flex-1 accent-purple-500"
      />
      <span className="w-8 text-right text-xs text-white font-mono">{value}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 第一行：名称 + 代码 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="型号名称" required>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            className="form-input" placeholder="如：艾瑟拉" />
        </Field>
        <Field label="型号代码" required>
          <input value={form.model_code} onChange={e => set('model_code', e.target.value)}
            className="form-input" placeholder="如：AISELA-001" />
        </Field>
      </div>

      {/* 人格描述 */}
      <Field label="人格描述" hint="机伴的人格设定和规则，是聊天 sysprompt 的核心素材">
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          className="form-input min-h-[80px]" placeholder="描述机伴的性格、行为规范、情绪反应规则..." />
      </Field>

      {/* 契约者设定 */}
      <Field label="契约者设定" hint="用户对机伴的初始化角色定义">
        <textarea value={form.contractor_setting} onChange={e => set('contractor_setting', e.target.value)}
          className="form-input min-h-[80px]" placeholder="描述用户在此机伴故事中的身份与角色..." />
      </Field>

      {/* 初始化剧情节点 */}
      <Field label="初始化剧情节点 ID" hint="决定对话/剧情管理的起点，填入 story_nodes 表的 UUID">
        <input value={form.initial_node_id} onChange={e => set('initial_node_id', e.target.value)}
          className="form-input font-mono text-xs" placeholder="UUID，不填则使用默认起点" />
      </Field>

      {/* 语音 + 立绘 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="语音播报音色" hint="控制 TTS 声音，如 azure_zh_female">
          <input value={form.voice_id} onChange={e => set('voice_id', e.target.value)}
            className="form-input" placeholder="如：azure_zh_female" />
        </Field>
        <Field label="关键立绘（资源ID）" hint="控制首页展示图像的资源 UUID">
          <input value={form.avatar_asset_id} onChange={e => set('avatar_asset_id', e.target.value)}
            className="form-input font-mono text-xs" placeholder="留空使用默认形象" />
        </Field>
      </div>

      {/* 知识范围 */}
      <Field label="知识范围" hint="用逗号分隔，可选：心理辅导、教学、IOT控制、联网查询、骂人、科学思考">
        <input value={form.knowledge_scope} onChange={e => set('knowledge_scope', e.target.value)}
          className="form-input" placeholder="心理辅导, 教学, IOT控制, 联网查询, 科学思考" />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {['心理辅导', '教学', 'IOT控制', '联网查询', '骂人', '科学思考', '闲聊', '百科'].map(k => (
            <button key={k} type="button"
              onClick={() => {
                const tags = form.knowledge_scope.split(',').map(s => s.trim()).filter(Boolean);
                if (!tags.includes(k)) set('knowledge_scope', [...tags, k].join(', '));
              }}
              className="rounded-full border border-purple-500/40 px-2 py-0.5 text-xs text-purple-300 hover:bg-purple-500/20 transition">
              + {k}
            </button>
          ))}
        </div>
      </Field>

      {/* 初始属性 - MBTI */}
      <Field label="初始属性" hint="机伴的性格倾向评分，影响对话风格">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="mb-1 text-xs text-gray-500">MBTI 四维综合分数（0-100）</div>
          <MbtiBar label="mbti_E" value={form.mbti_E} />
          <div className="text-xs text-gray-500 ml-6">E外向 ←→ I内向</div>
          <MbtiBar label="mbti_I" value={form.mbti_I} />
          <div className="text-xs text-gray-500 ml-6">S实感 ←→ N直觉</div>
          <MbtiBar label="mbti_S" value={form.mbti_S} />
          <div className="text-xs text-gray-500 ml-6">T思考 ←→ F情感</div>
          <MbtiBar label="mbti_T" value={form.mbti_T} />
          <div className="text-xs text-gray-500 ml-6">J判断 ←→ P知觉</div>
        </div>
      </Field>

      {/* 口头禅 */}
      <Field label="口头禅" hint="逗号分隔，机伴在对话中可能随机引用">
        <input value={form.catchphrases} onChange={e => set('catchphrases', e.target.value)}
          className="form-input" placeholder="如：吾心有所感,契约者，你听到了吗？,此地颇有蹊跷" />
      </Field>

      {/* System Prompt 模板 */}
      <Field label="System Prompt 模板" hint={
        <span>可用变量：<code className="text-purple-300">{'{{name}}'}</code> 名称、<code className="text-purple-300">{'{{description}}'}</code> 人格描述、<code className="text-purple-300">{'{{contractor}}'}</code> 契约者设定、<code className="text-purple-300">{'{{mbti}}'}</code> MBTI、<code className="text-purple-300">{'{{knowledge}}'}</code> 知识范围、<code className="text-purple-300">{'{{catchphrase}}'}</code> 口头禅</span>
      }>
        <textarea value={form.system_prompt_template} onChange={e => set('system_prompt_template', e.target.value)}
          className="form-input min-h-[120px] font-mono text-xs"
          placeholder={"你是 {{name}}，{{description}}\n契约者设定：{{contractor}}\nMBTI：{{mbti}}\n知识范围：{{knowledge}}\n口头禅：{{catchphrase}}"} />
      </Field>

      {/* 初始道具 */}
      <Field label="初始道具" hint="逗号分隔，创建时自动赋予机伴的物品">
        <input value={form.initial_items} onChange={e => set('initial_items', e.target.value)}
          className="form-input" placeholder="如：探测仪, 记忆碎片, 能量水晶" />
      </Field>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="rounded-lg bg-slate-700 px-5 py-2 text-sm text-gray-300 hover:bg-slate-600">
          取消
        </button>
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg bg-purple-500 px-6 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50">
          {saving ? '保存中...' : '保存机伴'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        {required && <span className="text-red-400 text-xs">*</span>}
        {hint && <span className="text-xs text-gray-500 ml-1">— {hint}</span>}
      </div>
      {children}
    </div>
  );
}