// useT: 翻译缺失时自动回退到原文 (soa 0 风险的关键)
// 用法: const t = useT(); <span>{t('app.foo.title', '原中文')}</span>
//       支持 i18next 插值: t('app.greet', '你好 {{name}}', { name: 'Tom' })
//      如果 zh.json 有 'app.foo.title' → 显示翻译
//      如果没有 → 显示 '原中文' (i18next 会原样返回 key,
//                                  useT 判 key===value 时返回 defaultText)
import { useTranslation } from 'react-i18next'

export type TFunction = (key: string, defaultText: string, vars?: Record<string, any>) => string

function interpolate(text: string, vars?: Record<string, any>): string {
  if (!vars) return text
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => k in vars ? String(vars[k]) : `{{${k}}}`)
}

export function useT(): TFunction {
  const { t } = useTranslation()
  return (key: string, defaultText: string, vars?: Record<string, any>) => {
    // 1. 查 zh.json 翻译
    let v: string
    try {
      v = vars ? (t(key, vars) as string) : t(key)
    } catch {
      // i18next interpolation 失败 (e.g. vars 引用了 key 里没有的 {{x}})
      // 回退到 defaultText + 客户端插值
      return interpolate(defaultText, vars)
    }
    // 2. 翻译缺失 (i18next 返回 key 本身) → 用 defaultText + 客户端插值
    if (v === key) return interpolate(defaultText, vars)
    // 3. 翻译命中 → 原样返回 (i18next 已在 vi 翻译里完成插值)
    return v
  }
}
