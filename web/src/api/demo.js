// Imported only after explicit entry to demo. All values are synthetic, never sent to a device.
export class Demo {
  constructor() { this.start=performance.now();this.scenario='normal';this.event=0;this.sequence=0;this.boot='demo-only-boot'; }
  setScenario(s) { this.scenario=s;if(s==='anomaly')this.event++; }
  snapshot() {
    const elapsed=performance.now()-this.start, anomaly=this.scenario==='anomaly';
    const n={id:1,bootId:this.boot,sequence:++this.sequence,lastRxAgeMs:this.scenario==='link'?5000:50,staleAfterMs:3000,linkState:this.scenario==='link'?'SIN_ENLACE':'VIGENTE',sensorState:this.scenario==='sensor'?'ERROR_SENSOR':'OK',detectionState:({calibrating:'CALIBRANDO',profile:'PERFIL_NO_VALIDO',anomaly:'ANOMALIA'})[this.scenario]??'NORMAL',drill:false,rssiDbm:null,measurement:{valid:this.scenario!=='sensor',accelerationG:this.scenario==='sensor'?null:{x:Math.sin(elapsed/210)*(anomaly?.25:.012),y:Math.cos(elapsed/270)*(anomaly?.12:.008),z:1+Math.sin(elapsed/340)*.006},rmsG:null,peakG:null},location:{latitude:-17.39779,longitude:-66.14954,source:'CONFIGURED_DEMO_REFERENCE',physicalInstallationVerified:false},calibration:{status:'PROVISIONAL_REFERENCE'}};
    return {schemaVersion:1,dataOrigin:'SIMULATED',gateway:{id:'DEMO-GW',bootId:'demo-gateway',firmwareVersion:'example-only'},nodes:this.scenario==='waiting'?[]:[n],capabilities:{windowMetrics:false,configWrite:false},services:{identityApi:'DEMO_SEPARATE',database:'NOT_PERSISTED'},events:anomaly?[{id:`demo-event-${this.event}`,nodeId:'1',nodeBootId:this.boot,type:'ANOMALIA',origin:'SIMULATED',drill:false,sequence:n.sequence,freshness:'CURRENT'}]:[]};
  }
}
