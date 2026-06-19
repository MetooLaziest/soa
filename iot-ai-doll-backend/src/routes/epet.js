import express from 'express';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  host: 'localhost',
  database: 'epet',
  user: 'postgres',
  password: 'iot2026pass',
  connectionString: undefined,
});

// epet1 database pool (for sync with epet1.travel_records)
const pool2 = new Pool({
  host: 'localhost',
  database: 'epet1',
  user: 'postgres',
  password: 'iot2026pass',
});

const MONSTER_TYPES = {
  white: { name: '白色玩偶(团子糯糯)', image: '/epet/pet-white.png', color: '#F5F5F5' },
  blue:  { name: '蓝色玩偶(海浪沫沫)', image: '/epet/pet-blue.png', color: '#5DADEC' },
  pink:  { name: '粉色机器人(糖心莓莓)', image: '/epet/pet-pink.png', color: '#FF9FCF' },
};

// ---------- helpers ----------
async function calcFullness(pet) {
  if (!pet.last_feed_at) return 0;
  const elapsed = (Date.now() - new Date(pet.last_feed_at).getTime()) / 1000 / 60;
  const raw = 100 - elapsed * (100 / 144);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

async function getPetFullness(petId) {
  const r = await pool.query('SELECT last_feed_at FROM pets WHERE nfc = $1', [petId]);
  if (!r.rows.length) return 0;
  return calcFullness({ last_feed_at: r.rows[0].last_feed_at });
}

function weightedRandom(items) {
  const total = items.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const i of items) { r -= (i.weight || 1); if (r <= 0) return i; }
  return items[items.length - 1];
}

// Milestone loot tables
const FOOD_MILESTONE = [
  { id: 'food_meat',      name: '肉罐头',      icon: '\uD83E\uDD6B', rarity: 'common', weight: 40 },
  { id: 'food_fish',     name: '小鱼干',      icon: '\uD994\uD25C', rarity: 'common', weight: 30 },
  { id: 'food_bone',     name: '大骨棒',      icon: '\uD83E\uDDB4', rarity: 'common', weight: 20 },
  { id: 'food_apple',    name: '红苹果',      icon: '\uD83C\uDF4E', rarity: 'rare',   weight: 7  },
  { id: 'food_pizza',    name: '披萨',        icon: '\uD83C\uDF55', rarity: 'rare',   weight: 3  },
];
const TOY_MILESTONE = [
  { id: 'toy_ball',      name: '弹力球',      icon: '\uD83C\uDFB0', rarity: 'common', weight: 40 },
  { id: 'toy_rope',      name: '拔河绳',      icon: '\uD83E\uDDF7', rarity: 'common', weight: 30 },
  { id: 'toy_doll',      name: '小玩偶',      icon: '\uD83E\uDDE6', rarity: 'rare',   weight: 20 },
  { id: 'toy_car',       name: '遥控车',      icon: '\uD83D\uDE97', rarity: 'epic',   weight: 8  },
  { id: 'toy_ufo',       name: 'UFO飞盘',     icon: '\uD83D\uDE83', rarity: 'legendary', weight: 2 },
];
const SPECIAL_MILESTONE = [
  { id: 'special_badge', name: '生存徽章',   icon: '\uD83C\uDF16', rarity: 'rare',   weight: 50 },
  { id: 'special_crown', name: '小皇冠',     icon: '\uD83D\uDC51', rarity: 'epic',   weight: 35 },
  { id: 'special_wand',  name: '魔法棒',     icon: '\uD83C\uDF84', rarity: 'legendary', weight: 15 },
];

