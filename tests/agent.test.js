import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runAgent } from '../src/agent.js';
import { createTools } from '../src/tools.js';
import { mockDecision, ollama } from '../src/model.js';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const documents = await read('../data/policies.json');
const run = (input, options={}) => runAgent({input, execute:createTools(documents, input.failTools), decide:mockDecision, ...options});
const cases = [
  ['01-answer','answered',null,['D05']],
  ['02-conflict','needs_confirmation','conflicting_sources',['D01','D02']],
  ['03-out-of-scope','incomplete','needs_information',[]],
  ['04-paraphrase','answered',null,['D03']],
  ['05-follow-up','answered',null,['D04']],
  ['06-tool-failure','incomplete','model_stopped',[]],
];
for (const [name,status,reason,ids] of cases) {
  test(name, async () => {
    const result = await run(await read('../examples/inputs/' + name + '.json'));
    assert.equal(result.status, status);
    assert.equal(result.reason, reason);
    assert.deepEqual(result.citations.map(c => c.id), ids);
    for (const citation of result.citations) {
      assert.equal(citation.quote, documents.find(doc => doc.id === citation.id).quote);
    }
    if (status !== 'answered') assert.equal(result.answer, null);
    if (name === '06-tool-failure') assert.equal(result.trace[1].result.ok, false);
  });
}

test('收到同主题第二份资料时，漏读也不能作答', async () => {
  const moves = [
    {action:'search', query:'差旅报销'},
    {action:'read', id:'D01'},
    {action:'answer', topic:'差旅报销期限'},
    {action:'read', id:'D02'},
    {action:'conflict', topic:'差旅报销期限'},
  ];
  const result = await run({question:'差旅报销期限？'}, {decide:async () => ({...moves.shift(), reason:'测试'})});
  assert.deepEqual(result.trace[2].result.pendingIds, ['D02']);
  assert.equal(result.reason, 'conflicting_sources');
  assert.deepEqual(result.citations.map(c => c.id), ['D01','D02']);
  assert.equal(result.answer, null);
});

test('资料内容变化时引用和答案都使用当前原文', async () => {
  const changed = documents.map(doc => doc.id === 'D03' ? {...doc, quote:'年假申请须至少提前 5 个工作日提交。'} : doc);
  const result = await run({question:'年假提前多久申请？'}, {execute:createTools(changed)});
  assert.equal(result.answer, changed.find(doc => doc.id === 'D03').quote);
});

test('执行达到上限返回未完成', async () => {
  const result = await run({question:'访客怎么登记？'}, {maxSteps:1});
  assert.equal(result.reason, 'step_limit');
  assert.equal(result.trace[0].nextAction, 'step_limit');
});

test('非法模型输出不会调用工具', async () => {
  const result = await run({question:'访客怎么登记？'}, {decide:async () => ({action:'constructor'})});
  assert.equal(result.reason, 'invalid_model_decision');
});

test('Ollama 适配器将工具观察交回模型后再决策', async () => {
  const replies = [
    {action:'search', query:'访客登记', reason:'找制度'},
    {action:'read', id:'D05', reason:'读取命中证据'},
    {action:'answer', topic:'访客登记', reason:'有原文'},
  ];
  let call = 0;
  const decide = ollama({
    url:'http://127.0.0.1:11434', model:'fixture', timeoutMs:1000,
    fetchImpl:async (url,options) => {
      assert.equal(url.pathname, '/api/chat');
      const {messages} = JSON.parse(options.body);
      const last = JSON.parse(messages.at(-1).content);
      if (call === 1) assert.equal(last.observation.hits[0].id, 'D05');
      if (call === 2) assert.equal(last.observation.doc.quote, documents[4].quote);
      return Response.json({message:{content:JSON.stringify(replies[call++])}});
    },
  });
  const result = await run({question:'访客怎么登记？'}, {decide});
  assert.equal(call, 3);
  assert.equal(result.status,'answered');
});
