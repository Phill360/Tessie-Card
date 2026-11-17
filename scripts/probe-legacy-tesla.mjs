// Keep discovery downloads separate from the verified production catalog.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=new URL('../assets/tesla/library/legacy-discovery/',import.meta.url);
await mkdir(out,{recursive:true});
const samples=process.argv.includes('--view-check')?[
  ['ms','views','$MDLS,$MTS07,$PPSW,$WTAS,$INBPP,$DV4W,$PI01'],
  ['mx','views','$MDLX,$MTX07,$PPSW,$WT20,$INBPP,$CC02,$RFPX'],
]:process.argv.includes('--body-check')?[
  ['ms','facelift','$MDLS,$MS03,$MTS07,$PPSW,$WTAS,$INBPP,$DV4W,$FMP6,$RFFR,$PI01,$APBS'],
  ['ms','inventory','MDLS,MS03,MTS07,COL3-PPSW,WTAS,INBPP,DV4W,FMP6,RFFR,PI01,APBS'],
  ['ms','refresh-view','$MDLS,$MS03,$MTS07,$PPSW,$WTAS,$INBPP,$DV4W,$FMP6,$RFFR,$PI01,$APBS'],
  ['mx','cabin','$MDLX,$MTX07,$PPSW,$WT20,$INBPP,$CC02,$APBS,$RFPX'],
]:[
  ['ms','raven','$MDLS,$MTS07,$PPSW,$WTAS,$INBPP,$APBS,$SC04,$CPF0'],
  ['mx','raven','$MDLX,$MTX07,$PPSW,$WT20,$INBPP,$CC02,$APBS,$SC04,$CPF0'],
  ['ms','classic','$MDLS,$BT85,$PPSW,$WT19,$INPB,$RFPO'],
];
const report=[];
for(const [model,generation,options] of samples)for(const view of generation==='views'?['STUD_REAR_V2','STUD_INTERIOR_V2','STUD_INTERIOR1','STUD_RIMCLOSEUP']:generation==='refresh-view'?['STUD_3QTR_V2','REAR34','INTERIOR']:generation==='cabin'?['INTERIOR','STUD_INTERIOR','STUD_SEAT'] : ['STUD_3QTR','STUD_REAR','STUD_INTERIOR']){
  const url=`https://static-assets.tesla.com/v1/compositor/?model=${model}&view=${view}&size=1440&options=${options}&bkba_opt=1`;
  const record={model,generation,options,view,url};
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(35000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Not PNG');
    record.file=`${model}-${generation}-${view.toLowerCase()}.png`;
    record.sha256=createHash('sha256').update(bytes).digest('hex');
    record.bytes=bytes.length;record.width=bytes.readUInt32BE(16);record.height=bytes.readUInt32BE(20);
    await writeFile(new URL(record.file,out),bytes);record.status='downloaded';
  }catch(error){record.status='unavailable';record.error=error.message;}
  report.push(record);console.log(model,generation,view,record.status,record.error||record.bytes);
  await writeFile(new URL(process.argv.includes('--view-check')?'view-check.json':process.argv.includes('--body-check')?'body-check.json':'discovery.json',out),JSON.stringify(report,null,2)+'\n');
}
