// RAG 知识库管理 API
const API_BASE = '/api/admin';

export interface RAGKnowledgeBase {
  id: number;
  name: string;
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRAGDto {
  name: string;
  description: string;
  content: string;
}

export interface UpdateRAGDto {
  name?: string;
  description?: string;
  content?: string;
}

// 获取所有 RAG 知识库
export async function getRAGList(): Promise<RAGKnowledgeBase[]> {
  const res = await fetch(`${API_BASE}/rag-kbs`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 获取单个 RAG 知识库
export async function getRAGById(id: number): Promise<RAGKnowledgeBase> {
  const res = await fetch(`${API_BASE}/rag-kbs/${id}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 创建 RAG 知识库
export async function createRAG(dto: CreateRAGDto): Promise<RAGKnowledgeBase> {
  const res = await fetch(`${API_BASE}/rag-kbs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 更新 RAG 知识库
export async function updateRAG(id: number, dto: UpdateRAGDto): Promise<RAGKnowledgeBase> {
  const res = await fetch(`${API_BASE}/rag-kbs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 删除 RAG 知识库
export async function deleteRAG(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rag-kbs/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

// 获取宠物关联的所有 RAG 知识库
export async function getCompanionRAGs(companionId: number): Promise<RAGKnowledgeBase[]> {
  const res = await fetch(`${API_BASE}/rag-kbs/companion/${companionId}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

// 为宠物关联 RAG 知识库
export async function linkRAGToCompanion(companionId: number, ragKbId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rag-kbs/companion/${companionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ragKbId }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

// 取消宠物与 RAG 知识库的关联
export async function unlinkRAGFromCompanion(companionId: number, ragKbId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/rag-kbs/companion/${companionId}/${ragKbId}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}
