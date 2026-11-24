import json,urllib.request,re,hashlib,sys
BASE={'base':'http://localhost:3141','novo':'http://localhost:3142'}
CODES=['PH1','VE1','VE2','PE1','AN1','WA1','NF1','BG1','LG1']
SENS=['490154203237518','SERIE-SECRETA-123','9BD15822712345678','MOTOR-SECRETO-1','VIN-SECRETO-2','985141002876543','BRINCO-SECRETO-77','CPF 123.456.789-00','phone_imei','phone_serial','vehicle_vin','vehicle_engine','pet_microchip','animal_id_tag','wallet_contents','NaoDeveAparecer']
def get(u):
    try:
        r=urllib.request.urlopen(u,timeout=60); return r.status,r.read()
    except urllib.error.HTTPError as e: return e.code,e.read()
    except Exception as e: return 0,str(e).encode()
out={}
for c in CODES:
    r={}
    for b,u in BASE.items():
        s,body=get(f'{u}/api/v1/objects/scan/{c}'); j=json.loads(body)
        r[b]={'api':j}
        for rota in ('objeto','scan'):
            s2,h=get(f'{u}/{rota}/{c}'); r[b][rota]={'status':s2,'html':h.decode('utf8','ignore')}
    out[c]=r
for c,r in out.items():
    a,n=r['base']['api'],r['novo']['api']
    extra=sorted(set(n)-set(a)); falta=sorted(set(a)-set(n))
    mudou=[k for k in a if k in n and a[k]!=n[k] and k not in ('updated_at',)]
    vaz=[]
    for b in ('base','novo'):
        for rota in ('objeto','scan'):
            h=r[b][rota]['html']; vaz+= [(b,rota,s) for s in SENS if s in h]
        vaz+=[(b,'api',s) for s in SENS if s in json.dumps(r[b]['api'])]
    pub=[x['valor'] for x in n.get('campos_publicos',[])]
    vis={rota:[v for v in pub if v in r['novo'][rota]['html']] for rota in ('objeto','scan')}
    print(f"{c}: status páginas objeto/scan = {r['novo']['objeto']['status']}/{r['novo']['scan']['status']} | API: chaves a mais {extra}, a menos {falta}, valores mudaram {mudou} | vazamentos de sensível: {vaz} | campos públicos: {len(pub)} (visíveis no HTML objeto {len(vis['objeto'])}, scan {len(vis['scan'])})")
json.dump({c:{b:{'api':v['api']} for b,v in r.items()} for c,r in out.items()},open('exibir/api.json','w'),ensure_ascii=False,indent=1)
