import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import yauzl from 'yauzl';
import JSZip from 'jszip';
import { validateQuestion } from './domain';
import { textDoc, type Question } from '../shared/types';
import type { ExcelIssue, ExcelPreview } from '../shared/excel';

const headers=['type','prompt','choice_a','choice_b','choice_c','choice_d','choice_e','choice_f','correct_answers','explanation'];
const MAX_EXPANDED=50*1024*1024;

// Read entries through a bounded stream before the workbook library sees the archive.
async function checkArchive(data:Buffer):Promise<void> {
  if(data.length>10*1024*1024 || data.length<4 || data.readUInt32LE(0)!==0x04034b50)throw new Error('Choose an unencrypted .xlsx workbook under 10 MiB');
  await new Promise<void>((resolve,reject)=>{
    yauzl.fromBuffer(data,{lazyEntries:true,validateEntrySizes:true},(err,zip)=>{
      if(err||!zip){reject(new Error('Invalid or encrypted Excel workbook'));return;}
      let size=0,count=0,finished=false; const names=new Set<string>();
      const fail=(message:string)=>{if(!finished){finished=true;zip.close();reject(new Error(message));}};
      zip.on('error',()=>fail('Invalid or encrypted Excel workbook'));
      zip.on('end',()=>{if(!finished){finished=true;resolve();}});
      zip.on('entry',entry=>{
        if(++count>1000 || entry.uncompressedSize>MAX_EXPANDED || size+entry.uncompressedSize>MAX_EXPANDED) return fail('Workbook is too large when expanded');
        const name=entry.fileName.replace(/\\/g,'/');
        if(names.has(name.toLowerCase()) || name.startsWith('/') || name.split('/').includes('..') || /(?:^|\/)vbaProject\.bin$/i.test(name) || /\.bin$/i.test(name) && /embeddings/i.test(name) || (entry.generalPurposeBitFlag&1)) return fail('Unsupported or unsafe workbook content');
        names.add(name.toLowerCase());
        zip.openReadStream(entry,(error,stream)=>{
          if(error||!stream)return fail('Could not read Excel workbook');
          let length=0;const chunks:Buffer[]=[];const xml=/\.(xml|rels)$/i.test(name);
          stream.on('data',(chunk:Buffer)=>{length+=chunk.length;size+=chunk.length;if(size>MAX_EXPANDED || length>entry.uncompressedSize){stream.destroy();fail('Workbook is too large when expanded');return;}if(xml)chunks.push(chunk);});
          stream.on('error',()=>fail('Invalid workbook entry'));
          stream.on('end',()=>{
            if(finished)return;
            if(xml){const content=Buffer.concat(chunks).toString('utf8');if(content.includes('\0') || /<!\s*(?:DOCTYPE|ENTITY)/i.test(content) || (/\.rels$/i.test(name)&&/TargetMode\s*=\s*['"]External['"]/i.test(content)))return fail('External links and XML entities are not supported');
              if(/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)){
                for(const match of content.matchAll(/<(?:\w+:)?(?:row|c|dimension)\b[^>]*\b(?:r|ref)\s*=\s*['"]([^'"]+)/gi)){for(const ref of match[1].split(':')){const m=/^([A-Z]*)(\d+)$/i.exec(ref);if(m){let col=0;for(const c of m[1].toUpperCase())col=col*26+c.charCodeAt(0)-64;if(Number(m[2])>10000 || col>100)return fail('Worksheet exceeds 10,000 rows or 100 columns');}}}
              }
            }
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

export async function parseExcel(data:Buffer, filename:string):Promise<{result:ExcelPreview;questions:Question[]}> {
  if(!/\.xlsx$/i.test(filename))throw new Error('Choose an .xlsx workbook from the Excel template');
  await checkArchive(data);
  const book=new ExcelJS.Workbook();
  try {
    // ExcelJS does not recognize a prefixed SpreadsheetML root, which is valid
    // OOXML and is emitted by the bundled template generator. Normalize only
    // that namespace after the archive has passed bounded streaming checks.
    const archive=await JSZip.loadAsync(data);let changed=false;
    for(const [name,entry] of Object.entries(archive.files))if(!entry.dir && /^xl\/(workbook|styles|sharedStrings|worksheets\/sheet\d+)\.xml$/i.test(name)){
      const xml=await entry.async('string');
      if(xml.includes('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')){
        archive.file(name,xml.replace('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"','xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace(/(<\/?)(x:)/g,'$1'));changed=true;
      }
    }
    const input=changed?await archive.generateAsync({type:'nodebuffer'}):data;
    await book.xlsx.load(input as unknown as ExcelJS.Buffer);
  } catch { throw new Error('The Excel workbook is damaged, encrypted, or unsupported'); }
  const sheet=book.getWorksheet('Questions');
  if(!sheet || sheet.state!=='visible')throw new Error('The workbook must contain a visible Questions sheet');
  if(sheet.rowCount>10000 || sheet.columnCount>100)throw new Error('Worksheet exceeds 10,000 rows or 100 columns');
  const headerMap=new Map<string,number>();
  sheet.getRow(1).eachCell({includeEmpty:false},(cell,col)=>{
    if(typeof cell.value!=='string')throw new Error(`Questions row 1, column ${col}: headers must be text`);
    const key=cell.value.trim().toLowerCase();if(!headers.includes(key))throw new Error(`Questions row 1: unknown header ${key}`);if(headerMap.has(key))throw new Error(`Questions row 1: duplicate header ${key}`);headerMap.set(key,col);
  });
  for(const h of headers)if(!headerMap.has(h))throw new Error(`Questions row 1: missing header ${h}`);
  const issues:ExcelIssue[]=[],questions:Question[]=[],preview:ExcelPreview['preview']=[];let errorCount=0,skippedRows=0,populated=0,pendingBlanks=0;
  const issue=(row:number,column:string,message:string)=>{errorCount++;if(issues.length<100)issues.push({row,column,message});};
  for(let n=2;n<=sheet.rowCount;n++){
    const row=sheet.getRow(n); const vals:Record<string,string>={};let bad=false,hasData=false;
    row.eachCell({includeEmpty:false},(cell,col)=>{if(![...headerMap.values()].includes(col) && cell.value!==null){hasData=true;bad=true;issue(n,cell.address.replace(/\d+$/,''),'Unexpected value outside the template columns');}});
    for(const h of headers){const value=row.getCell(headerMap.get(h)!).value;if(value===null || value===undefined){vals[h]='';continue;}hasData=true;if(typeof value!=='string'){issue(n,h,'Use plain text, not a formula, number, rich text or other cell type');bad=true;vals[h]='';}else {vals[h]=value.trim();if(vals[h].length>20000){issue(n,h,'Text exceeds 20,000 characters');bad=true;}}}
    if(!hasData){pendingBlanks++;continue;} skippedRows+=pendingBlanks;pendingBlanks=0;if(++populated>1000)throw new Error('A workbook may contain at most 1,000 questions');
    const add=(col:string,msg:string)=>{bad=true;issue(n,col,msg)};
    if(!['single','multiple','boolean'].includes(vals.type))add('type','Use single, multiple or boolean');
    if(!vals.prompt)add('prompt','Enter question text');
    const choices=['a','b','c','d','e','f'].map(x=>vals[`choice_${x}`]);
    if(!choices[0]||!choices[1])add('choice_a / choice_b','Enter at least two choices');
    let gap=false;for(let i=0;i<choices.length;i++){if(!choices[i])gap=true;else if(gap)add(`choice_${'abcdef'[i]}`,'Fill choices consecutively without gaps');}
    if(vals.type==='boolean' && (choices[0].toLowerCase()!=='true'||choices[1].toLowerCase()!=='false'||choices.slice(2).some(Boolean)))add('type','Boolean questions need True, False and no other choices');
    const answer=vals.correct_answers.toUpperCase(); const labels=answer.split(',').map(x=>x.trim());
    if(!/^[A-F](\s*,\s*[A-F])*$/i.test(answer) || new Set(labels).size!==labels.length || labels.some(x=>!choices[x.charCodeAt(0)-65]))add('correct_answers','Enter distinct populated choice letters, for example A or A,C');
    if(vals.type!=='multiple' && labels.length!==1)add('correct_answers','This question type needs exactly one correct answer');
    if(bad)continue;
    const mapped=choices.filter(Boolean).map(content=>({id:randomUUID(),content:textDoc(content)}));
    const q=validateQuestion({id:randomUUID(),type:vals.type,prompt:textDoc(vals.prompt),choices:mapped,correctChoiceIds:labels.map(x=>mapped[x.charCodeAt(0)-65].id),explanation:textDoc(vals.explanation)});
    questions.push(q); if(preview.length<100)preview.push({row:n,type:vals.type,prompt:vals.prompt.slice(0,500)});
  }
  if(!populated)throw new Error('The Questions sheet has no questions');
  return {questions,result:{questionCount:questions.length,skippedRows,preview,errors:issues,errorCount}};
}
