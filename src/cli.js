import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { runAgent } from './agent.js';
import { createTools } from './tools.js';
import { mockDecision, ollama } from './model.js';

const { values } = parseArgs({options:{
  input:{type:'string'}, mode:{type:'string', default:'ollama'},
  data:{type:'string'}, 'max-steps':{type:'string', default:'8'},
}});
try {
  if (!values.input || !['mock','ollama'].includes(values.mode)) {
    throw new Error('用法：npm start -- --mode mock|ollama --input <JSON 文件>');
  }
  const input = JSON.parse(await readFile(values.input, 'utf8'));
  const dataPath = values.data ?? new URL('../data/policies.json', import.meta.url);
  const documents = JSON.parse(await readFile(dataPath, 'utf8'));
  const model = process.env.OLLAMA_MODEL ?? 'qwen3:8b';
  const decide = values.mode === 'mock' ? mockDecision : ollama({
    url:process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434',
    model, timeoutMs:Number(process.env.MODEL_TIMEOUT_MS ?? 120000),
  });
  const result = await runAgent({
    input, decide, execute:createTools(documents, input.failTools),
    maxSteps:Number(values['max-steps']),
  });
  console.log(JSON.stringify({mode:values.mode, model:values.mode === 'ollama' ? model : null, ...result}, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
