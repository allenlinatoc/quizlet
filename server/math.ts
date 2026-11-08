import { XMLParser, XMLValidator } from 'fast-xml-parser';

type XmlNode = Record<string, any>;
const elements = new Set(['math','mrow','mi','mn','mo','mtext','mspace','ms','mfrac','msqrt','mroot','msub','msup','msubsup','munder','mover','munderover','mtable','mtr','mtd','semantics','annotation']);
const attributes = new Set(['display','mathvariant','mathsize','mathcolor','mathbackground','stretchy','fence','separator','accent','accentunder','encoding','columnalign','rowalign','columnspacing','rowspacing','linethickness','width','height','depth','form','symmetric','largeop','movablelimits']);
const escape = (value:string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function sanitizeMathML(xml:string):string {
  if (xml.length > 100_000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml)!==true) throw new Error('Invalid MathML formula');
  const nodes = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',preserveOrder:true,removeNSPrefix:true,parseTagValue:false,trimValues:false}).parse(xml) as XmlNode[];
  let count=0;
  function serialize(node:XmlNode, depth:number):string {
    if (depth>32 || ++count>3000) throw new Error('Formula is too complex');
    if (node['#text'] !== undefined) return escape(String(node['#text']));
    const tag=Object.keys(node).find(k=>k!==':@');if(!tag || !elements.has(tag)) throw new Error(`Unsupported MathML element: ${tag || 'unknown'}`);
    const attrs=Object.entries(node[':@'] || {}).map(([key,value])=>{if(key==='xmlns')return '';if(!attributes.has(key) || !/^[\w\s.,%+\-#()/]*$/.test(String(value)))throw new Error(`Unsupported MathML attribute: ${key}`);return ` ${key}="${escape(String(value))}"`}).join('');
    return `<${tag}${tag==='math'?' xmlns="http://www.w3.org/1998/Math/MathML"':''}${attrs}>${(node[tag] as XmlNode[]).map(n=>serialize(n,depth+1)).join('')}</${tag}>`;
  }
  if (nodes.length!==1 || !nodes[0].math) throw new Error('A formula must contain one MathML root');
  return serialize(nodes[0],0);
}
