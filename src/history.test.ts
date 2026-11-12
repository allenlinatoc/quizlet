import { describe, expect, it } from 'vitest';
import type { ResultSummary } from '../shared/types';
import { defaultFilters, filterQuery, filterResults, parseFilters } from './history';

const result = (id:string, sourceDeckId:string|null, points:number, total:number, completedAt:string):ResultSummary => ({id,deckId:sourceDeckId,sourceDeckId,deckName:'Same name',points,total,startedAt:completedAt,completedAt});
const rows=[result('a','deck-a',1,2,'2026-11-12T12:00:00'),result('b','deck-b',4,5,'2026-11-11T12:00:00'),result('c',null,0,1,'2026-10-01T12:00:00')];
describe('study history filters',()=>{
  it('filters by stable identity, score boundaries, and local calendar days',()=>{
    expect(filterResults(rows,{...defaultFilters,deckId:'deck-a'}).map(r=>r.id)).toEqual(['a']);
    expect(filterResults(rows,{...defaultFilters,deckId:'legacy'}).map(r=>r.id)).toEqual(['c']);
    expect(filterResults(rows,{...defaultFilters,score:'middle'}).map(r=>r.id)).toEqual(['a']);
    expect(filterResults(rows,{...defaultFilters,score:'high'}).map(r=>r.id)).toEqual(['b']);
    expect(filterResults(rows,{...defaultFilters,period:'7d'},new Date(2026,10,12,18)).map(r=>r.id)).toEqual(['a','b']);
  });
  it('round trips URL state and normalizes unsupported options',()=>{
    const filters={deckId:'deck-a',period:'30d',score:'high',sort:'oldest'};
    expect(parseFilters(filterQuery(filters))).toEqual(filters);
    expect(parseFilters('?period=no&score=no&sort=no')).toEqual(defaultFilters);
    expect(filterResults(rows,{...defaultFilters,deckId:'unknown'})).toEqual([]);
  });
});
