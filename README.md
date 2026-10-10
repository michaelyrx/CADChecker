# CADLint

矢量 PDF 图纸检查应用。首批次实现产品类别、项目与图纸的基础闭环，沿用 AutoReg 的 Next.js 15、React 19、TypeScript 技术栈。原有 NX PDF 检查脚本保留在 `nx-pdf-drawing-inspection/`。

## 本地运行

```bash
cd frontend
npm install
npm run dev
```

打开 `http://localhost:3000`。数据和上传文件保存在 `frontend/.data/`，不会提交到仓库。页面支持中文与英文。

首批次可创建产品类别和项目，上传 PDF、查看项目图纸列表并在浏览器中预览。上传仅验证 PDF 文件格式；矢量内容解析、检查规则执行、DeepSeek 接口和账号权限将在后续批次接入。开发环境数据存储适用于单实例验证，生产部署需替换为数据库与文件存储。

应用方案见 [application-solution.md](application-solution.md)。
