/**
 * epet1 Admin Prompt Layers API
 * GET  /api/epet1/admin/pet-models/:id/layers  - 获取5层数据
 * PUT  /api/epet1/admin/pet-models/:id/layers  - 更新5层数据
 */
module.exports = (pool) => {
  const router = require('express').Router();

  // 获取宠物型号的5层提示词
  router.get('/pet-models/:id/layers', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, identity_anchor, core_personality, behavior_rules,
                skill_layer, context_memory_template, prompt_version, personality_template
         FROM pet_models WHERE id = $1`,
        [req.params.id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ success: false, error: '型号不存在' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 更新宠物型号的5层提示词
  router.put('/pet-models/:id/layers', async (req, res) => {
    try {
      const { identity_anchor, core_personality, behavior_rules, skill_layer, context_memory_template, prompt_version } = req.body;
      const fields = [];
      const values = [];
      let idx = 1;

      if (identity_anchor !== undefined) { fields.push(`identity_anchor = $${idx++}`); values.push(identity_anchor); }
      if (core_personality !== undefined) { fields.push(`core_personality = $${idx++}`); values.push(core_personality); }
      if (behavior_rules !== undefined) { fields.push(`behavior_rules = $${idx++}`); values.push(behavior_rules); }
      if (skill_layer !== undefined) { fields.push(`skill_layer = $${idx++}`); values.push(skill_layer); }
      if (context_memory_template !== undefined) { fields.push(`context_memory_template = $${idx++}`); values.push(context_memory_template); }
      if (prompt_version !== undefined) { fields.push(`prompt_version = $${idx++}`); values.push(prompt_version); }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, error: '没有要更新的字段' });
      }

      values.push(req.params.id);
      const sql = `UPDATE pet_models SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, prompt_version`;
      const result = await pool.query(sql, values);
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
