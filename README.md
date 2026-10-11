# CADLint

矢量 PDF 图纸检查应用。已实现产品类别、项目、图纸、PDF 内容流分析、按类别发布的输入质量规则，以及项目内的可执行流程，沿用 AutoReg 的 Next.js 15、React 19、TypeScript 技术栈。原有 NX PDF 检查脚本保留在 `nx-pdf-drawing-inspection/`。

## 本地运行

需要 Node.js 20+、Python 3.9+ 和 npm。

```bash
./scripts/local-setup.sh
./scripts/local-start.sh
```

打开 `http://127.0.0.1:3100`。首次进入没有预置项目；先通过页眉创建产品类别，再创建项目。可从 `.local-verification/samples/` 上传 `vector-line.pdf` 和 `blank-page.pdf`，比较分析结果。按 `Ctrl+C` 停止服务。页面支持中文与英文。

`local-setup.sh` 会安装 Node/Python 依赖、运行解析测试和正式构建、生成样例 PDF，并用临时数据目录完成接口自检；不会向正式验证数据预置项目。再次自检可运行 `node scripts/smoke-local.mjs`。需要更换端口时设置 `CADLINT_PORT`，例如 `CADLINT_PORT=3200 ./scripts/local-start.sh`。

如需在“问题复核”页生成 DeepSeek 建议，在启动服务前设置服务端环境变量 `DEEPSEEK_API_KEY`；可参考 `frontend/.env.example`，模型可通过 `DEEPSEEK_MODEL` 调整。浏览器只接收配置状态与建议，不会收到密钥。未配置时仍可使用规则检查和人工复核。接口自检使用本地模拟服务，不会调用真实 DeepSeek API。

可创建产品类别和项目，上传 PDF、查看项目图纸列表与预览。选择图纸后点击“分析矢量内容”，应用会复用仓库中的 Python POC 脚本，记录每页路径绘制、文字操作、XObject 调用数量、已绘制路径的页面坐标范围及文件校验值。在“产品类别与规则”中可编辑草稿、发布版本；同类别项目复用最新发布版本。在“检查任务”中可以对已分析图纸单独运行输入质量检查。

项目内“流程”页可配置已有分析结果是否复用、何时进行人工复核，保存草稿并发布流程版本。运行流程会依次执行 PDF 分析、类别输入质量规则和可选的人工复核；运行记录固定流程、规则及 PDF 版本，解析失败也有节点状态记录。流程级复核可记录“确认完成”或“需处理”。“问题复核”页进一步针对每条待确认结果记录判断、备注和追加式历史，展示原始 PDF 页及同页路径范围定位图；坐标已考虑页面裁剪和 0/90/180/270 度旋转，但定位图只显示内容流中可直接识别的路径（最多前 200 个区域），不解析 Form XObject 内部路径、文字边界或 CAD 对象，也不是完整 PDF 渲染。“报告”页可针对一次检查生成不可变的输入质量快照，查看当时的逐项判断，打开可打印 HTML 或下载 HTML。重新生成报告会产生新快照，旧报告不随复核变化。规则原始结果保持不变。

当前流程只有这三个已接入节点，并非完整 CAD 语义检查流程；未达到输入质量阈值的结果标记“待人工确认”，不能视为 CAD 几何、尺寸或标注不合格。DeepSeek 已接入单条输入质量复核建议，真实密钥联调、其他 AI 场景、CAD 语义规则和账号权限仍待后续批次完成。

本地验证数据保存在 `.local-verification/data/`，每次分析输出单独保存在 `analysis/<图纸 ID>/<执行 ID>/`；也可通过 `CADLINT_DATA_DIR` 指定其他目录。Python 可执行文件默认使用 `backend/.venv/bin/python`，也可通过 `CADLINT_PYTHON` 覆盖。流程、规则、复核和报告目前保存在本地 JSON 数据库，适用于单实例验证；生产部署需替换为数据库、文件存储和可靠任务队列，并加入身份权限、操作者身份记录与发布审批。

应用方案见 [application-solution.md](application-solution.md)。