async function giveMilestoneItem(petId, table) {
  const item = weightedRandom(table);
  try {
    await pool.query(
      `INSERT INTO pet_collectibles (nfc, item_id, item_name, item_icon, item_type, rarity)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [petId, item.id, item.name, item.icon, 'special', item.rarity]
    );
    const exists = await pool.query('SELECT id FROM pet_collectibles WHERE nfc=$1 AND item_id=$2', [petId, item.id]);
    if (exists.rows.length) return item;
  } catch(e) {}
  return null;
}

async function checkMilestones(petId, type) {
  const r = await pool.query(
    `SELECT total_feeds,total_pets,total_poops FROM pets WHERE nfc=$1`, [petId]
  );
  if (!r.rows.length) return [];
  const pet = r.rows[0];
  const rewards = [];

  if (type === 'feed') {
    if (pet.total_feeds === 1) {
      const a = await giveMilestoneItem(petId, [{ id:'food_meat',name:'肉罐头',icon:'\uD83E\uDD6B',rarity:'common',weight:1 }]);
      if (a) rewards.push(a);
    } else if (pet.total_feeds > 1 && pet.total_feeds % 10 === 0) {
      const a = await giveMilestoneItem(petId, FOOD_MILESTONE);
      if (a) rewards.push(a);
    }
  } else if (type === 'clean') {
    if (pet.total_poops === 1) {
      const a = await giveMilestoneItem(petId, [{ id:'toy_ball',name:'弹力球',icon:'\uD83C\uDFB0',rarity:'common',weight:1 }]);
      if (a) rewards.push(a);
    } else if (pet.total_poops > 1 && pet.total_poops % 10 === 0) {
      const a = await giveMilestoneItem(petId, TOY_MILESTONE);
      if (a) rewards.push(a);
    }
  } else if (type === 'pet') {
    if (pet.total_pets > 0 && pet.total_pets % 30 === 0) {
      const a = await giveMilestoneItem(petId, SPECIAL_MILESTONE);
      if (a) rewards.push(a);
    }
  }
  return rewards;
}

// ============================================================
// GET /api/epet/models — all available pet models
// ============================================================
router.get('/models', async (req, res) => {
  try {
    const r = await pool.query('SELECT model_id, name, description, system_prompt, image_url, nfc_range_start, nfc_range_end FROM models ORDER BY model_id ASC');
    res.json({ success: true, models: r.rows });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ================================================================
// GET /api/epet/monsters — user's collection of monsters
// ============================================================
router.get('/monsters', async (req, res) => {
  try {
    // Demo: user_id=1
    const r = await pool.query(
      `SELECT nfc, model_id, display_name, monster_type, is_visible, display_order,
              total_feeds, total_pets, total_poops, current_poops, last_interact_at
       FROM pets WHERE user_id = 1 ORDER BY display_order ASC`
    );
    // Fill in monster metadata
    const monsters = r.rows.map(p => ({
      petId: p.nfc,
      displayName: p.display_name || ' @ ' || p.nfc,
      monsterType: p.monster_type || 'green',
      isVisible: p.is_visible,
      displayOrder: p.display_order,
      stats: {
        totalFeeds: p.total_feeds,
        totalPets: p.total_pets,
        totalPoops: p.total_poops,
        currentPoops: p.current_poops || 0,
        lastInteractAt: p.last_interact_at,
      },
      modelId: p.model_id || null,
      monster: MONSTER_TYPES[p.monster_type] || MONSTER_TYPES.white,
    }));
    res.json({ success: true, monsters });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ============================================================
// GET /api/epet/:id — single pet data (unchanged shape + monster_type)
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query('SELECT * FROM pets WHERE nfc = $1', [id]);
    if (!r.rows.length) return res.json({ success: false, error: '宠物不存在' });
    const pet = r.rows[0];
    const fullness = await calcFullness(pet);
    res.json({
      success: true,
      pet: {
        petId:      pet.nfc,
        displayName: pet.display_name || ' @ ' || pet.nfc,
        monsterType: pet.monster_type || 'green',
        isVisible:   pet.is_visible,
        fullness,
        totalFeeds:  pet.total_feeds,
        totalPets:   pet.total_pets,
        totalPoops:  pet.total_poops,
        totalCleans: pet.total_cleans || 0,
        currentPoops: pet.current_poops || 0,
        lastInteractAt: pet.last_interact_at,
        lastFeedAt:  pet.last_feed_at,
        createdAt:   pet.created_at,
        modelId:     pet.model_id || null,
        monster:     MONSTER_TYPES[pet.monster_type] || MONSTER_TYPES.white,
      }
    });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ============================================================
// POST /api/epet/:id/visibility — toggle monster visibility
// ============================================================
router.post('/:id/visibility', async (req, res) => {
  try {
    const { id } = req.params;
    const { visible } = req.body; // boolean

    // Count currently visible
    const countRes = await pool.query(
      'SELECT COUNT(*) as c FROM pets WHERE user_id=1 AND is_visible=true'
    );
    const currentVisible = parseInt(countRes.rows[0].c);

    // If trying to show and already 2 visible (and this one is not already visible), block
    if (visible && currentVisible >= 2) {
      const me = await pool.query('SELECT is_visible FROM pets WHERE nfc=$1', [id]);
      if (!me.rows.length || !me.rows[0].is_visible) {
        return res.json({
          success: false,
          error: '最多只能同时展示2只',
          code: 'MAX_VISIBLE',
        });
      }
    }

    await pool.query(
      'UPDATE pets SET is_visible=$1 WHERE nfc=$2',
      [visible, id]
    );

    const updated = await pool.query(
      'SELECT nfc, monster_type, is_visible FROM pets WHERE nfc=$1', [id]
    );

    // Return full collection for UI refresh
    const allRes = await pool.query(
      `SELECT nfc, display_name, monster_type, is_visible, display_order,
              total_feeds, total_pets, total_poops, current_poops
       FROM pets WHERE user_id=1 ORDER BY display_order ASC`
    );
    const monsters = allRes.rows.map(p => ({
      petId: p.nfc,
      displayName: p.display_name || ' @ ' || p.nfc,
      monsterType: p.monster_type || 'green',
      isVisible: p.is_visible,
      stats: { totalFeeds: p.total_feeds, totalPets: p.total_pets, totalPoops: p.total_poops },
      modelId: p.model_id || null,
      monster: MONSTER_TYPES[p.monster_type] || MONSTER_TYPES.white,
    }));

    res.json({
      success: true,
      monster: {
        petId: updated.rows[0].nfc,
        monsterType: updated.rows[0].monster_type,
        isVisible: updated.rows[0].is_visible,
        monster: MONSTER_TYPES[updated.rows[0].monster_type] || MONSTER_TYPES.white,
      },
      monsters,
    });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ============================================================
// POST /api/epet/:id/feed
// ============================================================
router.post('/:id/feed', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE pets SET last_feed_at=NOW(), total_feeds=total_feeds+1,
       current_poops = CASE WHEN (100 - EXTRACT(EPOCH FROM (NOW()-last_feed_at))/60::numeric) < 100 THEN current_poops+1 ELSE current_poops END,
       last_interact_at=NOW() WHERE nfc=$1`,
      [id]
    );
    const pet = (await pool.query('SELECT * FROM pets WHERE nfc=$1', [id])).rows[0];
    const fullness = await calcFullness(pet);
    const rewards = await checkMilestones(id, 'feed');
    res.json({
      success: true,
      pet: { petId: id, fullness, totalFeeds: pet.total_feeds,
             totalPets: pet.total_pets, totalPoops: pet.total_poops,
             totalCleans: pet.total_cleans || 0, currentPoops: pet.current_poops || 0,
             lastFeedAt: pet.last_feed_at, lastInteractAt: pet.last_interact_at },
      newItems: rewards.map(r => ({ itemId: r.id, name: r.name, icon: r.icon, rarity: r.rarity })),
    });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ============================================================
// POST /api/epet/:id/pet
// ============================================================
router.post('/:id/pet', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE pets SET total_pets=total_pets+1, last_interact_at=NOW() WHERE nfc=$1`,
      [id]
    );
    const pet = (await pool.query('SELECT * FROM pets WHERE nfc=$1', [id])).rows[0];
    const rewards = await checkMilestones(id, 'pet');
    res.json({
      success: true,
      pet: { petId: id, totalPets: pet.total_pets, lastInteractAt: pet.last_interact_at },
      newItems: rewards.map(r => ({ itemId: r.id, name: r.name, icon: r.icon, rarity: r.rarity })),
    });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ============================================================
// POST /api/epet/:id/clean
// ============================================================
router.post('/:id/clean', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE pets SET current_poops=0, total_cleans=COALESCE(total_cleans,0)+1, last_interact_at=NOW() WHERE nfc=$1`,
      [id]
    );
    const pet = (await pool.query('SELECT * FROM pets WHERE nfc=$1', [id])).rows[0];
    const fullness = await calcFullness(pet);
    const rewards = await checkMilestones(id, 'clean');
    res.json({
      success: true,
      pet: { petId: id, fullness, totalFeeds: pet.total_feeds,
             totalPets: pet.total_pets, totalPoops: pet.total_poops,
             totalCleans: pet.total_cleans || 0, currentPoops: pet.current_poops || 0,
             lastFeedAt: pet.last_feed_at, lastInteractAt: pet.last_interact_at },
      newItems: rewards.map(r => ({ itemId: r.id, name: r.name, icon: r.icon, rarity: r.rarity })),
    });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ============================================================
// GET /api/epet/:id/collections
// ============================================================
router.get('/:id/collections', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT id,item_id,item_name,item_icon,item_type,rarity,obtained_at
       FROM pet_collectibles WHERE nfc=$1 ORDER BY obtained_at DESC`,
      [id]
    );
    const byType = { food:[], toy:[], accessory:[], background:[], special:[] };
    r.rows.forEach(i => {
      if (byType[i.item_type]) byType[i.item_type].push(i);
    });
    const counts = { total: r.rows.length };
    Object.keys(byType).forEach(k => counts[k] = byType[k].length);
    res.json({ success: true, items: r.rows, byType, counts, totalCount: r.rows.length });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ============================================================
// GET /api/epet/:id/collections/all-items
// ============================================================
const CATALOG = [
  // food ×7
  { id:'food_meat',  name:'肉罐头',   icon:'\uD83E\uDD6B', type:'food',      rarity:'common',   weight:40 },
  { id:'food_fish',  name:'小鱼干',   icon:'\uD994\uD25C', type:'food',      rarity:'common',   weight:30 },
  { id:'food_bone',  name:'大骨棒',   icon:'\uD83E\uDDB4', type:'food',      rarity:'common',   weight:20 },
  { id:'food_apple', name:'红苹果',   icon:'\uD83C\uDF4E', type:'food',      rarity:'rare',     weight:7  },
  { id:'food_pizza', name:'披萨',     icon:'\uD83C\uDF55', type:'food',      rarity:'rare',     weight:3  },
  { id:'food_cake',  name:'生日蛋糕', icon:'\uD83C\uDF82', type:'food',      rarity:'epic',     weight:1  },
  { id:'food_star',  name:'星星糖',   icon:'\u2B50',       type:'food',      rarity:'legendary',weight:1  },
  // toy ×6
  { id:'toy_ball',   name:'弹力球',   icon:'\uD83C\uDFB0', type:'toy',       rarity:'common',   weight:40 },
  { id:'toy_rope',   name:'拔河绳',   icon:'\uD83E\uDDF7', type:'toy',       rarity:'common',   weight:30 },
  { id:'toy_doll',   name:'小玩偶',   icon:'\uD83E\uDDE6', type:'toy',       rarity:'rare',     weight:20 },
  { id:'toy_car',    name:'遥控车',   icon:'\uD83D\uDE97', type:'toy',       rarity:'epic',     weight:8  },
  { id:'toy_ufo',    name:'UFO飞盘', icon:'\uD83D\uDE83', type:'toy',       rarity:'legendary',weight:2  },
  { id:'toy_rainbow',name:'彩虹球',  icon:'\uD83C\uDF08', type:'toy',       rarity:'legendary',weight:1  },
  // accessory ×6
  { id:'acc_hat',    name:'小帽子',   icon:'\uD83C\uDFA9', type:'accessory', rarity:'common',   weight:30 },
  { id:'acc_glass',  name:'墨镜',     icon:'\uD83D\uDE60', type:'accessory', rarity:'common',   weight:30 },
  { id:'acc_cloak',  name:'披风',     icon:'\uD83D\uDDE5', type:'accessory', rarity:'rare',    weight:20 },
  { id:'acc_wing',   name:'翅膀',    icon:'\uD83C\uDF3C', type:'accessory', rarity:'epic',    weight:15 },
  { id:'acc_crown',  name:'皇冠',    icon:'\uD83D\uDC51', type:'accessory', rarity:'legendary',weight:5  },
  { id:'acc_halo',   name:'光环',    icon:'\uD83D\uDD73', type:'accessory', rarity:'legendary',weight:1  },
  // background ×5
  { id:'bg_cloud',   name:'云朵',     icon:'\u2601\uFE0F', type:'background', rarity:'common',  weight:40 },
  { id:'bg_rainbow', name:'彩虹',    icon:'\uD83C\uDF08', type:'background', rarity:'rare',    weight:30 },
  { id:'bg_stars',   name:'星空',    icon:'\uD83C\uDF20', type:'background', rarity:'epic',   weight:20 },
  { id:'bg_aurora',  name:'极光',    icon:'\uD83C\uDF0C', type:'background', rarity:'legendary',weight:8 },
  { id:'bg_firework',name:'烟花',    icon:'\uD83C\uDF86', type:'background', rarity:'legendary',weight:2 },
  // special ×5
  { id:'spec_badge', name:'生存徽章', icon:'\uD83C\uDF16', type:'special',    rarity:'rare',     weight:40 },
  { id:'spec_medal', name:'奖牌',     icon:'\uD83C\uDFC6', type:'special',    rarity:'epic',    weight:30 },
  { id:'spec_crown', name:'小皇冠',  icon:'\uD83D\uDC51', type:'special',    rarity:'legendary',weight:20 },
  { id:'spec_wand',  name:'魔法棒',  icon:'\uD83C\uDF84', type:'special',    rarity:'legendary',weight:8  },
  { id:'spec_heart', name:'爱心',     icon:'\u2764\uFE0F', type:'special',   rarity:'common',   weight:50 },
];

router.get('/:id/collections/all-items', async (req, res) => {
  try {
    const { id } = req.params;
    const owned = await pool.query(
      'SELECT item_id FROM pet_collectibles WHERE nfc=$1', [id]
    );
    const ownedSet = new Set(owned.rows.map(r => r.item_id));
    const catalog = CATALOG.map(c => ({
      itemId: c.id, name: c.name, icon: c.icon,
      type: c.type, rarity: c.rarity,
      owned: ownedSet.has(c.id),
    }));
    res.json({ success: true, catalog });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ============================================================
// POST /api/epet/:id/collections/add
// ============================================================
router.post('/:id/collections/add', async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId } = req.body;
    const entry = CATALOG.find(c => c.id === itemId);
    if (!entry) return res.json({ success: false, error: 'Unknown item' });
    await pool.query(
      `INSERT INTO pet_collectibles (nfc,item_id,item_name,item_icon,item_type,rarity)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [id, entry.id, entry.name, entry.icon, entry.type, entry.rarity]
    );
    const r = await pool.query(
      'SELECT * FROM pet_collectibles WHERE nfc=$1 AND item_id=$2', [id, itemId]
    );
    res.json({ success: true, item: r.rows[0] });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});


