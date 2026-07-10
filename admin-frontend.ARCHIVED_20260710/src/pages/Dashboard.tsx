import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const menuItems = [
    { path: '/companions', label: '宠物模板管理', icon: '🐾', desc: '管理宠物型号、性格模板' },
    { path: '/pets', label: '宠物实体管理', icon: '🐶', desc: '查看用户宠物实例' },
    { path: '/rag', label: 'RAG 知识库管理', icon: '📚', desc: '管理知识库和文档' },
    { path: '/settings/home-mode', label: '首页展示设置', icon: '⚙️', desc: '配置 epet 首页展示模式' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>管理后台 Dashboard</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        欢迎使用 IoT AI Doll 管理后台，请选择以下功能模块
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              display: 'block',
              padding: 24,
              background: '#fff',
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              textDecoration: 'none',
              color: '#333',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 14, color: '#666' }}>{item.desc}</div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 32, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>快捷链接</h3>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <a href="/epet/" target="_blank" rel="noopener noreferrer">
              🎮 打开 Epet 前台
            </a>
          </li>
          <li>
            <a href="/admin/settings/home-mode">
              ⚙️ 首页展示设置（新功能）
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
