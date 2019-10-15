import * as chai from 'chai';
import chaiHttp = require('chai-http');
import Api from './Api';
import * as rideSummary from './cassandra/RideSummary';
import * as activeRides from './cassandra/ActiveRides';
import * as vehicles from './cassandra/Vehicles';
import * as auth from '../common/lib/Auth';

chai.use(chaiHttp);
const expect = chai.expect;
const clientVersion = '1.1.0';

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
  const res = await chai.request(api.server).get(`/vehicles/sv8wrxwj`)
    .set('authorization', 'Bearer ' + AUTH_TOKEN)
    .set('version', clientVersion);
  expect(res.body.vehicles).to.eql([]);
});

it('should not return vehicle', async () => {
  const VEHICLE = {
    id: ID,
    status: 'available',
    batteryLevel: 18,
    model: 'Mi Electric Scooter',
    qrCode: '1234',
    geoHash: 'sv8wrxwj',
  };
  (auth as any).Auth.serverSecret = 'SUPERSECRET';
  (vehicles as any).default.findByQrCode = jest.fn().mockResolvedValue(VEHICLE);

  const api = new Api();
  const res = await chai.request(api.server).get(`/vehicle/1234`)
    .set('authorization', 'Bearer ' + AUTH_TOKEN)
    .set('version', clientVersion);
  expect(res.status).to.eql(404);
});

it('should get 200 and null body in 1-1-x version', async () => {
  const rideStartTime = '2007-04-05T14:30Z';
  (auth as any).Auth.serverSecret = 'SUPERSECRET';
  (activeRides as any).default.getActiveRide = jest.fn().mockResolvedValue({ startTime: rideStartTime });
  const api = new Api();

  const res = await chai.request(api.server).get(`/active-ride`)
    .set('authorization', 'Bearer ' + AUTH_TOKEN)
    .set('version', clientVersion);

  expect(res.status).to.eql(200);
  expect(res.body).to.eql(null);
});
