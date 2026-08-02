// localize: 数据层 i18n (DB 运营配置) 的语言回退
// 用法: import { localize } from '../i18n/localize';
//       <span>{localize('pet_model', pet.modelId, pet.modelName)}</span>
// 行为:
//   - VITE_LOCALE=zh (soa 域) → 直接返回 fallbackZh (DB 原值), soa 0 变化
//   - VITE_LOCALE=vi (vn 域)  → 查 viNames 表, 命中则返回越南语, 未命中回退 fallbackZh
// 关键: 纯函数, 不是 React hook, 可在 module 顶层 import 并调用 (跟 t() 一致)
//
// 为什么不直接用 t() + i18n 字典?
//  - DB 表 pet_models/shop_items/pet_series/intro_videos 没 name_vi 列
//  - i18n 字典是 key-value 静态字典, 不是 ID 索引
//  - static map 文件 = 编译期 const, VITE_LOCALE=vi 时整张表内联到 bundle, 0 网络成本
//  - soa 域完全不读这个表, 行为与现状 1:1 一致
import { viNames, type EntityType } from './data/localizationMap'

export const localize: (
  entityType: EntityType,
  id: number,
  fallbackZh: string
) => string = (entityType, id, fallbackZh) => {
  // soa 域 (VITE_LOCALE=zh) 直接返回 DB 原值, 0 行为变化
  if (import.meta.env.VITE_LOCALE !== 'vi') return fallbackZh
  // vn 域: 查表, 未命中 (新加 ID 还没翻译) → 落回中文, 不出现 undefined
  return viNames[entityType]?.[id] || fallbackZh
}
