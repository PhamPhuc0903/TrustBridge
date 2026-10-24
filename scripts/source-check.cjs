/** Syntax + local-import checker. Full TS typechecking is performed by npm run build. */
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
let ts;
try{ts=require('typescript');}catch{
  try{ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}catch{}
}
if(!ts){console.error('TypeScript compiler missing. Run npm install and retry.');process.exit(2);}
const files=[];
function walk(folder){for(const d of fs.readdirSync(folder,{withFileTypes:true})){
  const full=path.join(folder,d.name);
  if(d.isDirectory())walk(full);
  else if(/\.tsx?$/.test(d.name))files.push(full);
}}
walk(path.join(root,'client/src'));walk(path.join(root,'server/src'));walk(path.join(root,'server/prisma'));walk(path.join(root,'server/tests'));
let diagnostics=0,imports=0;
for(const file of files){
  const content=fs.readFileSync(file,'utf8');
  const output=ts.transpileModule(content,{fileName:file,reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
      experimentalDecorators:true,emitDecoratorMetadata:true,jsx:ts.JsxEmit.ReactJSX}});
  for(const e of output.diagnostics||[]){if(e.category===ts.DiagnosticCategory.Error){
    console.error(`${path.relative(root,file)}: ${ts.flattenDiagnosticMessageText(e.messageText,' ')}`);diagnostics++;
  }}
  const src=ts.createSourceFile(file,content,ts.ScriptTarget.ES2022,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  for(const n of src.statements){if(!ts.isImportDeclaration(n)||!n.moduleSpecifier||!ts.isStringLiteral(n.moduleSpecifier))continue;
    const spec=n.moduleSpecifier.text;if(!spec.startsWith('.'))continue;
    const expected=path.resolve(path.dirname(file),spec);
    assert(['','.ts','.tsx','.js','.json','/index.ts','/index.tsx'].some(ext=>fs.existsSync(expected+ext)),
      `Missing local import in ${path.relative(root,file)}: ${spec}`);
    imports++;
  }
}
assert.equal(diagnostics,0,`${diagnostics} syntax errors found`);
console.log(`[PASS] Parsed ${files.length} TS/TSX files and resolved ${imports} relative imports (syntax only).`);
