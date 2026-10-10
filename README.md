# CADLint

矢量 PDF 图纸检查应用。首批次实现产品类别、项目与图纸的基础闭环，沿用 AutoReg 的 Next.js 15、React 19、TypeScript 技术栈。原有 NX PDF 检查脚本保留在 `nx-pdf-drawing-inspection/`。

## 本地运行

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci
npm run dev
```

打开 `http://localhost:3000`。数据和上传文件保存在 `frontend/.data/`，不会提交到仓库。页面支持中文与英文。

可创建产品类别和项目，上传 PDF、查看项目图纸列表与预览。选择图纸后点击“分析矢量内容”，应用会复用仓库中的 Python POC 脚本，记录每页路径绘制、文字操作、XObject 调用数量及文件校验值。没有明确矢量操作的页面标记为“待确认”。这里是 PDF 内容流清单，不是 CAD 几何、尺寸或标注检查结论；规则执行、DeepSeek 接口和账号权限将在后续批次接入。

开发环境数据保存在 `frontend/.data/`，每次分析输出单独保存在 `analysis/<图纸 ID>/<执行 ID>/`；也可通过 `CADLINT_DATA_DIR` 指定其他目录。Python 可执行文件默认使用 `backend/.venv/bin/python`，也可通过 `CADLINT_PYTHON` 覆盖。当前文件存储适用于单实例验证；生产部署需替换为数据库与文件存储。

应用方案见 [application-solution.md](application-solution.md)。
