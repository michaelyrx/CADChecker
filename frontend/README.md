# CADLint 前端

与 AutoReg 一样使用 Next.js 15、React 19 和 TypeScript。页面支持简体中文、English；打开后直接进入当前项目，没有独立工作台。

现已接通服务端接口：创建跨项目产品类别、创建并切换项目、上传 PDF、查看图纸列表与原文件预览，并通过 Python POC 脚本分析每页矢量内容操作。项目必须关联一个类别。类别规则包可以编辑和发布版本，已分析图纸可运行 PDF 输入质量检查，历史记录固定所用规则版本。项目内“流程”页可发布执行方案：分析、输入质量检查、可选人工复核，并保存每个节点的状态和版本。CAD 语义检查与 DeepSeek 联调将在后续批次实现。

先在仓库根目录安装 `backend/requirements.txt` 到 `backend/.venv`，再运行 `npm ci`、`npm run dev`；检查 `npm run typecheck`、`npm run build`。开发数据保存在 `.data/`，可通过 `CADLINT_DATA_DIR` 指定其他目录。当前文件存储仅供单实例开发验证；生产环境需要数据库、对象存储和身份权限。
