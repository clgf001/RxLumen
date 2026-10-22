import { z } from 'zod';

export const sections = [
  ['indications', '适应症'],
  ['dosage', '用法用量'],
  ['pediatric', '儿童用药'],
  ['contraindications', '禁忌'],
  ['adverseReactions', '不良反应'],
  ['precautions', '注意事项'],
  ['interactions', '药物相互作用'],
  ['pregnancy', '孕妇及哺乳期妇女用药'],
  ['geriatric', '老年用药'],
  ['storage', '贮藏'],
] as const;

const short = z.string().trim().max(200).default('');
const paragraph = z.string().trim().max(12000).default('');
const date = z
  .string()
  .default('')
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    '请输入有效日期 YYYY-MM-DD',
  );
export const manualSchema = z
  .object({
    genericName: z.string().trim().min(1, '请填写通用名').max(200),
    tradeName: short,
    manufacturer: z.string().trim().min(1, '请填写生产厂家').max(200),
    approvalNumber: z.string().trim().min(1, '请填写批准文号或演示编号').max(100),
    specification: short,
    dosageForm: short,
    indications: paragraph,
    dosage: paragraph,
    pediatric: paragraph,
    contraindications: paragraph,
    adverseReactions: paragraph,
    precautions: paragraph,
    interactions: paragraph,
    pregnancy: paragraph,
    geriatric: paragraph,
    storage: paragraph,
    sourceName: short,
    sourceUrl: z
      .string()
      .trim()
      .max(2000)
      .default('')
      .refine(
        (v) => !v || (/^https?:\/\//i.test(v) && URL.canParse(v)),
        '来源链接仅支持 http/https',
      ),
    revisionDate: date,
    reviewedBy: short,
    reviewedAt: date,
    isDemo: z.boolean().default(false),
    status: z.enum(['draft', 'published']).default('draft'),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.isDemo &&
      (!v.genericName.startsWith('【虚构演示】') || !v.approvalNumber.startsWith('DEMO-'))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '演示名称须以【虚构演示】开头，编号须以 DEMO- 开头',
      });
    }
    if (!v.isDemo && v.status === 'published') {
      for (const k of [
        'sourceName',
        'reviewedBy',
        'reviewedAt',
        'indications',
        'dosage',
        'pediatric',
        'contraindications',
        'adverseReactions',
        'precautions',
        'interactions',
      ] as const) {
        if (!v[k])
          ctx.addIssue({
            code: 'custom',
            path: [k],
            message: '正式发布前请补齐此项；原文无此项时明确填写“原文未载明”',
          });
      }
      if (v.approvalNumber.startsWith('DEMO-') || v.genericName.startsWith('【虚构演示】'))
        ctx.addIssue({ code: 'custom', message: '虚构数据必须勾选演示数据' });
    }
  });

export type ManualInput = z.infer<typeof manualSchema>;
export type Manual = ManualInput & {
  id: string;
  pinyin: string;
  pinyinInitials: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type SearchResult = {
  items: Manual[];
  total: number;
  page: number;
  pageSize: number;
  totalPublished: number;
  demoCount: number;
};