// ============================================================
// POST /api/epet/:id/chat  — AI 对话
// ============================================================
router.post('/:id/chat', async (req, res) => {
  try {
    const { id } = req.params;
    const { messages } = req.body;

    if (!Array.isArray(messages) || !messages.length) {
      return res.json({ success: false, error: 'messages 为空' });
    }

    // 1. 获取宠物信息和关联的 model 信息（含 temperature）
    const petRow = await pool.query(`
      SELECT 
        p.nfc, 
        p.display_name, 
        p.monster_type, 
        p.system_prompt AS pet_system_prompt,
        m.system_prompt AS model_system_prompt,
        m.name AS model_name,
        m.temperature
      FROM pets p
      LEFT JOIN models m ON p.model_id = m.model_id
      WHERE p.nfc = $1
    `, [id]);

    if (!petRow.rows.length) {
      return res.json({ success: false, error: '宠物不存在' });
    }

    const pet = petRow.rows[0];
    const monsterInfo = MONSTER_TYPES[pet.monster_type] || MONSTER_TYPES.white;
    
    // 2. 获取关联的 RAG 知识库列表（仅 id、name、description）
    const ragIndexRows = await pool.query(`
      SELECT r.id, r.name, r.description, r.content
      FROM rag_knowledge_bases r
      JOIN pet_model_rag_kbs pmr ON r.id = pmr.rag_kb_id
      WHERE pmr.model_id = (SELECT model_id FROM pets WHERE nfc = $1)
    `, [id]);

    // 3. 构建系统提示词（L1-L4 层：优先用 models.system_prompt，否则 pets.system_prompt，最后 fallback）
    let systemPrompt = pet.model_system_prompt || pet.pet_system_prompt || (
      '你是' + pet.display_name + '，一个可爱的数字生命宠物。' +
      '你的形象是' + monsterInfo.name + '。' +
      '请用温暖、有趣的方式与用户交流，保持角色一致性。' +
      '回复简洁可爱，不超过100字。'
    );

    // 3.5 L5 层：动态注入宠物实时状态
    const hungerVal = Math.round(pet.hunger || 0);
    let moodLabel = '愉快';
    if (hungerVal <= 0) moodLabel = '饥饿';
    else if (hungerVal <= 30) moodLabel = '低落';
    else if (hungerVal <= 60) moodLabel = '一般';

    let l5State = '\n\n【L5 - 当前状态】\n';
    l5State += `你是${pet.display_name}（${pet.model_name || '未知型号'}）。`;
    l5State += `\n饱腹度：${hungerVal}% · 心情：${moodLabel}`;
    if ((pet.current_poops || 0) > 0) l5State += ` · 💩未清理：×${pet.current_poops}`;
    l5State += `\n互动统计：喂食${pet.total_feeds || 0}次 / 抚摸${pet.total_pets || 0}次 / 清理${pet.total_cleans || 0}次`;

    systemPrompt += l5State;

    // L4 层：RAG 知识索引
    if (ragIndexRows.rows.length > 0) {
      let ragIndexText = '\n\n【L4 - 可用知识库】\n';
      ragIndexRows.rows.forEach((rag, idx) => {
        ragIndexText += `${idx + 1}. [${rag.name}] - ${rag.description}\n`;
      });
      ragIndexText += '\n如需使用，请告诉我需要哪个知识库。\n';
      systemPrompt += ragIndexText;
    }

    // 4. 判断是否需要 RAG（混合方案：关键词 + AI 判断）
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    let needsRAG = false;
    let ragContent = '';

    if (ragIndexRows.rows.length > 0) {
      // 第一关：简单判断（快速，免费）
      const ragNames = ragIndexRows.rows.map(r => r.name);
      needsRAG = ragNames.some(name => lastUserMessage.includes(name));
      
      // 第二关：如果关键词未命中，让 AI 判断（智能，但消耗 token）
      if (!needsRAG) {
        try {
          console.log('[RAG] 关键词未命中，调用 AI 判断...');
          const judgeResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'qwen-turbo',  // 使用轻量级模型节省成本
              messages: [
                {
                  role: 'system',
                  content: '你是一个判断器。判断用户的问题是否需要参考以下知识库来回答。只需要回答 YES 或 NO。'
                },
                {
                  role: 'user',
                  content: `用户问题：${lastUserMessage}\n\n可用知识库：\n${ragIndexRows.rows.map((r, i) => `${i+1}. ${r.name}: ${r.description}`).join('\n')}\n\n是否需要使用知识库？只回答 YES 或 NO。`
                }
              ],
              temperature: 0.0,  // 确定性输出
              max_tokens: 10
            })
          });
          
          const judgeData = await judgeResponse.json();
          const judgeAnswer = judgeData.choices?.[0]?.message?.content?.trim().toUpperCase();
          
          console.log(`[RAG] AI 判断结果：${judgeAnswer}`);
          
          if (judgeAnswer === 'YES') {
            needsRAG = true;
          }
        } catch (judgeError) {
          console.error('[RAG] AI 判断失败，使用关键词匹配结果：', judgeError);
          // 保持 needsRAG = false
        }
      }
    }

    // 5. 如果需要 RAG，获取完整内容
    if (needsRAG) {
      const matchedRag = ragIndexRows.rows.find(r => 
        lastUserMessage.includes(r.name)
      );
      if (matchedRag) {
        const ragContentRow = await pool.query(`
          SELECT content FROM rag_knowledge_bases WHERE id = $1
        `, [matchedRag.id]);
        
        if (ragContentRow.rows.length > 0) {
          ragContent = '\n\n【L4 - 知识库内容】\n' + ragContentRow.rows[0].content + '\n';
          systemPrompt += ragContent;
        }
      }
    }

    // 6. 调用千问 API（带 temperature 参数）
    const apiKey = 'sk-88531931fa2149028a52329c50c2d49e';
    const temperature = parseFloat(pet.temperature) || 0.3;  // 默认 0.3
    
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: temperature,  // 使用数据库中的 temperature
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Qwen API error:', err);
      return res.json({ success: false, error: 'AI 服务异常，请稍后再试' });
    }

    const data = await response.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '...';
    
    res.json({ success: true, reply });
  } catch(e) {
    console.error('Chat error:', e);
    res.json({ success: false, error: e.message });
  }
});

