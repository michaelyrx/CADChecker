# CADLint 前端

与 AutoReg 一样使用 Next.js 15、React 19 和 TypeScript。页面支持简体中文、English；打开后直接进入当前项目，没有独立工作台。

首批次已接通服务端接口：创建跨项目产品类别、创建并切换项目、上传 PDF、查看图纸列表与原文件预览。项目必须关联一个类别。规则包编辑、矢量内容解析、检查任务及 DeepSeek 联调将在后续批次实现。

运行 `npm install`、`npm run dev`；检查 `npm run typecheck`、`npm run build`。开发数据保存在 `.data/`，可通过 `CADLINT_DATA_DIR` 指定其他目录。当前文件存储仅供单实例开发验证；生产环境需要数据库、对象存储和身份权限。
