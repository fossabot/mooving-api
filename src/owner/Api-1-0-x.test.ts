import * as chai from 'chai';
import chaiHttp = require('chai-http');
import Api from './Api';
import * as vehicles from './cassandra/Vehicles';
import * as auth from '../common/lib/Auth';

chai.use(chaiHttp);
const expect = chai.expect;
const clientVersion = '1.0.0';

const ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZm' +
  'Zi1mZmZmLWZmZmZmZmZmZmZmMSIsImlhdCI6MTUxNjIzOTAyMn0.DScuYWKme_HwM1ghuk1aRK_uFJyGTHop1tvPtVppX2k';

beforeEach(async () => {
  jest.resetAllMocks();
  jest.resetModules();
  jest.clearAllMocks();
});

it('should return an array with no vehicles', async () => {
  const MOCK_VEHICLES = [
    {
      id: ID,
      status: 'available',
      batteryLevel: 17,
      model: 'Mi Electric Scooter',
      qrCode: '1234',
      geoHash: 'sv8wrxwj',
    },
  ];
  (auth as any).Auth.serverSecret = 'SUPERSECRET';
  (vehicles as any).default.findVehiclesByLocation = jest.fn().mockResolvedValue(MOCK_VEHICLES);

  const api = new Api();
  const res = await chai.request(api.server).get(`/vehicles`)
    .set('authorization', 'Bearer ' + AUTH_TOKEN)
    .set('version', clientVersion);
  expect(res.body.vehicles).to.eql([]);
});
