import * as z from "zod"

export const ogImageSchema = z.object({
  // 可选标题
  heading: z.string().optional(),
  // before/after 对比图像 URL（可为空，用占位符处理）
  before: z.string().url().optional(),
  after: z.string().url().optional(),
  // 用于标题数字或追踪
  id: z.string().optional(),
  // 渲染类型，支持 'before-after'
  type: z.string().optional(),
  // 主题
  mode: z.enum(["light", "dark"]).default("dark"),
})
