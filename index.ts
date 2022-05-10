import fetch from 'node-fetch';
import { Agent } from 'https';
import { collectDefaultMetrics, Gauge, Registry } from 'prom-client';
import express from 'express';
import crypto from 'crypto';

const httpsAgent = new Agent({
  rejectUnauthorized: false,
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
});

const parseResponse = (response: string): Record<string, string> =>
  response.split(',').reduce((prev, pair) => {
    const [key, value] = pair.split('=');
    return { ...prev, [key]: value };
  }, {});

type UnitGuage = Gauge<'unit' | 'location'>;

const getUpdatedValues = (unit: string, uuid: string, outsideTemp: UnitGuage) => async () => {
  const response = await fetch(`https://${unit}/aircon/get_sensor_info`, {
    method: 'get',
    headers: {
      'X-Daikin-uuid': uuid,
    },
    agent: httpsAgent,
  });

  const text = await response.text();

  const parsed = parseResponse(text);

  if (parsed.otemp) {
    outsideTemp.set({ unit, location: 'outside' }, parseInt(parsed.otemp, 10));
  }

  if (parsed.htemp) {
    outsideTemp.set({ unit, location: 'inside' }, parseInt(parsed.htemp, 10));
  }

  console.log(parseResponse(text));
};

const registry = new Registry();

collectDefaultMetrics({ register: registry });

// htemp=22.0,hhum=-,otemp=25.0,err=0,cmpfreq=10

const temp: UnitGuage = new Gauge({
  name: 'home_temperature',
  help: 'temperature',
  registers: [registry],
  labelNames: ['unit', 'location'],
});

const { AC_IP, AC_UUID } = process.env;

if (AC_IP == null || AC_UUID == null) {
  throw new Error('AC_IP or AC_UUID not defined');
}

const run = getUpdatedValues(AC_IP, AC_UUID, temp);

setInterval(() => {
  run().catch((err) => console.log('Error', err));
}, 10000);

const app = express();

const port = 3000;

app.get('/', (req, res) => {
  res.redirect('/metrics');
});

app.get('/env', (req, res) => {
  res.contentType('text/plain').send(JSON.stringify(process.env, null, 2));
});

app.get('/metrics', (req, res) => {
  res.contentType('text/plain').send(registry.metrics());
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});

console.log(`Running on ${process.arch}`);

// GET_BASIC_INFO = '/common/basic_info',
// GET_MODEL_INFO = '/aircon/get_model_info',
// GET_CONTROL_INFO = '/aircon/get_control_info',
// SET_CONTROL_INFO = '/aircon/set_control_info',
// GET_SENSOR_INFO = '/aircon/get_sensor_info',

// /aircon/get_sensor_info
// ret=OK,htemp=22.0,hhum=-,otemp=25.0,err=0,cmpfreq=10⏎

// /aircon/get_model_info
// ret=OK,model=0C8A,type=N,pv=2,cpv=2,cpv_minor=00,mid=NA,humd=0,s_humd=0,acled=0,land=0,elec=0,temp=1,temp_rng=0,m_dtct=1,ac_dst=--,disp_dry=0,dmnd=0,en_scdltmr=1,en_frate=1,en_fdir=1,s_fdir=3,en_rtemp_a=0,en_spmode=0,en_ipw_sep=0,en_mompow=0,en_patrol=0,en_fdir2=0,en_filter_sign=0

// /aircon/get_control_info
// ret=OK,pow=1,mode=2,adv=,stemp=M,shum=0,dt1=25.0,dt2=M,dt3=23.0,dt4=25.0,dt5=25.0,dt7=25.0,dh1=AUTO,dh2=0,dh3=0,dh4=0,dh5=0,dh7=AUTO,dhh=50,b_mode=2,b_stemp=M,b_shum=0,alert=255,f_rate=A,b_f_rate=A,dfr1=A,dfr2=A,dfr3=5,dfr4=A,dfr5=A,dfr6=A,dfr7=A,dfrh=A,f_dir=3,b_f_dir=3,dfd1=0,dfd2=3,dfd3=0,dfd4=0,dfd5=0,dfd6=3,dfd7=0,dfdh=0

// pow = ON = 1, OFF = 0
// mode = AUTO = 0,  DEHUMDIFICATOR = 2,   COOL = 3,  HEAT = 4,  FAN = 6,
// dt3 = desired temp (it seems)
// stemp = ...? maybe set temp?
// f_rate=A = AUTO = A, SILENT = B, API(3-7) = UI(1-5)
