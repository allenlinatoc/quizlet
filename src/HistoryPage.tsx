import React from 'react';
import { ArrowRight, Clock3, Trash2 } from 'lucide-react';
import type { ResultSummary } from '../shared/types';
import { defaultFilters, filterResults, type HistoryFilters } from './history';

type Deck = {id:string;name:string};
type Props = {results:ResultSummary[]; decks:Deck[]; filters:HistoryFilters; busy:boolean; onFilters:(filters:HistoryFilters)=>void; onResult:(id:string)=>void; onDeck:(id:string)=>void; onDelete:(result:ResultSummary)=>void; onHome:()=>void};
export default function History({results,decks,filters,busy,onFilters,onResult,onDeck,onDelete,onHome}:Props) {
  const visible=filterResults(results,filters);
  const options=new Map<string,string>();
  for(const result of results) if(result.sourceDeckId) options.set(result.sourceDeckId, result.deckId ? result.deckName : `${result.deckName} (deleted)`);
  for(const deck of decks) options.set(deck.id,deck.name);
  if(filters.deckId && filters.deckId!=='legacy' && !options.has(filters.deckId)) options.set(filters.deckId,'Unavailable deck');
  const update=(key:keyof HistoryFilters,value:string)=>onFilters({...filters,[key]:value});
  return <><section className="page-heading"><div><div className="eyebrow"><span/> YOUR PROGRESS</div><h1>Every session <em>counts.</em></h1><p>Look back at how far you’ve come.</p></div></section>
    <div className="section-title"><div><h2>Study history <span className="count-badge">{visible.length} / {results.length}</span></h2><p>Your completed practice sessions.</p></div></div>
    <div className="history-filters">
      <label>Quiz Deck<select value={filters.deckId} onChange={e=>update('deckId',e.target.value)}><option value="">All decks</option>{[...options].sort((a,b)=>a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])).map(([id,name])=><option key={id} value={id}>{name}</option>)}<option value="legacy">Older deleted decks</option></select></label>
      <label>Completed<select value={filters.period} onChange={e=>update('period',e.target.value)}><option value="all">All time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select></label>
      <label>Score<select aria-label="Score" value={filters.score} onChange={e=>update('score',e.target.value)}><option value="all">All scores</option><option value="low">Below 50%</option><option value="middle">50% to below 80%</option><option value="high">80% to 100%</option></select></label>
      <label>Sort<select value={filters.sort} onChange={e=>update('sort',e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest score</option><option value="lowest">Lowest score</option></select></label>
      <button className="text-button" onClick={()=>onFilters(defaultFilters)}>Clear filters</button>
    </div>
    {filters.deckId==='legacy'&&<p className="history-note">Older deleted decks cannot be identified individually.</p>}
    {visible.length?<div className="history-list">{visible.map(r=><div className="history-row" key={r.id}>
      <div className="stat-icon lavender"><Clock3 size={20}/></div><button className="history-name history-open" onClick={()=>onResult(r.id)} aria-label={`View result for ${r.deckName}`}><strong>{r.deckName}</strong><span>{new Date(r.completedAt || r.startedAt).toLocaleDateString()} · {r.total} {r.total===1?'question':'questions'}</span></button>
      <div className="history-score"><strong>{r.total ? Math.round(r.points/r.total*100) : 0}%</strong><span>{r.points} / {r.total} points</span></div>
      <div className="history-actions">{r.deckId && decks.some(d=>d.id===r.deckId)?<button className="text-button" onClick={()=>onDeck(r.deckId!)}>View Quiz Deck</button>:<span>Deleted deck</span>}<button className="icon-button danger" disabled={busy} aria-label={`Delete history for ${r.deckName}`} onClick={()=>onDelete(r)}><Trash2 size={18}/></button><button className="icon-button" aria-label={`View result for ${r.deckName}`} onClick={()=>onResult(r.id)}><ArrowRight size={18}/></button></div>
    </div>)}</div>:<div className="empty-state"><div className="empty-art"><Clock3 size={30}/></div><h3>{results.length?'No matching study history':'Your progress will live here'}</h3><p>{results.length?'Try changing or clearing your filters.':'Complete a practice session to see your results and review your answers.'}</p><button className="button primary" onClick={results.length?()=>onFilters(defaultFilters):onHome}>{results.length?'Clear filters':'Explore your decks'}</button></div>}
  </>;
}
