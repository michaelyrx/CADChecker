# CADLint

矢量 PDF 图纸检查应用。已实现产品类别、项目、图纸与 PDF 内容流分析，沿用 AutoReg 的 Next.js 15、React 19、TypeScript 技术栈。原有 NX PDF 检查脚本保留在 `nx-pdf-drawing-inspection/`。

## 本地运行

需要 Node.js 20+、Python 3.9+ 和 npm。

```bash
./scripts/local-setup.sh
./scripts/local-start.sh
```

打开 `http://127.0.0.1:3100`。首次进入没有预置项目；先通过页眉创建产品类别，再创建项目。可从 `.local-verification/samples/` 上传 `vector-line.pdf` 和 `blank-page.pdf`，比较分析结果。按 `Ctrl+C` 停止服务。页面支持中文与英文。

`local-setup.sh` 会安装 Node/Python 依赖、运行解析测试和正式构建、生成样例 PDF，并用临时数据目录完成接口自检；不会向正式验证数据预置项目。再次自检可运行 `node scripts/smoke-local.mjs`。需要更换端口时设置 `CADLINT_PORT`，例如 `CADLINT_PORT=3200 ./scripts/local-start.sh`。

可创建产品类别和项目，上传 PDF、查看项目图纸列表与预览。选择图纸后点击“分析矢量内容”，应用会复用仓库中的 Python POC 脚本，记录每页路径绘制、文字操作、XObject 调用数量及文件校验值。没有明确矢量操作的页面标记为“待确认”。这里是 PDF 内容流清单，不是 CAD 几何、尺寸或标注检查结论；规则执行、DeepSeek 接口和账号权限将在后续批次接入。

本地验证数据保存在 `.local-verification/data/`，每次分析输出单独保存在 `analysis/<图纸 ID>/<执行 ID>/`；也可通过 `CADLINT_DATA_DIR` 指定其他目录。Python 可执行文件默认使用 `backend/.venv/bin/python`，也可通过 `CADLINT_PYTHON` 覆盖。当前文件存储适用于单实例验证；生产部署需替换为数据库与文件存储。

应用方案见 [application-solution.md](application-solution.md)。
