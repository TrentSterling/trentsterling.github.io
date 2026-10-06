"""Read the portfolio's own remaining project pages for original media links."""
from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor
from html import unescape
import json,re
ROOT=Path(__file__).resolve().parents[2];LOCAL=ROOT/'.local';out=LOCAL/'archive-pages';out.mkdir(exist_ok=True)
rows=json.loads((LOCAL/'capture-triage.json').read_text())
pending=[r for r in rows if r['mediaStatus'] not in ['gameplay-capture','archived-gameplay'] and '/blog/posts/' in r['href']]
def inspect(row):
 url='https://tront.xyz'+row['href'] if row['href'].startswith('/') else row['href']
 slug=url.strip('/').split('/')[-1];file=out/(slug+'.html')
 try:
  if not file.exists():
   with urlopen(Request(url,headers={'User-Agent':'Tront-local-portfolio-media-review'}),timeout=35) as response:file.write_bytes(response.read())
  html=file.read_text(encoding='utf-8');body=re.sub(r'<(?:script|style)\b.*?</(?:script|style)>','',html,flags=re.S)
  body=unescape(re.sub('<[^>]+>',' ',body));body=re.sub(r'\s+',' ',body)
  videos=sorted(set(re.findall(r'(?:youtu\.be/|youtube(?:-nocookie)?\.com/(?:embed/|watch\?v=|shorts/))([\w-]{11})',html)))
  sources=sorted(set(unescape(v) for v in re.findall(r'(?:src|href)=["\']([^"\']+\.(?:gif|webm|mp4)(?:\?[^"\']*)?)["\']',html)))
  result={'title':row['title'],'url':url,'youtube':videos,'animations':sources,'text':body[:14000]}
 except Exception as e:result={'title':row['title'],'url':url,'error':str(e)}
 print(json.dumps({k:v for k,v in result.items() if k!='text'}),flush=True);return result
with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(inspect,pending))
(LOCAL/'remaining-source-review.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
