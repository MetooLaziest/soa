import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/companions', label: '宠物模板管理', icon: '🐾' },
    { path: '/pets', label: '宠物实体管理', icon: '🐶' },
    { path: '/rag', label: 'RAG 知识库管理', icon: '📚' },
  ];

  console.log('🚀 Admin Frontend v2.0 - Layout component loaded');

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* 左侧菜单 */}
      <div style={{
        width: '200px',
        backgroundColor: '#001529',
        color: 'white',
        padding: '16px 0',
      }}>
        <div style={{
          padding: '0 16px 20px',
          borderBottom: '1px solid #003a70',
          marginBottom: '16px',
          fontSize: '18px',
          fontWeight: 'bold',
        }}>
          IoT 管理后台 v2.0
        </div>

        <nav>
          {menuItems.map(item => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  color: isActive ? '#1890ff' : 'rgba(255,255,255,0.65)',
                  backgroundColor: isActive ? '#003a70' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                  }
                }}
              >
                <span style={{ marginRight: '8px' }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 右侧内容区 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#f0f2f5',
      }}>
        <div style={{ padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
