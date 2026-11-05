"""Real HTTPS/PHP/MySQL integration. ONLY the isolated sismoalert-test stack."""
import concurrent.futures, copy, http.cookiejar, json, pathlib, secrets, ssl, subprocess, urllib.request, urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
DC=['docker','compose','-p','sismoalert-test','-f','compose.yaml','-f','deploy/test.yaml']
BASE='https://localhost:9443'
TLS=ssl.create_default_context(cafile=str(ROOT/'.local/tls/ca.crt'))
passed=0

def cmd(args, data=None):
    return subprocess.run(DC+args,cwd=ROOT,input=data,text=True,capture_output=True,check=True).stdout

def sql(value):
    return cmd(['exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE" --batch --skip-column-names'],value)

class Client:
    def __init__(self):
        self.jar=http.cookiejar.CookieJar();self.csrf=None
        self.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=TLS),urllib.request.HTTPCookieProcessor(self.jar))
    def call(self,path,method='GET',body=None,expected=200,headers=None):
        h={'Origin':BASE}
        if body is not None:h['Content-Type']='application/json'
        if self.csrf:h['X-CSRF-Token']=self.csrf
        h.update(headers or {})
        request=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=h,method=method)
        try:response=self.opener.open(request,timeout=10)
        except urllib.error.HTTPError as error:response=error
        raw=response.read().decode()
        assert response.code==expected, (path,response.code,expected,raw)
        return json.loads(raw) if 'application/json' in response.headers.get('Content-Type','') else raw
    def login(self,name,password):
        r=self.call('/api/v1/session','POST',{'username':name,'password':password});self.csrf=r['csrfToken'];return r

def check(name,fn):
    global passed
    fn();passed+=1;print('PASS',name,flush=True)

