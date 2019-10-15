import * as chai from 'chai';
import chaiHttp = require('chai-http');
import Api from './Api';
import * as vehicles from './cassandra/Vehicles';
import * as auth from '../common/lib/Auth';

chai.use(chaiHttp);
const expect = chai.expect;
const clientVersion = '1.1.0';

const VEHICLE_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZm' +
  'Zi1mZmZmLWZmZmZmZmZmZmZmMSIsImlhdCI6MTUxNjIzOTAyMn0.DScuYWKme_HwM1ghuk1aRK_uFJyGTHop1tvPtVppX2k';

beforeEach(async () => {
  jest.resetAllMocks();
  jest.resetModules();
  jest.clearAllMocks();
});

it('should get owner vehicles', async () => {
  const vehicle = {
    vehicleId: VEHICLE_ID,
  };
  (auth as any).Auth.serverSecret = 'SUPERSECRET';
  (vehicles as any).default.findVehiclesByOwner = jest.fn().mockResolvedValue([vehicle]);
  (vehicles as any).default.getOwnerVehiclesStats = jest.fn().mockResolvedValue([vehicle]);
  const api = new Api();

  const res = await chai.request(api.server).get(`/api/auth/vehicles`)
    .query({ date: new Date().toISOString() })
    .set('authorization', 'Bearer ' + AUTH_TOKEN)
    .set('version', clientVersion);

  expect(res.status).to.eql(200);
  expect(res.body).to.eql({ vehicles: [vehicle] });
});
