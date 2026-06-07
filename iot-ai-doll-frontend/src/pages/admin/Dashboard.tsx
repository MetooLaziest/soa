/**
 * 管理后台 - 仪表盘
 */
export default function Dashboard() {
  return (
    <div className="p-6 animate-fade-in-up">
      <h2 className="mb-6 text-xl font-bold text-white">仪表盘</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '机伴总数', value: '12', icon: '🐱', color: 'from-purple-600 to-purple-400' },
          { label: '活跃用户', value: '48', icon: '👥', color: 'from-cyan-600 to-cyan-400' },
          { label: '剧情节点', value: '156', icon: '📖', color: 'from-green-600 to-green-400' },
          { label: '道具数量', value: '52', icon: '🎒', color: 'from-orange-600 to-orange-400' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-card p-5">
            <div className="mb-2 text-2xl">{card.icon}</div>
            <div className={`text-3xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
              {card.value}
            </div>
            <div className="mt-1 text-sm text-gray-400">{card.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-white/10 bg-card p-6">
        <h3 className="mb-3 font-semibold text-white">系统状态</h3>
        <p className="text-sm text-gray-400">后端服务运行正常 · 数据库连接正常 · AI 对话服务就绪</p>
      </div>
    </div>
  );
}
