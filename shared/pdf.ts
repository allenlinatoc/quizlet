import type { Question } from './types';

export type PdfSection = { name: string; pages: number[] };
export type PdfConfig = { provider?: 'openai' | 'text-extract'; local?: { url: string; strategy: string; language: string; model: string }; mode: 'extract' | 'generate'; layout: 'combined' | 'sections'; sections: PdfSection[]; answerPages: number[]; target: number; difficulty: 'easy' | 'medium' | 'hard'; budget: number };
export type PdfDraft = { id: string; section: number; pages: number[]; question: Question; included: boolean; flags: string[]; figure?: { page: number; x: number; y: number; width: number; height: number; alt: string; assetId?: string } };
export type PdfBatch = { section: number; pages: number[]; status: 'pending' | 'running' | 'done' | 'uncertain'; error?: string; reserved?: number; stage?: 'ocr' | 'parse' };
export type PdfJob = { id: string; name: string; createdAt: string; pageCount: number; status: 'new' | 'running' | 'paused' | 'ready' | 'published'; config?: PdfConfig; batches: PdfBatch[]; drafts: PdfDraft[]; inputTokens: number; outputTokens: number; cost: number; uncertainCost: number; message?: string; deckIds: string[] };
