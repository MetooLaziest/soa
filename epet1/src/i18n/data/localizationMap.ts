// 数据层 i18n 静态映射表 (越南语 PoC)
// 编译期 const, VITE_LOCALE=vi 时通过 useLocalizedName 内联到 bundle
// 字典真源 = i18n/zh.json + vi.json; 本表只是 DB 内容 (运营配置) 的语言回退
// 不参与 soa 域 (VITE_LOCALE=zh 直接返回 fallbackZh)
//
// 命名空间: { entityType: { id: 'VietnameseName' } }
// entityType ∈ 'pet_model' | 'pet_series' | 'shop_item' | 'intro_video'
//
// 翻译策略: Google Translate 草稿 + 人工修正
// 后续: 按越南语母语用户反馈迭代 (P1 任务, 不阻塞 PoC 上线)

export const viNames = {
  // ── 机伴 (pet_models) ── 8 个活动机型
  pet_model: {
    1: 'Sóng DunDun',        // 浪墩墩
    2: 'Dẻo DunDun',         // 糯墩墩
    3: 'Ngầu DunDun',        // 酷墩墩
    4: 'Dễ Thương DunDun',   // 萌墩墩
    5: 'Ấm Áp DunDun',       // 暖墩墩
    6: 'Thông Minh DunDun',  // 智墩墩
    7: 'Sặc Sỡ DunDun',      // 彩墩墩
    8: 'Vàng DunDun',        // 金墩墩
  },

  // ── 系列 (pet_series) ── 2 个
  pet_series: {
    1: 'Aisela',                              // 艾瑟拉 (专有名, 保留)
    5: 'Gia Đình DunDun',                     // 墩墩兽家族
  },

  // ── 商店物品 (shop_items) ──
  shop_item: {
    1: 'Bánh Táo',                       // 苹果派
    2: 'Cốc Việt Quất',                  // 蓝莓杯
    3: 'Bánh Dâu Tây',                   // 草莓蛋糕
    4: 'Trà Bá Tước',                    // 伯爵茶
    5: 'Hộp Cansin Cao Cấp',             // 高级罐头
    6: 'Bánh Quy Tăng Trưởng',           // 成长饼干
    7: 'Trái Kinh Nghiệm Siêu Cấp',     // 超级经验果
    10: 'Thú Bông DunDun',               // 团子糯糯 实体玩偶
    11: 'Cá Hề',                          // 小丑鱼
    12: 'Cá Vàng',                        // 金鱼
    13: 'Cá Chép',                        // 锦鲤
    14: 'Cá Rồng',                        // 龙鱼
    15: 'Cá Ngừ',                         // 金枪鱼
    21: 'Ghế A',                          // 椅子A
    22: 'Lều A',                          // 帐篷A
    23: 'Xích Đu',                        // 秋千
    24: 'Ghế B',                          // 椅子B
    25: 'Bụi Hoa Hồng',                  // 粉红花丛
    27: 'Vật Khó Tả',                     // 不可名状之物
    28: 'Dầu',                            // 油
    29: 'Cá Ngừ Áp Chảo',                 // 香煎金枪鱼
    30: 'DunDun',                         // 墩墩兽
    31: 'DunDun Kho',                     // 油闷墩墩兽
    33: 'Cá Chẽm',                        // 鲈鱼
    34: 'Trứng',                          // 鸡蛋
    35: 'Đậu Phụ',                        // 豆腐
    36: 'Bắp Cải',                        // 高丽菜
    37: 'Hành Tây',                       // 洋葱
    38: 'Cà Chua',                        // 西红柿
    39: 'Trứng Xào Cà Chua',              // 番茄炒蛋
    40: 'Hộp Cansin Cũ',                  // 破罐头
    41: 'Nước Mắt Tiên Cá',               // 美人鱼之泪
    42: 'Cá Cờ',                          // 旗鱼
    43: 'Cá Hồi',                         // 鲑鱼
    44: 'Tôm',                            // 虾
    45: 'Ủng',                            // 靴子
    46: 'Cá Thu Đao',                     // 秋刀鱼
    47: 'Cá Thu Đao 1',                   // 秋刀鱼1
  },

  // ── Live 时段说明 (intro_videos) ──
  intro_video: {
    1: 'Trà Chiều (15:30-16:30)',        // 下午茶
    3: 'Ngủ Dậy (15:00-15:30)',          // 午觉睡醒
    4: 'Giờ Ngủ Trưa (12:30-15:00)',     // 午睡时间
    5: 'Thức Dậy (08:00-09:00)',          // 起床
    6: 'Tập Sáng (09:00-10:00)',         // 早练
    7: 'Làm Việc Buổi Sáng (10:00-12:00)', // 上午工作
    8: 'Bữa Trưa (12:00-13:00)',         // 午餐
    9: 'Làm Việc Buổi Chiều (13:00-19:00)', // 下午工作
    10: 'Ngủ (20:00-21:00)',              // 睡觉
    11: 'Ngủ Sâu (21:00-06:00)',          // 熟睡
    12: 'Ngủ Sâu (21:00-06:00)',          // 熟睡
    13: 'Dọn Sân Chiều (14:00-18:00)',    // 下午打扫庭院
    14: 'Bữa Tối (18:00-20:00)',         // 吃晚餐
    15: 'Trà Đêm (20:00-23:00)',         // 喝夜茶
    16: 'Ngủ (18:00-02:00)',              // 睡觉
  },
} as const;

export type EntityType = keyof typeof viNames;
