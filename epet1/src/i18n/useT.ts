// useT: 翻译缺失时自动回退到原文 (soa 0 风险的关键)
// 用法: const t = useT(); <span>{t('app.foo.title', '原中文')}</span>
//      如果 zh.json 有 'app.foo.title' → 显示翻译
//      如果没有 → 显示 '原中文' (i18next 会原样返回 key,
//                                  useT 判 key===value 时返回 defaultText)
import { useTranslation } from 'react-i18next'

export type TFunction = (key: string, defaultText: string) => string

export function useT(): TFunction {
  const { t } = useTranslation()
  return (key: string, defaultText: string) => {
    const v = t(key)
    // i18next 找不到 key 时返回 key 本身
    // 此时回退到 defaultText (原中文),保证 UI 不出现 [missing] 或裸 key
    return v === key ? defaultText : v
  }
}