router.get('/:id/system-prompt', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query('SELECT system_prompt FROM pets WHERE nfc = $1', [id]);
    if (!r.rows.length) return res.json({ success: false, error: '宠物不存在' });
    res.json({ success: true, systemPrompt: r.rows[0].system_prompt || '' });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ============================================================
// POST /api/epet/:id/system-prompt  — 保存提示词
// ============================================================
router.post('/:id/system-prompt', async (req, res) => {
  try {
    const { id } = req.params;
    const { systemPrompt } = req.body;
    await pool.query('UPDATE pets SET system_prompt = $1 WHERE nfc = $2', [systemPrompt || '', id]);
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});


// ============================================================

// GET /api/epet/travel/:userId — 获取某用户所有旅行中的宠物（前端藏品库用）
router.get('/travel/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const pets = await pool.query(
      `SELECT nfc, display_name, model_id, is_traveling, travel_started_at,
              travel_returns_at, travel_destination
       FROM pets
       WHERE user_id = $1 AND is_traveling = true
         AND (travel_returns_at IS NULL OR travel_returns_at > NOW())`,
      [userId]
    );

    const records = pets.rows.map(p => ({
      status: 'traveling',
      pet_instance_id: p.nfc,          // 前端用 pet_instance_id
      nfc: p.nfc,
      pet_nickname: p.display_name,
      destination: p.travel_destination,
      started_at: p.travel_started_at,
      returns_at: p.travel_returns_at,
      remaining_ms: p.travel_returns_at
        ? Math.max(0, new Date(p.travel_returns_at).getTime() - Date.now())
        : null
    }));

    res.json({ success: true, records });
  } catch (err) {
    console.error('travel/:userId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/epet/travel/start — 派宠物去旅行
// GET  /api/epet/travel/:nfc — 查询旅行状态（含自动归来）
// POST /api/epet/travel/:nfc/cancel — 取消旅行
// ============================================================


// GET /api/epet/travel/:userId — 获取某用户所有旅行中的宠物（前端藏品库用）
router.get('/travel/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const pets = await pool.query(
      `SELECT nfc, display_name, model_id, is_traveling, travel_started_at,
              travel_returns_at, travel_destination
       FROM pets
       WHERE user_id = $1 AND is_traveling = true
         AND (travel_returns_at IS NULL OR travel_returns_at > NOW())`,
      [userId]
    );

    const records = pets.rows.map(p => ({
      status: 'traveling',
      pet_instance_id: p.nfc,          // 前端用 pet_instance_id
      nfc: p.nfc,
      pet_nickname: p.display_name,
      destination: p.travel_destination,
      started_at: p.travel_started_at,
      returns_at: p.travel_returns_at,
      remaining_ms: p.travel_returns_at
        ? Math.max(0, new Date(p.travel_returns_at).getTime() - Date.now())
        : null
    }));

    res.json({ success: true, records });
  } catch (err) {
    console.error('travel/:userId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/epet/travel/start
router.post('/travel/start', async (req, res) => {
  try {
    // 支持两种格式：{nfc} 或 {user_id, pet_instance_id}（前端格式）
    let nfc = req.body.nfc || req.body.pet_instance_id;
    if (!nfc) return res.status(400).json({ success: false, error: '缺少 nfc 参数' });
    nfc = String(nfc);

    const pet = await pool.query(
      'SELECT nfc, display_name, is_traveling FROM pets WHERE nfc = $1', [nfc]
    );
    if (!pet.rows.length) return res.status(404).json({ success: false, error: '宠物不存在' });
    if (pet.rows[0].is_traveling) return res.status(400).json({ success: false, error: '宠物正在旅行中' });

    const destinations = [
      '🏔️ 雪山顶峰', '🏖️ 阳光海滩', '🌲 魔法森林', '🏙️ 霓虹都市',
      '🌸 樱花小镇', '🌙 星空营地', '🌈 彩虹乐园', '🍃 清风草原',
      '🗼 水晶高塔', '🌋 火山温泉'
    ];
    const destination = destinations[Math.floor(Math.random() * destinations.length)];
    const startedAt = new Date();
    const returnsAt = new Date(startedAt.getTime() + 12 * 60 * 60 * 1000);

    await pool.query(`
      UPDATE pets SET is_traveling=true, travel_started_at=$1,
      travel_returns_at=$2, travel_destination=$3 WHERE nfc=$4
    `, [startedAt, returnsAt, destination, nfc]);

    res.json({
      success: true,
      record: {
        pet_instance_id: nfc,
        nfc,
        pet_nickname: pet.rows[0].display_name,
        destination,
        started_at: startedAt.toISOString(),
        returns_at: returnsAt.toISOString(),
        status: 'traveling'
      }
    });
  } catch (err) {
    console.error('travel/start error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/epet/travel/:nfc
router.get('/travel/:nfc', async (req, res) => {
  try {
    const { nfc } = req.params;
    const pet = await pool.query(
      `SELECT nfc, display_name, is_traveling, travel_started_at,
              travel_returns_at, travel_destination
       FROM pets WHERE nfc = $1`, [nfc]
    );
    if (!pet.rows.length) return res.status(404).json({ success: false, error: '宠物不存在' });

    const p = pet.rows[0];
    if (p.is_traveling && p.travel_returns_at && new Date() >= new Date(p.travel_returns_at)) {
      await pool.query(
        `UPDATE pets SET is_traveling=false, travel_started_at=NULL,
         travel_returns_at=NULL, travel_destination=NULL WHERE nfc=$1`, [nfc]
      );
      p.is_traveling = false;
    }

    const records = [];
    if (p.is_traveling) {
      records.push({
        status: 'traveling',
        nfc: p.nfc,
        pet_nickname: p.display_name,
        destination: p.travel_destination,
        started_at: p.travel_started_at,
        returns_at: p.travel_returns_at,
        remaining_ms: Math.max(0, new Date(p.travel_returns_at).getTime() - Date.now())
      });
    }
    res.json({ success: true, records });
  } catch (err) {
    console.error('travel/:nfc error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/epet/travel/:nfc/cancel — 取消旅行（同时清理 epet + epet1）
router.post('/travel/:nfc/cancel', async (req, res) => {
  try {
    const { nfc } = req.params;

    // 1. 查本地 epet 数据库
    const pet = await pool.query(
      'SELECT nfc, display_name, is_traveling FROM pets WHERE nfc = $1', [nfc]
    );
    if (!pet.rows.length) return res.status(404).json({ success: false, error: '宠物不存在' });
    if (!pet.rows[0].is_traveling) return res.status(400).json({ success: false, error: '宠物不在旅行中' });

    // 2. 同步清理 epet 数据库
    await pool.query(`
      UPDATE pets SET is_traveling=false, travel_started_at=NULL,
       travel_returns_at=NULL, travel_destination=NULL WHERE nfc=$1
    `, [nfc]);

    // 3. 同步清理 epet1 数据库（通过 nfc_id 找 pet_instance_id）
    try {
      const instance = await pool2.query(
        'SELECT id FROM pet_instances WHERE nfc_id = $1', [nfc]
      );
      if (instance.rows[0]) {
        await pool2.query(
          `DELETE FROM travel_records WHERE pet_instance_id = $1 AND status = 'traveling'`,
          [instance.rows[0].id]
        );
        await pool2.query(
          `UPDATE yard_pets SET is_active = true WHERE pet_instance_id = $1`,
          [instance.rows[0].id]
        );
        console.log(`✅ [cancel] 同步清理 epet1 pet_instance_id=${instance.rows[0].id}`);
      }
    } catch (err) {
      console.error('epet1 sync error:', err.message);
      // 不阻断，epet 侧已处理
    }

    res.json({ success: true, message: pet.rows[0].display_name + ' 已取消旅行' });
  } catch (err) {
    console.error('travel/cancel error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


export default router;