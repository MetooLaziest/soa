/**
 * AI 资源与计费管理
 */
import { useState, useEffect } from 'react';
import client from '../../api/client';

interface UsageRecord {
  id: string;
  user_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  created_at: string;
}

interface UsageSummary {
  total_tokens: number;
  total_cost: number;
  total_requests: number;
  models: { model: string; count: number; tokens: number }[];
}

export default function AIResources() {
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recordsRes, summaryRes] = await Promise.all([
        client.get('/admin/ai-usage', { params: { range: dateRange } }),
        client.get('/admin/ai-usage/summary', { params: { range: dateRange } })
      ]);
      setRecords(recordsRes.data.records || []);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('加载 AI 用量数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">AI 资源与计费</h2>
        <div className="flex gap-2">
          {(['today', 'week', 'month', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                dateRange === range ? 'bg-purple-500 text-white' : 'bg-slate-700 text-gray-400'
              }`}
            >
              {range === 'today' ? '今日' : range === 'week' ? '本周' : range === 'month' ? '本月' : '全部'}
            </button>
          ))}
        </div>
      </div>

      {/* 统计卡片 */}
      {summary && (
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/10 bg-card p-4">
            <div className="text-2xl font-bold text-white">{summary.total_requests}</div>
            <div className="text-sm text-gray-500">请求次数</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-card p-4">
            <div className="text-2xl font-bold text-purple-400">{(summary.total_tokens / 1000).toFixed(1)}K</div>
            <div className="text-sm text-gray-500">总 Tokens</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-card p-4">
            <div className="text-2xl font-bold text-green-400">¥{summary.total_cost.toFixed(2)}</div>
            <div className="text-sm text-gray-500">总费用</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-card p-4">
            <div className="text-2xl font-bold text-yellow-400">{summary.models?.length || 0}</div>
            <div className="text-sm text-gray-500">使用模型数</div>
          </div>
        </div>
      )}

      {/* 模型分布 */}
      {summary?.models && summary.models.length > 0 && (
        <div className="mb-6 rounded-xl border border-white/10 bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-400">模型使用分布</h3>
          <div className="space-y-2">
            {summary.models.map(m => (
              <div key={m.model} className="flex items-center gap-3">
                <div className="w-32 truncate font-mono text-sm text-gray-300">{m.model}</div>
                <div className="flex-1">
                  <div className="h-2 w-full rounded-full bg-slate-700">
                    <div 
                      className="h-full rounded-full bg-purple-500" 
                      style={{ width: `${(m.tokens / summary.total_tokens) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-400">{(m.tokens / 1000).toFixed(1)}K tokens</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 使用记录 */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">用户</th>
              <th className="px-4 py-3">模型</th>
              <th className="px-4 py-3">输入 Tokens</th>
              <th className="px-4 py-3">输出 Tokens</th>
              <th className="px-4 py-3">总 Tokens</th>
              <th className="px-4 py-3">费用</th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => (
              <tr key={record.id} className="border-b border-white/5 transition hover:bg-white/5">
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(record.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{record.user_id.slice(0, 8)}...</td>
                <td className="px-4 py-3 font-mono text-xs text-purple-300">{record.model}</td>
                <td className="px-4 py-3 text-gray-300">{record.input_tokens}</td>
                <td className="px-4 py-3 text-gray-300">{record.output_tokens}</td>
                <td className="px-4 py-3 text-white">{record.total_tokens}</td>
                <td className="px-4 py-3 text-green-400">¥{record.cost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {records.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">暂无使用记录</div>
      )}
    </div>
  );
}
