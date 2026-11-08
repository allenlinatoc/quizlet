import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { docText, type Question, type RichNode, type Session } from '../shared/types';
import { sanitizeMathML } from './math';

const allowedNodes = new Set(['doc','paragraph','text','hardBreak','bulletList','orderedList','listItem','image','math']);
const allowedMarks = new Set(['bold','italic','strike','code']);
export function validateDoc(value: unknown): asserts value is Question['prompt'] {
  let count = 0;
  function visit(input: unknown, depth: number) {
    if (!input || typeof input !== 'object' || depth > 16 || ++count > 5000) throw new Error('Invalid content document');
    const node = input as RichNode;
    if (!allowedNodes.has(node.type)) throw new Error(`Unsupported content: ${node.type}`);
    if (node.text !== undefined && (typeof node.text !== 'string' || node.text.length > 20000)) throw new Error('Invalid text');
    if (node.marks && (!Array.isArray(node.marks) || node.marks.some(m => !allowedMarks.has(m.type)))) throw new Error('Unsupported formatting');
    if (node.type === 'image' && (typeof node.attrs?.src !== 'string' || !/^\/api\/media\/[0-9a-f-]+$/.test(node.attrs.src) || typeof node.attrs?.alt !== 'string')) throw new Error('Images require a local upload and alternative text');
    if (node.type === 'math') { const latex=node.attrs?.latex, mathml=node.attrs?.mathml; if (typeof mathml === 'string' && mathml && sanitizeMathML(mathml)!==mathml) throw new Error('MathML must be sanitised'); if (!(typeof latex === 'string' && latex.length > 0 && latex.length <= 4000) && !(typeof mathml === 'string' && mathml.length > 0)) throw new Error('Invalid formula'); }
    if (node.content) { if (!Array.isArray(node.content)) throw new Error('Invalid content'); node.content.forEach(n => visit(n, depth + 1)); }
  }
  visit(value, 0);
  if ((value as RichNode).type !== 'doc') throw new Error('Invalid content document');
}
const id = z.string().uuid();
const questionShape = z.object({ id, type: z.enum(['single','multiple','boolean']), prompt: z.unknown(), explanation: z.unknown(), choices: z.array(z.object({ id, content: z.unknown() })).min(2).max(20), correctChoiceIds: z.array(id).min(1) });
export function validateQuestion(value: unknown): Question {
  const q = questionShape.parse(value);
  validateDoc(q.prompt); validateDoc(q.explanation);
  const hasContent = (doc: Question['prompt']) => !!docText(doc).trim() || /"type":"(?:image|math)"/.test(JSON.stringify(doc));
  for (const choice of q.choices) { validateDoc(choice.content); if (!hasContent(choice.content)) throw new Error('Each choice needs content'); }
  if (!hasContent(q.prompt)) throw new Error('A question needs a prompt');
  const ids = q.choices.map(c => c.id);
  if (new Set(ids).size !== ids.length || new Set(q.correctChoiceIds).size !== q.correctChoiceIds.length || q.correctChoiceIds.some(x => !ids.includes(x))) throw new Error('Invalid correct choices');
  if ((q.type !== 'multiple' && q.correctChoiceIds.length !== 1) || (q.type === 'boolean' && q.choices.length !== 2)) throw new Error('Select the appropriate correct answer');
  return q as Question;
}
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function isCorrect(q: Question, ids: string[]): boolean {
  return ids.length === q.correctChoiceIds.length && ids.every(id => q.correctChoiceIds.includes(id));
}
export function publicSession(s: Session) {
  const { questions, responses, ...rest } = s;
  return { ...rest, questions: questions.map(q => ({ id:q.id, type:q.type, prompt:q.prompt, choices:q.choices })), responses: responses.map(r => ({ questionId:r.questionId, choiceIds:r.choiceIds, ...(s.settings.showAnswers ? { correct:r.correct, correctChoiceIds:questions.find(q => q.id === r.questionId)?.correctChoiceIds, explanation:questions.find(q => q.id === r.questionId)?.explanation } : {}) })), ...(s.settings.showPoints ? { points:responses.filter(r => r.correct).length, total:questions.length } : {}) };
}
