export function createTools(documents, fail = []) {
  const normalize = text => text.toLowerCase().normalize('NFKC').replace(/[\s\p{P}]/gu, '');
  const byId = new Map(documents.map(doc => [doc.id, doc]));
  if (byId.size !== documents.length) throw new Error('文档 ID 重复');
  const failure = new Set(fail);
  return (action, args) => {
    if (failure.has(action)) return { ok: false, error: '模拟工具故障' };
    if (action === 'read') {
      const doc = byId.get(args.id);
      return doc ? { ok: true, doc } : { ok: false, error: '文档不存在' };
    }
    const query = normalize(args.query);
    const matches = documents.map(doc => ({
      doc,
      score: [doc.topic, ...doc.terms].reduce((score, term) => {
        const token = normalize(term);
        return score + (query.includes(token) ? token.length : 0);
      }, 0),
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    const topics = new Set(matches.slice(0, 5).map(({doc}) => doc.topic));
    // 同主题证据一起返回，避免取前 N 条时把反例截掉。
    return {
      ok: true,
      hits: documents.filter(doc => topics.has(doc.topic)).map(({id, date, topic}) => ({id, date, topic})),
    };
  };
}
