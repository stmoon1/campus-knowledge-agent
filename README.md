# 企业知识问答 Agent

小影科技 2027 校招 AI Agent 笔试 · 第 3 题。

面向员工制度查询。程序在本地合成制度库中检索和读取原文，回答附文档 ID、版本日期与引文。制度冲突时列出双方证据并请用户确认适用范围。

## 运行

需要 Node.js 22 或更新版本。项目没有第三方 Node.js 依赖，无需安装 npm 包。

```powershell
node --test
node src/cli.js --mode mock --input examples/inputs/01-answer.json
node src/cli.js --mode mock --input examples/inputs/02-conflict.json
```

真实模型模式需要本机 Ollama。可用已有模型，或在 Ollama 中拉取 `qwen3:8b`。如果 Ollama 已运行，直接执行下方命令。默认连接 127.0.0.1:11434，参数见 `.env.example`。

```powershell
Copy-Item .env.example .env
node --env-file=.env src/cli.js --mode ollama --input examples/inputs/01-answer.json
node --env-file=.env src/cli.js --mode ollama --input examples/inputs/02-conflict.json
```

`--data <JSON>` 可替换合成制度库；`--max-steps 8` 可设置决策步数上限（1–16）。输入字段 `question` 为问题，`history` 为可选的 user/assistant 历史，`failTools` 只用于测试故障。

## 评审入口

- [需求与验收标准](docs/01-requirements.md)
- [动作循环、证据校验及设计取舍](docs/02-solution.md)
- [实际运行结果与限制](docs/03-evaluation.md)
- [AI 辅助记录](docs/04-ai-usage.md)
- [复盘](docs/05-retrospective.md)
- [六组输入](examples/inputs) · [离线输出](examples/mock) · [真实模型 Trace](examples/ollama) · [测试日志](examples/test-results.tap)

```powershell
node scripts/capture.js mock
node --env-file-if-exists=.env scripts/capture.js ollama
```

第二条命令逐组保存实际模型输出与 Trace。Mock 仅供验证运行器和工具。真实模型失败时保留错误状态，不自动切换 Mock。Ollama 接入参照 [Ollama Chat API](https://docs.ollama.com/api/chat)。
