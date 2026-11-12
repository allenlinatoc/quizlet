import { db } from './store';
import type { PdfConfig } from '../shared/pdf';

type LocalSettings = NonNullable<PdfConfig['local']>;
type Extraction = { state:string; task_id:string|null; text:string|null };

export function localSettings(): LocalSettings {
  const strategy = process.env.TEXT_EXTRACT_OCR_STRATEGY || 'easyocr';
  const language = process.env.TEXT_EXTRACT_LANGUAGE || 'en';
  const model = process.env.TEXT_EXTRACT_OLLAMA_MODEL || 'llama3.1';
  if (!['easyocr', 'llama_vision', 'minicpm_v', 'remote'].includes(strategy) || !/^[a-zA-Z,-]{1,40}$/.test(language) || !/^[a-zA-Z0-9_.:/-]{1,120}$/.test(model)) throw new Error('Invalid local PDF extraction settings');
  return { url:serviceUrl(), strategy, language, model };
}

function serviceUrl(): string {
  const raw = process.env.TEXT_EXTRACT_API_URL;
  if (!raw) throw new Error('Configure TEXT_EXTRACT_API_URL for local PDF extraction');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname!=='/') throw new Error('TEXT_EXTRACT_API_URL must be a service origin without credentials or a path');
  return url.toString().replace(/\/$/, '');
}
function timeout(name:string, fallback:number):number {
  const value=Number(process.env[name] || fallback);
  if (!Number.isFinite(value) || value < 100 || value > 3_600_000) throw new Error(`Invalid ${name}`);
  return value;
}
async function api(base:string,path:string, init:RequestInit={}):Promise<Record<string,unknown>> {
  const response=await fetch(`${base}${path}`, {...init, signal:AbortSignal.timeout(timeout('TEXT_EXTRACT_REQUEST_TIMEOUT_MS',120000))});
  if (!response.ok) throw new Error(`Text extraction service returned HTTP ${response.status}`);
  const data:unknown=await response.json();
  if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('Invalid response from text extraction service');
  return data as Record<string,unknown>;
}
const get=(job:string,page:number)=>db.prepare('SELECT state,task_id,text FROM pdf_job_extractions WHERE job_id=? AND page=?').get(job,page) as Extraction|undefined;
const put=(job:string,page:number,state:string,task:string|null,text:string|null)=>db.prepare('INSERT INTO pdf_job_extractions(job_id,page,state,task_id,text) VALUES(?,?,?,?,?) ON CONFLICT(job_id,page) DO UPDATE SET state=excluded.state,task_id=excluded.task_id,text=excluded.text').run(job,page,state,task,text);

export class LocalPaused extends Error {}

// Called only after the user explicitly accepts retrying uncertain local work.
export function retryLocal(job:string) {
  db.prepare("DELETE FROM pdf_job_extractions WHERE job_id=? AND state IN ('submitting','failed')").run(job);
}

export async function extractPage(job:string,page:number,pdf:Buffer,settings:LocalSettings,active:()=>boolean):Promise<string> {
  let entry=get(job,page);
  if (entry?.state==='done' && entry.text!==null) return entry.text;
  if (entry?.state==='submitting' || entry?.state==='failed') throw new Error(`Page ${page}: previous submission has an uncertain outcome; confirm retry`);
  if (!entry) {
    const form=new FormData();
    form.append('file',new Blob([new Uint8Array(pdf)],{type:'application/pdf'}),`page-${page}.pdf`);
    form.append('strategy',settings.strategy); form.append('language',settings.language); form.append('model',settings.model);
    form.append('ocr_cache','false'); form.append('storage_profile','');
    put(job,page,'submitting',null,null);
    const result=await api(settings.url,'/ocr/upload',{method:'POST',body:form});
    if(typeof result.task_id!=='string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(result.task_id)) throw new Error(`Page ${page}: service did not return a valid task ID`);
    put(job,page,'pending',result.task_id,null);
    entry=get(job,page)!;
  }
  const started=Date.now(), limit=timeout('TEXT_EXTRACT_TASK_TIMEOUT_MS',900000), interval=timeout('TEXT_EXTRACT_POLL_INTERVAL_MS',2000);
  while (Date.now()-started<limit) {
    if(!active()) throw new LocalPaused('Paused; the remote OCR task may still finish.');
    const result=await api(settings.url,`/ocr/result/${encodeURIComponent(entry.task_id!)}`);
    if(result.state==='SUCCESS') {
      if(typeof result.result!=='string' || result.result.length>2_000_000) throw new Error(`Page ${page}: invalid or oversized OCR output`);
      put(job,page,'done',entry.task_id,result.result); return result.result;
    }
    if(result.state==='FAILURE' || result.state==='REVOKED') { put(job,page,'failed',entry.task_id,null); throw new Error(`Page ${page}: OCR task failed`); }
    if(!['PENDING','PROGRESS','STARTED','RETRY'].includes(String(result.state))) throw new Error(`Page ${page}: unknown OCR task state`);
    await new Promise(resolve=>setTimeout(resolve,interval));
  }
  throw new Error(`Page ${page}: OCR task did not finish before the timeout; retry to resume polling`);
}

export async function generateLocal(prompt:string,settings:LocalSettings):Promise<string> {
  if(prompt.length>300_000) throw new Error('Selected pages contain too much OCR text for a single batch; reduce the selection');
  const result=await api(settings.url,'/llm/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:settings.model,prompt})});
  if(typeof result.generated_text!=='string' || result.generated_text.length>2_000_000) throw new Error('Invalid or oversized local model output');
  return result.generated_text;
}
