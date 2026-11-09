import { SYSTEM } from './model.js';

const fields = { search:'query', read:'id', answer:'topic', conflict:'topic', clarify:'message', stop:'message' };
const incomplete = (reason, trace, gaps = []) => ({status:'incomplete', answer:null, citations:[], gaps, reason, trace});

export async function runAgent({ input, decide, execute, maxSteps = 8 }) {
  const { question, history = [] } = input;
  if (typeof question !== 'string' || !question.trim()) return incomplete('missing_question', [], ['请提供问题。']);
  if (!Array.isArray(history) || history.some(item => !['user','assistant'].includes(item?.role) || typeof item.content !== 'string')) {
    return incomplete('invalid_history', []);
  }
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 16) throw new Error('步数上限必须为 1–16 的整数');
  const messages = [{role:'system', content:SYSTEM}, {role:'user', content:JSON.stringify({conversation_before_question:history, current_question:question})}];
  const observations = [];
  const trace = [];
  const found = new Map();
  const read = new Map();

  for (let step = 1; step <= maxSteps; step++) {
    let decision;
    try {
      decision = await decide(messages, {question, history, observations});
    } catch (error) {
      trace.push({step, action:'model_error', reason:error.message, nextAction:'end'});
      return incomplete('model_failure', trace);
    }
    const action = decision?.action;
    const field = Object.hasOwn(fields, action) ? fields[action] : undefined;
    const value = decision?.[field];
    if (!field || typeof value !== 'string' || !value.trim() || value.length > 500 || typeof decision.reason !== 'string' || !decision.reason.trim()) {
      trace.push({step, action:'invalid_decision', nextAction:'end'});
      return incomplete('invalid_model_decision', trace);
    }

    if (trace.length) trace.at(-1).nextAction = action;
    const entry = {step, action, args:{[field]:value}, reason:decision.reason.slice(0, 180), nextAction:'end'};
    trace.push(entry);

    if (action === 'search' || action === 'read') {
      const result = action === 'read' && !found.has(value)
        ? {ok:false, error:'只能读取已检索到的文档 ID'}
        : await execute(action, entry.args);
      if (action === 'search' && result.ok) for (const hit of result.hits) found.set(hit.id, hit);
      if (action === 'read' && result.ok) read.set(result.doc.id, result.doc);
      entry.result = result.ok && action === 'read'
        ? {ok:true, id:result.doc.id, topic:result.doc.topic, snippet:result.doc.quote}
        : result;
      entry.nextAction = 'model';
      observations.push({action, result});
      messages.push({role:'assistant', content:JSON.stringify(decision)});
      messages.push({role:'user', content:JSON.stringify({tool:action, observation:result})});
      continue;
    }

    if (action === 'clarify' || action === 'stop') {
      return incomplete(action === 'clarify' ? 'needs_information' : 'model_stopped', trace, [value]);
    }
    const relevant = [...found.values()].filter(hit => hit.topic === value);
    if (!relevant.length) {
      return incomplete('unverified_sources', trace, ['缺少该主题的已核对原文。']);
    }
    const pendingIds = relevant.filter(hit => !read.has(hit.id)).map(hit => hit.id);
    if (pendingIds.length) {
      const result = {ok:false, error:'evidence_required', pendingIds};
      entry.result = result;
      entry.nextAction = 'model';
      messages.push({role:'assistant', content:JSON.stringify(decision)});
      messages.push({role:'user', content:JSON.stringify({guard:result})});
      continue;
    }
    const citations = relevant.map(({id}) => {
      const {date, quote} = read.get(id);
      return {id, date, quote};
    });
    // 这个合成库的同主题片段是完整条款；不同文本一律保守标冲突。
    const conflict = new Set(citations.map(item => item.quote)).size > 1;
    if (action === 'conflict' && !conflict) return incomplete('unsupported_conflict', trace);
    if (conflict) return {
      status:'needs_confirmation', answer:null, citations, reason:'conflicting_sources',
      gaps:['请确认适用制度的范围或优先级。'], trace,
    };
    return {status:'answered', answer:citations[0].quote, citations, gaps:[], reason:null, trace};
  }
  trace.at(-1).nextAction = 'step_limit';
  return incomplete('step_limit', trace);
}
