import express from 'express';
import { Pool } from 'pg';

const router = express.Router();

// 数据库连接
const pool = new Pool({
  host: 'localhost',
  database: 'epet',
  user: 'postgres',
  password: 'iot2026pass',
  connectionString: undefined,
});

// ==================== RAG 知识库管理 ====================

// 1. 获取所有 RAG 知识库
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM rag_knowledge_bases ORDER BY created_at DESC'
    );
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('获取 RAG 知识库失败:', error);
    res.status(500).json({
      success: false,
      error: '获取 RAG 知识库失败',
      details: error.message
    });
  }
});

// 2. 获取单个 RAG 知识库详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM rag_knowledge_bases WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'RAG 知识库不存在'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('获取 RAG 知识库详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取 RAG 知识库详情失败',
      details: error.message
    });
  }
});

// 3. 创建 RAG 知识库
router.post('/', async (req, res) => {
  try {
    const { name, description, content } = req.body;
    
    // 验证必填字段
    if (!name || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：name, content'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO rag_knowledge_bases (name, description, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || null, content]
    );
    
    res.status(201).json({
      success: true,
      message: 'RAG 知识库创建成功',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('创建 RAG 知识库失败:', error);
    res.status(500).json({
      success: false,
      error: '创建 RAG 知识库失败',
      details: error.message
    });
  }
});

// 4. 更新 RAG 知识库
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, content } = req.body;
    
    // 检查是否存在
    const checkResult = await pool.query(
      'SELECT * FROM rag_knowledge_bases WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'RAG 知识库不存在'
      });
    }
    
    // 更新
    const result = await pool.query(
      `UPDATE rag_knowledge_bases
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           content = COALESCE($3, content),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, description, content, id]
    );
    
    res.json({
      success: true,
      message: 'RAG 知识库更新成功',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('更新 RAG 知识库失败:', error);
    res.status(500).json({
      success: false,
      error: '更新 RAG 知识库失败',
      details: error.message
    });
  }
});

// 5. 删除 RAG 知识库
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先删除关联表中的记录
    await pool.query(
      'DELETE FROM pet_model_rag_kbs WHERE rag_kb_id = $1',
      [id]
    );
    
    // 再删除 RAG 知识库
    const result = await pool.query(
      'DELETE FROM rag_knowledge_bases WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'RAG 知识库不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'RAG 知识库删除成功'
    });
  } catch (error) {
    console.error('删除 RAG 知识库失败:', error);
    res.status(500).json({
      success: false,
      error: '删除 RAG 知识库失败',
      details: error.message
    });
  }
});

// ==================== 宠物-RAG 关联管理 ====================

// 6. 获取宠物关联的所有 RAG 知识库
router.get('/companion/:companionId', async (req, res) => {
  try {
    const { companionId } = req.params;
    
    const result = await pool.query(
      `SELECT kb.*
       FROM rag_knowledge_bases kb
       JOIN pet_model_rag_kbs pmr ON kb.id = pmr.rag_kb_id
       WHERE pmr.model_id = $1
       ORDER BY kb.created_at DESC`,
      [companionId]
    );
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('获取宠物 RAG 关联失败:', error);
    res.status(500).json({
      success: false,
      error: '获取宠物 RAG 关联失败',
      details: error.message
    });
  }
});

// 7. 为宠物关联 RAG 知识库
router.post('/companion/:companionId', async (req, res) => {
  try {
    const { companionId } = req.params;
    const { ragKbId } = req.body;
    
    // 验证必填字段
    if (!ragKbId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：ragKbId'
      });
    }
    
    // 检查宠物是否存在
    const companionCheck = await pool.query(
      'SELECT * FROM models WHERE model_id = $1',
      [companionId]
    );
    
    if (companionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '宠物型号不存在'
      });
    }
    
    // 检查 RAG 是否存在
    const ragCheck = await pool.query(
      'SELECT * FROM rag_knowledge_bases WHERE id = $1',
      [ragKbId]
    );
    
    if (ragCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'RAG 知识库不存在'
      });
    }
    
    // 检查关联是否已存在
    const existCheck = await pool.query(
      'SELECT * FROM pet_model_rag_kbs WHERE model_id = $1 AND rag_kb_id = $2',
      [companionId, ragKbId]
    );
    
    if (existCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: '关联已存在'
      });
    }
    
    // 创建关联
    await pool.query(
      `INSERT INTO pet_model_rag_kbs (model_id, rag_kb_id)
       VALUES ($1, $2)`,
      [companionId, ragKbId]
    );
    
    res.status(201).json({
      success: true,
      message: 'RAG 知识库关联成功'
    });
  } catch (error) {
    console.error('关联 RAG 知识库失败:', error);
    res.status(500).json({
      success: false,
      error: '关联 RAG 知识库失败',
      details: error.message
    });
  }
});

// 8. 取消宠物与 RAG 知识库的关联
router.delete('/companion/:companionId/:ragKbId', async (req, res) => {
  try {
    const { companionId, ragKbId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM pet_model_rag_kbs WHERE model_id = $1 AND rag_kb_id = $2',
      [companionId, ragKbId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: '关联不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'RAG 知识库取消关联成功'
    });
  } catch (error) {
    console.error('取消 RAG 关联失败:', error);
    res.status(500).json({
      success: false,
      error: '取消 RAG 关联失败',
      details: error.message
    });
  }
});

export default router;