def main():
    # Safe reruns reset only the disposable test database selected by the fixed compose project.
    sql('SET FOREIGN_KEY_CHECKS=0;\n'+''.join('DROP TABLE IF EXISTS '+t+';\n' for t in ['schema_migrations','auth_lock','users','sectors','user_sector_access','sessions','login_attempts','gateways','nodes','events','telemetry_summaries','config_versions','audit_logs'])+'SET FOREIGN_KEY_CHECKS=1;')
    sql((ROOT/'backend/migrations/001.sql').read_text())
    sql("REVOKE ALL PRIVILEGES ON sismoalert.* FROM 'sismoapp'@'%'; GRANT SELECT,INSERT,UPDATE,DELETE ON sismoalert.* TO 'sismoapp'@'%';")
    adminpass=secrets.token_urlsafe(24);userpass=secrets.token_urlsafe(24);device=secrets.token_hex(32)
    cmd(['exec','-T','app','php','/app/backend/bin/admin.php','bootstrap','admin'],adminpass)
    cmd(['exec','-T','app','php','/app/backend/bin/admin.php','provision-device','DEMO-GW','S01','1','SIMULATED'],device)
    anonymous=Client();admin=Client();regular=Client()
    check('public projection contains no coordinates, users or diagnostic',lambda: assert_public(anonymous.call('/api/v1/public/state')))
    check('anonymous diagnostics denied',lambda:anonymous.call('/api/v1/info',expected=401))
    check('legacy route fails closed pending real firmware',lambda:anonymous.call('/api/estado',expected=501))
    check('untrusted origin rejected before login',lambda:anonymous.call('/api/v1/session','POST',{'username':'admin','password':adminpass},expected=403,headers={'Origin':'https://evil.invalid'}))
    check('host validation',lambda:anonymous.call('/api/v1/public/state',expected=403,headers={'Host':'evil.invalid'}))
    admin.login('admin',adminpass)
    cookie=next(iter(admin.jar));assert cookie.secure and cookie.has_nonstandard_attr('HttpOnly') and cookie.get_nonstandard_attr('SameSite')=='Strict';passed_cookie=True
    check('secure HttpOnly SameSite session cookie',lambda:bool(passed_cookie))
    uid=admin.call('/api/v1/users','POST',{'username':"operator' OR 1=1 --",'password':userpass,'role':'USUARIO','sectors':['S01']},expected=201)['id']
    check('SQL-looking username treated as literal data',lambda:regular.login("operator' OR 1=1 --",userpass))
    for path in ['/api/v1/info','/api/v1/users','/api/v1/events?sectorId=S01','/api/v1/config?sectorId=S01','/api/v1/audit?sectorId=S01','/api/v1/export/events.csv?sectorId=S01']:
        check('USUARIO denied '+path,lambda p=path:regular.call(p,expected=403))
    check('regular user can read authorized state',lambda:regular.call('/api/v1/state'))
    check('CSRF mutation rejected',lambda:admin.call('/api/v1/config','PATCH',{'sectorId':'S01','expectedVersion':0,'notice':'x'},expected=403,headers={'X-CSRF-Token':'wrong'}))
    check('last administrator cannot be deactivated',lambda:admin.call('/api/v1/users/1','PATCH',{'active':False},expected=409))
    check('sector ID tampering rejected',lambda:admin.call('/api/v1/events?sectorId=S02',expected=403))
    check('cannot grant sectors outside own scope',lambda:admin.call('/api/v1/users/'+uid,'PATCH',{'sectors':['S02']},expected=403))
    check('configuration stored with version',lambda:admin.call('/api/v1/config','PATCH',{'sectorId':'S01','expectedVersion':0,'notice':'<script>alert(1)</script>'}))
    check('optimistic concurrency rejects stale version',lambda:admin.call('/api/v1/config','PATCH',{'sectorId':'S01','expectedVersion':0,'notice':'stale'},expected=409))
    state=regular.call('/api/v1/state');assert state['notices'][0]['text']=='<script>alert(1)</script>'
    check('unknown hardware controls rejected',lambda:admin.call('/api/v1/commands','POST',{},expected=501))
    e={'id':'evt-1','nodeId':'1','nodeBootId':'test-boot','sequence':1,'type':'ANOMALIA','origin':'SIMULATED','drill':False,'receivedAtGatewayUptimeMs':200,'freshness':'CURRENT','locationSnapshot':{'latitude':-17.39779,'longitude':-66.14954,'source':'CONFIGURED_DEMO_REFERENCE','physicalInstallationVerified':False},'profileId':None,'timeSource':'UNSYNCED','utc':None}
    h={'Authorization':'Bearer '+device}
    check('human session cannot impersonate device',lambda:admin.call('/internal/v1/ingest/events','POST',{'schemaVersion':1,'items':[e]},expected=401))
    r=anonymous.call('/internal/v1/ingest/events','POST',{'schemaVersion':1,'items':[e]},headers=h);assert r['committed'] and sql('SELECT COUNT(*) FROM events').strip()=='1'
    check('ACK sent after durable MySQL commit',lambda:bool(r['committed']))
    check('replay is idempotent',lambda:anonymous.call('/internal/v1/ingest/events','POST',{'schemaVersion':1,'items':[e]},headers=h));assert sql('SELECT COUNT(*) FROM events').strip()=='1'
    conflict=copy.deepcopy(e);conflict['type']='NORMAL'
    check('same identity different content is conflict',lambda:anonymous.call('/internal/v1/ingest/events','POST',{'schemaVersion':1,'items':[conflict]},expected=409,headers=h))
    new=copy.deepcopy(e);new['id']='rollback-me'
    check('entire batch rolls back on conflict',lambda:anonymous.call('/internal/v1/ingest/events','POST',{'schemaVersion':1,'items':[new,conflict]},expected=409,headers=h));assert sql('SELECT COUNT(*) FROM events').strip()=='1'
    bad=copy.deepcopy(e);bad['id']='other';bad['nodeId']='2'
    check('unprovisioned device node rejected',lambda:anonymous.call('/internal/v1/ingest/events','POST',{'schemaVersion':1,'items':[bad]},expected=403,headers=h))
    bad=copy.deepcopy(e);bad['origin']='REAL'
    check('simulated device cannot claim real origin',lambda:anonymous.call('/internal/v1/ingest/events','POST',{'schemaVersion':1,'items':[bad]},expected=403,headers=h))
    real=admin.call('/api/v1/events?sectorId=S01');assert real['items']==[]
    history=admin.call('/api/v1/events?sectorId=S01&origin=SIMULATED');assert len(history['items'])==1 and isinstance(history['items'][0]['storageId'],str)
    check('REAL and SIMULATED histories isolated',lambda:bool(history))
    csv=admin.call('/api/v1/export/events.csv?sectorId=S01&origin=SIMULATED');assert 'SIMULATED' in csv and '-17.39779' in csv and "'-17.39779" not in csv and 'UNSYNCED' in csv
    check('CSV preserves units, origin, time quality and negative numeric coordinates',lambda:bool(csv))
    summary={'nodeId':'1','nodeBootId':'test-boot','sequence':10,'origin':'SIMULATED','drill':False,'receivedAtGatewayUptimeMs':300,'valid':True,'accelerationG':{'x':.1,'y':0,'z':1}}
    check('telemetry summaries committed',lambda:anonymous.call('/internal/v1/ingest/summaries','POST',{'schemaVersion':1,'items':[summary]},headers=h))
    check('summaries replay without duplication',lambda:anonymous.call('/internal/v1/ingest/summaries','POST',{'schemaVersion':1,'items':[summary]},headers=h));assert sql('SELECT COUNT(*) FROM telemetry_summaries').strip()=='1'
    check('permission change revokes existing sessions',lambda:admin.call('/api/v1/users/'+uid,'PATCH',{'active':False}))
    check('revoked session immediately rejected',lambda:regular.call('/api/v1/state',expected=401))
    # Isolated DB stop cannot affect the main development stack.
    cmd(['stop','db'])
    try:
        check('MySQL outage fails closed for privileged routes',lambda:admin.call('/api/v1/users',expected=503))
        check('public contingency survives MySQL outage',lambda:assert_outage(anonymous.call('/api/v1/public/state')))
    finally:cmd(['up','-d','--wait','db'])
    check('confirmed events survive restart',lambda:assert_count(admin.call('/api/v1/events?sectorId=S01&origin=SIMULATED'),1))
    # Backup and restore into a separate database; no restore into live data.
    dump=cmd(['exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --no-tablespaces "$MYSQL_DATABASE"'])
    sql('CREATE DATABASE IF NOT EXISTS sismoalert_restore;')
    cmd(['exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot sismoalert_restore'],dump)
    assert sql('SELECT COUNT(*) FROM sismoalert_restore.events;').strip()=='1'
    assert sql('SELECT content_hash FROM events;')==sql('SELECT content_hash FROM sismoalert_restore.events;')
    check('backup restored to isolated schema with matching event hash',lambda:True)
    sql('DROP DATABASE sismoalert_restore;')
    second=admin.call('/api/v1/users','POST',{'username':'admin-two','password':userpass,'role':'ADMINISTRADOR','sectors':['S01']},expected=201)['id'];a2=Client();a2.login('admin-two',userpass)
    def degrade(client,id):
        try:client.call('/api/v1/users/'+id,'PATCH',{'role':'USUARIO'});return 200
        except AssertionError as err:return err.args[0][1]
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        results=list(pool.map(lambda args:degrade(*args),[(admin,'1'),(a2,second)]))
    assert sorted(results)==[200,409],results
    assert sql("SELECT COUNT(*) FROM users WHERE role='ADMINISTRADOR' AND active=1").strip()=='1'
    check('concurrent demotions retain one active administrator',lambda:True)
    # Create no persistent published credentials. UI tests use separate public fixtures.
    for i in range(12):
        try:anonymous.call('/api/v1/session','POST',{'username':'invalid','password':'incorrect'},expected=401)
        except AssertionError as err:
            assert err.args[0][1]==429;break
    else:raise AssertionError('rate limiter did not activate')
    check('login brute force rate limited',lambda:True)
    print(f'{passed} integration checks passed. TLS verified using the local CA; MySQL 8.4.7.',flush=True)

def assert_public(s):
    assert s['nodes']==[] and s['gateway'] is None and 'users' not in s

def assert_outage(s):assert s['services']['database']=='UNAVAILABLE' and s['nodes']==[]
def assert_count(s,n):assert len(s['items'])==n
if __name__=='__main__':main()
