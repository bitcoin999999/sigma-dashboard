export async function shareImageFile(blob: Blob, symbol: string, api: Pick<Navigator,"share"|"canShare">): Promise<"shared"|"cancelled"|"download"> {
  const file=new File([blob],`${symbol.toLowerCase()}-sigma-analysis.png`,{type:"image/png"});
  const data={files:[file],title:`${symbol} | 1SIGMA`};
  if(typeof api.share!=="function"||typeof api.canShare!=="function")return "download";
  try { if(!api.canShare(data))return "download";await api.share(data);return "shared"; }
  catch(error){return error && typeof error==="object"&&"name" in error&&error.name==="AbortError"?"cancelled":"download";}
}
