// i18next 编译时定死语言
// - VITE_LOCALE=zh (soa 默认) 或 VITE_LOCALE=vi (vn 域)
// - fallbackLng='zh' 兜底,任何 key 找不到都回退中文
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from './locales/zh.json'
import vi from './locales/vi.json'

// 编译时定死 (Vite 8 import.meta.env 静态注入)
const locale = (import.meta.env.VITE_LOCALE as string) || 'zh'

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh as Record<string, string> },
    vi: { translation: vi as Record<string, string> },
  },
  lng: locale,           // 编译时定死,soa=zh, vn=vi
  fallbackLng: 'zh',     // 漏翻译兜底中文 (soa 0 风险关键防线)
  interpolation: { escapeValue: false },
  saveMissing: false,    // 不写运行时日志
  returnEmptyString: false, // 找不到返回 key 名,让 useT.ts 兜底原文
})

export default i18n
