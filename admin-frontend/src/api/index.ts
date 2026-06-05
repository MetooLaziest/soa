// Admin 前端 API 层
const API_BASE = '/api';

// ==================== RAG 知识库 API ====================

// 获取 RAG 知识库列表
export async function getRAGKnowledgeBases() {
  const res = await fetch(`${API_BASE}/admin/rag-kbs`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  return res.json();
}

// 获取单个 RAG 知识库详情
export async function getRAGKnowledgeBase(id: string) {
  const res = await fetch(`${API_BASE}/admin/rag-kbs/${id}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  return res.json();
}

// 创建 RAG 知识库
export async function createRAGKnowledgeBase(data: { name: string; description: string; content: string }) {
  const res = await fetch(`${API_BASE}/admin/rag-kbs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

// 更新 RAG 知识库
export async function updateRAGKnowledgeBase(id: string, data: { name: string; description: string; content: string }) {
  const res = await fetch(`${API_BASE}/admin/rag-kbs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

// 删除 RAG 知识库
export async function deleteRAGKnowledgeBase(id: string) {
  const res = await fetch(`${API_BASE}/admin/rag-kbs/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  return res.json();
}

// 获取宠物关联的 RAG 知识库
export async function getPetRAGs(companionId: string) {
  const res = await fetch(`${API_BASE}/admin/rag-kbs/companion/${companionId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  return res.json();
}

// 为宠物关联 RAG 知识库
export async function addPetRAG(companionId: string, ragKbId: string) {
  const res = await fetch(`${API_BASE}/admin/rag-kbs/companion/${companionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ rag_kb_id: ragKbId }),
  });
  return res.json();
}

// 取消宠物与 RAG 知识库的关联
export async function removePetRAG(companionId: string, ragKbId: string) {
  const res = await fetch(`${API_BASE}/admin/rag-kbs/companion/${companionId}/${ragKbId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  return res.json();
}

// ==================== 宠物型号 API ====================

// 获取宠物型号列表（含 temperature）
export async function getCompanions() {
  const res = await fetch(`${API_BASE}/admin/companions`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  return res.json();
}

// 更新宠物型号（含 temperature 和 RAG 关联）
export async function updateCompanion(id: string, data: any) {
  const res = await fetch(`${API_BASE}/admin/companions/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}
