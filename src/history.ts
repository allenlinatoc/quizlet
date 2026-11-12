import type { ResultSummary } from '../shared/types';

export type HistoryFilters = { deckId:string; period:string; score:string; sort:string };
export const defaultFilters:HistoryFilters = {deckId:'', period:'all', score:'all', sort:'newest'};
export function parseFilters(search:string):HistoryFilters {
  const params = new URLSearchParams(search);
  const pick = (key:string, values:string[], fallback:string) => {const value=params.get(key);return value && values.includes(value) ? value : fallback;};
  return {deckId:params.get('deckId') || '', period:pick('period',['all','7d','30d','90d'],'all'), score:pick('score',['all','low','middle','high'],'all'), sort:pick('sort',['newest','oldest','highest','lowest'],'newest')};
}
export function filterQuery(filters?:HistoryFilters):string {
  if (!filters) return '';
  const params=new URLSearchParams();
  for (const key of Object.keys(defaultFilters) as (keyof HistoryFilters)[]) if(filters[key] && filters[key]!==defaultFilters[key]) params.set(key,filters[key]);
  const query=params.toString(); return query ? `?${query}` : '';
}
export function filterResults(results:ResultSummary[], filters:HistoryFilters, now=new Date()):ResultSummary[] {
  const cutoff=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if (filters.period!=='all') cutoff.setDate(cutoff.getDate() - (Number.parseInt(filters.period,10)-1));
  const ratio=(r:ResultSummary)=>r.total>0 ? r.points/r.total : 0;
  const time=(r:ResultSummary)=>new Date(r.completedAt || r.startedAt).getTime() || 0;
  return results.filter(r=>{
    if(filters.deckId && (filters.deckId==='legacy' ? !!r.sourceDeckId : r.sourceDeckId!==filters.deckId)) return false;
    if(filters.period!=='all' && time(r)<cutoff.getTime()) return false;
    const score=ratio(r);
    return filters.score==='all' || (filters.score==='low' && score<.5) || (filters.score==='middle' && score>=.5 && score<.8) || (filters.score==='high' && score>=.8 && score<=1);
  }).sort((a,b)=>{
    const score=filters.sort==='highest' ? ratio(b)-ratio(a) : filters.sort==='lowest' ? ratio(a)-ratio(b) : 0;
    const date=filters.sort==='oldest' ? time(a)-time(b) : time(b)-time(a);
    return score || date || a.id.localeCompare(b.id);
  });
}
