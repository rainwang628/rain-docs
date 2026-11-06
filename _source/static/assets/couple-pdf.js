/* Local-only PDF export. Answers never leave the browser for conversion. */
(function(root){
'use strict';
function packPdf(images){
 const encoder=new TextEncoder(),chunks=[],offsets=[0];let size=0;
 const add=x=>{const b=typeof x==='string'?encoder.encode(x):x;chunks.push(b);size+=b.length;};
 const object=(id,body)=>{offsets[id]=size;add(id+' 0 obj\n');add(body);add('\nendobj\n');};
 add('%PDF-1.4\n');
 object(1,'<< /Type /Catalog /Pages 2 0 R >>');
 object(2,'<< /Type /Pages /Count '+images.length+' /Kids ['+images.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>');
 images.forEach((bytes,i)=>{
  const id=3+i*3;
  object(id,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 '+(id+1)+' 0 R >> >> /Contents '+(id+2)+' 0 R >>');
  offsets[id+1]=size;add((id+1)+' 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+bytes.length+' >>\nstream\n');add(bytes);add('\nendstream\nendobj\n');
  const content='q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
  object(id+2,'<< /Length '+encoder.encode(content).length+' >>\nstream\n'+content+'endstream');
 });
 const xref=size,total=3+images.length*3;add('xref\n0 '+total+'\n0000000000 65535 f \n');
 for(let i=1;i<total;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 add('trailer\n<< /Size '+total+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
 return new Blob(chunks,{type:'application/pdf'});
}
async function download(title,rows,notice){
 await document.fonts.ready;
 const images=[];let canvas,ctx,y,page=0;
 const font='"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
 const text=(s,x,yy,size=24,color='#33212b')=>{ctx.font=size+'px '+font;ctx.fillStyle=color;ctx.fillText(s,x,yy);};
 function lines(s,width,size=24){ctx.font=size+'px '+font;const out=[];for(const paragraph of String(s).split('\n')){let line='';for(const ch of paragraph){if(line&&ctx.measureText(line+ch).width>width){out.push(line);line='';}line+=ch;}out.push(line);}return out;}
 function finish(){if(!canvas)return;text('仅供双方保存 · 第 '+page+' 页',64,1707,19,'#876b76');const raw=atob(canvas.toDataURL('image/jpeg',.94).split(',')[1]);images.push(Uint8Array.from(raw,c=>c.charCodeAt(0)));canvas.width=0;}
 function next(){finish();page++;canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;ctx=canvas.getContext('2d');if(!ctx)throw Error('当前浏览器不支持PDF生成');ctx.fillStyle='#fffaf7';ctx.fillRect(0,0,1240,1754);ctx.fillStyle='#6c2f46';ctx.fillRect(0,0,1240,13);text(title,64,78,32);let pos=120;for(const line of lines(notice,1112,20)){text(line,64,pos,20,'#775567');pos+=29;}y=pos+32;}
 next();
 for(const [index,row] of rows.entries()){
  const heading=lines((index+1)+'. '+row.title,1112,27);
  if(y+heading.length*38+160>1640)next();
  for(const line of heading){text(line,64,y,27,'#6c2f46');y+=38;}
  const a=lines(row.answers[0],510),b=lines(row.answers[1],510);let start=0;
  const n=Math.max(a.length,b.length);
  while(start<n){
   if(y+110>1640){next();text((index+1)+'. '+(start?'（续）':''),64,y,27,'#6c2f46');y+=40;}
   text('羊爸',80,y,24,'#923a5b');text('羊妈',662,y,24,'#923a5b');y+=37;
   const count=Math.min(n-start,Math.max(1,Math.floor((1620-y)/35)));
   ctx.strokeStyle='#e2cbd3';ctx.beginPath();ctx.moveTo(620,y-55);ctx.lineTo(620,y+count*35);ctx.stroke();
   for(let i=0;i<count;i++){if(a[start+i]!==undefined)text(a[start+i],80,y);if(b[start+i]!==undefined)text(b[start+i],662,y);y+=35;}
   start+=count;if(start<n){next();for(const line of lines((index+1)+'. '+row.title+'（续）',1112,27)){text(line,64,y,27,'#6c2f46');y+=38;}}
  }
  y+=40;
 }
 finish();
 const blob=packPdf(images),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='羊爸羊妈-答卷对照-'+new Date().toISOString().slice(0,10)+'.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
root.RainCouplePDF={download,packPdf};
if(typeof module!=='undefined')module.exports={packPdf};
})(typeof window!=='undefined'?window:globalThis);
