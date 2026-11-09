# 

运行时的真实模型模式由本地 Qwen3 选择动作，Mock 是确定性的测试替身。

## 候选人亲自验证

* 在 Windows PowerShell 中执行 Node.js 测试，11 项通过，0 项失败。测试运行器报告耗时 85.555 毫秒。
* 使用本机 Ollama 的 Qwen3:8B 实际运行冲突样例（examples/inputs/02-conflict.json）。结果为 needs\_confirmation，未给出单一答案，同时引用 D01 的 30 个自然日与 D02 的 15 个自然日。Trace 显示模型先检索，再逐份读取两条制度原文，最后报告冲突并请用户确认适用范围或优先级。
* 候选人实际投入时间：85.555 ms。上面的自动测试耗时仅是程序运行时间。

