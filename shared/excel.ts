export type ExcelIssue = { row?:number; column?:string; message:string };
export type ExcelPreview = { questionCount:number; skippedRows:number; preview:{row:number;type:string;prompt:string}[]; errors:ExcelIssue[]; errorCount:number };
