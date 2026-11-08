export type RichDocument = { type: 'doc'; content: RichNode[] };
export type RichNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string }[]; content?: RichNode[] };
export type QuestionType = 'single' | 'multiple' | 'boolean';
export interface Choice { id: string; content: RichDocument }
export interface Question { id: string; type: QuestionType; prompt: RichDocument; choices: Choice[]; correctChoiceIds: string[]; explanation: RichDocument; }
export interface Settings { order: 'arranged' | 'random'; showAnswers: boolean; showPoints: boolean }
export interface Deck { id: string; name: string; settings: Settings; questions: Question[] }
export interface Response { questionId: string; choiceIds: string[]; correct: boolean }
export interface Session { id: string; deckId: string | null; deckName: string; status: 'active' | 'completed' | 'abandoned'; settings: Settings; questions: Question[]; responses: Response[]; cursor: number; startedAt: string; completedAt?: string }
export const emptyDoc = (): RichDocument => ({ type: 'doc', content: [{ type: 'paragraph' }] });
export const textDoc = (text: string): RichDocument => ({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] });
export const docText = (node: RichNode): string => (node.text || '') + (node.content || []).map(docText).join(node.type === 'doc' ? '\n' : '');
export const defaultSettings: Settings = { order: 'arranged', showAnswers: true, showPoints: true };
