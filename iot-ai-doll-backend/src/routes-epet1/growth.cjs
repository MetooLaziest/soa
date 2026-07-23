/**
 * growth.cjs — 宠物成长等级系统
 *
 * 导出:
 *   addExp(pool, client, petInstanceId, amount, userId)
 *     → { success, growth_level, growth_exp, leveled_up, new_level, exp_to_next }
 *
 * 等级经验表:
 *   Lv1→2 = 100exp, Lv2→3 = 200exp, Lv3→4 = 500exp, Lv4→5 = 2000exp
 *
 * 明信片稀有度经验表:
 *   新卡 = 20, N = 1, R = 2, SR = 4, SSR = 7, UR = 10
 *
 * 重复宠物合并经验 = 100
 */

// 等级 → 累计所需经验 (index = level)
const LEVEL_THRESHOLDS = [0, 100, 300, 800, 2800];
const MAX_LEVEL = LEVEL_THRESHOLDS.length; // 5

// 明信片稀有度 → 经验值
const POSTCARD_RARITY_EXP = { N: 1, R: 2, SR: 4, SSR: 7, UR: 10 };
const NEW_POSTCARD_EXP = 20;

// 重复宠物合并经验
const MERGE_EXP = 100;

/**
 * 计算当前等级和到下一级所需经验
 */
function calcLevel(totalExp) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalExp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || null;
  const expInLevel = totalExp - currentThreshold;
  const expToNext = nextThreshold !== null ? nextThreshold - totalExp : 0;
  return { level, expInLevel, expToNext, nextThreshold };
}

/**
 * 给宠物加经验 + 自动检测升级
 * @param {object} pool - pg pool (非事务场景)
 * @param {object} client - pg client (事务场景, 可选)
 * @param {number} petInstanceId - 宠物实例 ID
 * @param {number} amount - 经验值增量
 * @param {number} userId - 用户 ID (用于日志)
 * @returns {object} { success, growth_level, growth_exp, leveled_up, new_level, exp_to_next }
 */
async function addExp(pool, client, petInstanceId, amount, userId) {
  const q = client || pool; // 事务内用 client，否则用 pool

  // 1. 读取当前经验
  const { rows } = await q.query(
    'SELECT growth_level, growth_exp FROM pet_instances WHERE id = $1',
    [petInstanceId]
  );
  if (!rows[0]) throw new Error(`pet_instance ${petInstanceId} 不存在`);

  const oldLevel = rows[0].growth_level || 1;
  const oldExp = rows[0].growth_exp || 0;
  const newExp = oldExp + amount;

  // 2. 计算新等级
  const { level: newLevel, expToNext } = calcLevel(newExp);
  const leveledUp = newLevel > oldLevel;

  // 3. 更新数据库
  await q.query(
    'UPDATE pet_instances SET growth_level = $1, growth_exp = $2, updated_at = NOW() WHERE id = $3',
    [newLevel, newExp, petInstanceId]
  );

  if (leveledUp) {
    console.log(`🎉 [Growth] 宠物 ${petInstanceId} (用户${userId}) 升级! Lv${oldLevel} → Lv${newLevel}, 经验 ${oldExp}→${newExp}`);
  } else {
    console.log(`📈 [Growth] 宠物 ${petInstanceId} +${amount}exp (Lv${newLevel}, ${newExp}/${LEVEL_THRESHOLDS[newLevel] || 'MAX'})`);
  }

  return {
    success: true,
    growth_level: newLevel,
    growth_exp: newExp,
    leveled_up: leveledUp,
    old_level: oldLevel,
    new_level: newLevel,
    exp_to_next: expToNext,
  };
}

/**
 * 合并重复宠物: 将新实例标记为 merged, 经验喂给旧实例
 * @param {object} q - pool 或 client
 * @param {number} newInstanceId - 要被合并的新实例 ID
 * @param {number} targetInstanceId - 接收经验的目标实例 ID
 * @param {number} userId - 用户 ID
 * @returns {object} addExp 的返回值
 */
async function mergePet(q, newInstanceId, targetInstanceId, userId) {
  // 1. 将新实例标记为 merged
  await q.query(
    `UPDATE pet_instances SET status = 'merged', merged_into_id = $1, user_id = $2, updated_at = NOW() WHERE id = $3`,
    [targetInstanceId, userId, newInstanceId]
  );

  // 2. 从 yard_pets 移除新实例（如果在）
  await q.query(
    'DELETE FROM yard_pets WHERE pet_instance_id = $1',
    [newInstanceId]
  );

  // 3. 给旧实例加经验
  const result = await addExp(null, q, targetInstanceId, MERGE_EXP, userId);
  console.log(`🔗 [Merge] 实例 #${newInstanceId} → #${targetInstanceId}, +${MERGE_EXP}exp`);

  return result;
}

/**
 * 根据明信片稀有度计算旅行经验
 * @param {string} rarity - 明信片稀有度 N/R/SR/SSR/UR
 * @param {boolean} isNew - 是否是新明信片
 * @returns {number} 经验值
 */
function calcPostcardExp(rarity, isNew) {
  if (isNew) return NEW_POSTCARD_EXP;
  return POSTCARD_RARITY_EXP[rarity] || 1;
}

module.exports = {
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  POSTCARD_RARITY_EXP,
  NEW_POSTCARD_EXP,
  MERGE_EXP,
  calcLevel,
  addExp,
  mergePet,
  calcPostcardExp,
};
