/**
 * 量产波段管理 - 工厂烧录 + QC + 上市触发
 * 路径: /admin/waves
 *
 * 业务流程:
 *   factory_burned (工厂烧录中, N 个 pet_instance 已预生成)
 *      ↓  QC 通过 (手动, 视情况)
 *   in_qc
 *      ↓  admin 点击「上市」按钮
 *   published    ← C 端扫码可激活
 *      ↓  用户激活
 *   claimed
 *      ↓  admin 归档
 *   archived
 *
 * 数据源: /api/admin/waves (admin-waves.js)
 *
 * 主要功能:
 * - 列出全部波段 + 4 状态实时计数
 * - 创建波段 (选型号 + 批次号 + 数量 + NFC 起始号)
 * - 下载激活码 CSV (工厂烧录用, 含完整 claim URL)
 * - 上传工厂回灌 CSV (nfc_burned_at/batch/device)
 * - 单波段「上市」「归档」操作
 * - 单实例「重发激活码」
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

const CLAIM_URL_BASE =
  (import.meta.env.VITE_CLAIM_URL_BASE as string) ||
  'https://soa.laziestlife.com/epet/?code=';

interface PetModel {
  id: number;
  name: string;
  description?: string;
  image_url: string;
  rarity: string;
  nfc_range_start: number | string;
  nfc_range_end: number | string;
}

interface Wave {
  id: number;
  pet_model_id: number;
  batch_code: string;
  total_count: number;
  status: 'factory_burned' | 'in_qc' | 'published' | 'archived';
  factory_burned_count: number;
  in_qc_count: number;
  published_count: number;
  claimed_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  launched_at: string | null;
  archived_at: string | null;
  model_name: string;
  model_image: string;
  model_rarity: string;
}

interface SampleInstance {
  id: number;
  nfc_id: number | string;
  activation_code: string;
  status: string;
  nfc_burned_at: string | null;
  nfc_burn_device: string | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  factory_burned: { label: '工厂烧录中', color: 'bg-blue-500/20 text-blue-300', icon: '🏭' },
  in_qc:          { label: 'QC 检测中',   color: 'bg-yellow-500/20 text-yellow-300', icon: '🔍' },
  published:      { label: '已上市',     color: 'bg-green-500/20 text-green-300',   icon: '🚀' },
  archived:       { label: '已归档',     color: 'bg-slate-500/20 text-slate-400',    icon: '📦' },
};

export default function WavesAdmin() {
  const navigate = useNavigate();
  const [waves, setWaves] = useState<Wave[]>([]);
  const [models, setModels] = useState<PetModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<{ wave: Wave; samples: SampleInstance[] } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // ── 拉取波段列表 + 型号列表 ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wavesRes, petsRes] = await Promise.all([
        client.get('/admin/waves'),
        client.get('/admin/pets'),
      ]);
      setWaves(wavesRes.data.waves || []);
      // 拉所有 active models
      const allModels: PetModel[] = (petsRes.data.models || []).map((g: any) => g.model);
      setModels(allModels);
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── 上市 ──
  const handleLaunch = async (id: number) => {
    if (!confirm('确定要上市该波段? 上市后 C 端扫码即可激活, 不可撤销。')) return;
    setBusyId(id);
    try {
      const r = await client.post(`/admin/waves/${id}/launch`);
      alert(`✅ 上市成功, ${r.data.transitioned_count} 个实例已转为 unclaimed`);
      fetchAll();
    } catch (e: any) {
      alert('上市失败: ' + (e?.response?.data?.error || e.message));
    } finally {
      setBusyId(null);
    }
  };

  // ── 归档 ──
  const handleArchive = async (id: number) => {
    if (!confirm('确定归档该波段? 归档后无法再上市, 已激活的实例不受影响。')) return;
    setBusyId(id);
    try {
      await client.post(`/admin/waves/${id}/archive`);
      alert('✅ 已归档');
      fetchAll();
    } catch (e: any) {
      alert('归档失败: ' + (e?.response?.data?.error || e.message));
    } finally {
      setBusyId(null);
    }
  };

  // ── 详情 ──
  const openDetail = async (id: number) => {
    try {
      const r = await client.get(`/admin/waves/${id}`);
      setDetail({ wave: r.data.wave, samples: r.data.sample_instances });
    } catch (e: any) {
      alert('加载详情失败: ' + (e?.response?.data?.error || e.message));
    }
  };

  // ── 重发激活码 ──
  const handleRegenerate = async (waveId: number, instanceId: number) => {
    if (!confirm('确定要重新生成该实例的激活码? 旧码将立即失效。')) return;
    setBusyId(waveId);
    try {
      const r = await client.post(`/admin/waves/${waveId}/regenerate-code/${instanceId}`);
      alert(`✅ 新激活码: ${r.data.new_code}`);
      openDetail(waveId);
    } catch (e: any) {
      alert('重发失败: ' + (e?.response?.data?.error || e.message));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">📦 量产波段管理</h1>
          <p className="text-gray-400 text-sm">
            工厂烧录 → QC → 上市 → 用户激活; 每个波段绑定一个 pet_model, 上市前扫码不可激活
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition"
        >
          + 新建波段
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4">
          ❌ {error}
        </div>
      )}

      {/* Loading */}
      {loading && <div className="text-gray-400 text-center py-12">加载中...</div>}

      {/* 波段列表 */}
      {!loading && waves.length === 0 && (
        <div className="bg-slate-800/50 rounded-lg p-12 text-center text-gray-500">
          暂无波段, 点击右上角「+ 新建波段」创建第一个
        </div>
      )}

      <div className="space-y-3">
        {waves.map(w => {
          const st = STATUS_LABEL[w.status] || STATUS_LABEL.factory_burned;
          return (
            <div key={w.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-start gap-4">
                {/* 模型图 */}
                <img
                  src={w.model_image}
                  alt={w.model_name}
                  className="w-16 h-16 rounded-lg object-cover bg-slate-700"
                />
                {/* 主体 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-white font-semibold">{w.model_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${st.color}`}>
                      {st.icon} {st.label}
                    </span>
                    <span className="text-xs text-gray-500">#{w.id}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-gray-300">
                      批次: {w.batch_code}
                    </span>
                    <span className="text-xs text-gray-500">
                      稀有度: {w.model_rarity}
                    </span>
                  </div>

                  {/* 计数条 */}
                  <div className="flex items-center gap-4 text-sm mt-2 flex-wrap">
                    <span className="text-gray-400">
                      总数 <strong className="text-white">{w.total_count}</strong>
                    </span>
                    <span className="text-blue-300">
                      🏭 烧录 <strong>{w.factory_burned_count}</strong>
                    </span>
                    <span className="text-yellow-300">
                      🔍 QC <strong>{w.in_qc_count}</strong>
                    </span>
                    <span className="text-green-300">
                      🚀 待激活 <strong>{w.published_count}</strong>
                    </span>
                    <span className="text-purple-300">
                      💎 已认领 <strong>{w.claimed_count}</strong>
                    </span>
                  </div>

                  {w.notes && (
                    <div className="text-xs text-gray-500 mt-2">📝 {w.notes}</div>
                  )}

                  <div className="text-xs text-gray-600 mt-1">
                    创建 {new Date(w.created_at).toLocaleString('zh-CN')}
                    {w.launched_at && ` · 上市 ${new Date(w.launched_at).toLocaleString('zh-CN')}`}
                    {w.archived_at && ` · 归档 ${new Date(w.archived_at).toLocaleString('zh-CN')}`}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => openDetail(w.id)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition"
                  >
                    详情
                  </button>
                  <a
                    href={`/api/admin/waves/${w.id}/codes.csv`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition text-center"
                  >
                    📥 下载 CSV
                  </a>
                  {w.status === 'factory_burned' || w.status === 'in_qc' ? (
                    <button
                      onClick={() => handleLaunch(w.id)}
                      disabled={busyId === w.id}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition disabled:opacity-50"
                    >
                      🚀 上市
                    </button>
                  ) : null}
                  {w.status !== 'archived' ? (
                    <button
                      onClick={() => handleArchive(w.id)}
                      disabled={busyId === w.id}
                      className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded transition disabled:opacity-50"
                    >
                      归档
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 创建表单 Modal */}
      {showCreate && (
        <CreateWaveModal
          models={models}
          existingWaves={waves}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); fetchAll(); }}
        />
      )}

      {/* 详情 Modal */}
      {detail && (
        <DetailModal
          data={detail}
          busy={busyId === detail.wave.id}
          onClose={() => setDetail(null)}
          onRegenerate={(instanceId) => handleRegenerate(detail.wave.id, instanceId)}
        />
      )}
    </div>
  );
}

// ────────────────  Create Wave Modal  ────────────────
function CreateWaveModal({
  models, existingWaves, onClose, onSuccess,
}: {
  models: PetModel[];
  existingWaves: Wave[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [petModelId, setPetModelId] = useState<number | ''>('');
  const [batchCode, setBatchCode] = useState('');
  const [totalCount, setTotalCount] = useState<number>(48);
  const [nfcIdStart, setNfcIdStart] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 选型号后自动建议 nfc_range 末端 + 1 作为 nfcIdStart
  useEffect(() => {
    if (petModelId === '') return;
    const m = models.find(x => x.id === petModelId);
    if (!m) return;
    // 找一个未占用的起始: 优先用 range_end + 1, 否则用现存 wave 中 max nfc_id + 1
    const start = Number(m.nfc_range_end) + 1;
    setNfcIdStart(prev => prev === '' ? start : prev);
  }, [petModelId, models]);

  const submit = async () => {
    if (petModelId === '' || !batchCode || totalCount < 1 || nfcIdStart === '') {
      setError('请填写完整: 型号、批次号、数量、NFC 起始号');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await client.post('/admin/waves', {
        pet_model_id: petModelId,
        batch_code: batchCode,
        total_count: totalCount,
        nfc_id_start: nfcIdStart,
        notes: notes || null,
      });
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-lg w-full p-6 border border-slate-700">
        <h2 className="text-lg font-bold text-white mb-4">新建量产波段</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">宠物型号 *</label>
            <select
              value={petModelId}
              onChange={e => setPetModelId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">-- 选择型号 --</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  #{m.id} {m.name} ({m.rarity}, NFC {String(m.nfc_range_start)}~{String(m.nfc_range_end)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">批次号 * (唯一)</label>
            <input
              value={batchCode}
              onChange={e => setBatchCode(e.target.value)}
              placeholder="例: W-2026-07-W1"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-purple-500"
            />
            {existingWaves.some(w => w.batch_code === batchCode) && batchCode && (
              <div className="text-red-400 text-xs mt-1">⚠️ 批次号已存在</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">数量 * (1~500)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={totalCount}
                onChange={e => setTotalCount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">NFC 起始 ID *</label>
              <input
                type="number"
                value={nfcIdStart}
                onChange={e => setNfcIdStart(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="建议: range_end + 1"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">备注 (可选)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="例: 7/30 工厂首批, 8/12 切 dw.momotoy.fun 域名"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {nfcIdStart !== '' && totalCount > 0 && (
            <div className="bg-slate-900/50 rounded p-2 text-xs text-gray-400">
              将预生成 NFC 范围: <strong className="text-white">{nfcIdStart}</strong> ~ <strong className="text-white">{Number(nfcIdStart) + totalCount - 1}</strong>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded p-2 text-red-300 text-sm">❌ {error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition disabled:opacity-50"
          >
            {submitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────  Detail Modal  ────────────────
function DetailModal({
  data, busy, onClose, onRegenerate,
}: {
  data: { wave: Wave; samples: SampleInstance[] };
  busy: boolean;
  onClose: () => void;
  onRegenerate: (instanceId: number) => void;
}) {
  const { wave, samples } = data;
  const st = STATUS_LABEL[wave.status] || STATUS_LABEL.factory_burned;
  const claimUrl = (code: string) => `${CLAIM_URL_BASE}${code}`;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-3xl w-full p-6 border border-slate-700 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            {wave.model_name} · 批次 {wave.batch_code}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-0.5 rounded ${st.color}`}>
            {st.icon} {st.label}
          </span>
          <span className="text-sm text-gray-400">
            总 {wave.total_count} · 烧录 {wave.factory_burned_count} · QC {wave.in_qc_count} · 待激活 {wave.published_count} · 已认领 {wave.claimed_count}
          </span>
        </div>

        <h3 className="text-sm text-gray-400 mb-2">前 5 个实例 (sample)</h3>
        <div className="bg-slate-900/50 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-slate-700">
                <th className="px-3 py-2">NFC ID</th>
                <th className="px-3 py-2">激活码</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">烧录时间</th>
                <th className="px-3 py-2">认领 URL</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {samples.map(s => (
                <tr key={s.id} className="border-b border-slate-800">
                  <td className="px-3 py-2 text-white font-mono">{String(s.nfc_id)}</td>
                  <td className="px-3 py-2 text-white font-mono text-xs">{s.activation_code}</td>
                  <td className="px-3 py-2 text-gray-400">{s.status}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {s.nfc_burned_at ? new Date(s.nfc_burned_at).toLocaleString('zh-CN') : '-'}
                  </td>
                  <td className="px-3 py-2 text-blue-300 text-xs break-all">{claimUrl(s.activation_code)}</td>
                  <td className="px-3 py-2">
                    {s.status !== 'claimed' && (
                      <button
                        onClick={() => onRegenerate(s.id)}
                        disabled={busy}
                        className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50"
                      >
                        重发码
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          💡 完整 {wave.total_count} 条激活码请用右上角「📥 下载 CSV」导出
        </div>
      </div>
    </div>
  );
}
