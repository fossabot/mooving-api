import * as chai from 'chai';
import chaiHttp = require('chai-http');
import Api from './Api';
import * as rideSummary from './cassandra/RideSummary';
import * as activeRides from './cassandra/ActiveRides';
import * as vehicles from './cassandra/Vehicles';
import * as auth from '../common/lib/Auth';
import OwnerDB from './../owner/cassandra/Owner';

chai.use(chaiHttp);
const expect = chai.expect;
const clientVersion = '1.3.0';

const ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZm' +
  'Zi1mZmZmLWZmZmZmZmZmZmZmMSIsImlhdCI6MTUxNjIzOTAyMn0.DScuYWKme_HwM1ghuk1aRK_uFJyGTHop1tvPtVppX2k';

beforeEach(async () => {
  jest.resetAllMocks();
  jest.resetModules();
  jest.clearAllMocks();
});

it('should return vehicle', async () => {
  const VEHICLE = {
    id: 'ffffffff-ffff-ffff-ffff-fffffffffff2',
    status: 'available',
    batteryLevel: 28,
    model: 'Mi Electric Scooter',
    qrCode: '000036',
    geoHash: 'sv8wrnsn3e',
    currencyCode: 'USD',
  };
  (auth as any).Auth.serverSecret = 'SUPERSECRET';
  (vehicles as any).default.findByQrCode = jest.fn((qrCode: string) =>
    qrCode === VEHICLE.qrCode ? Promise.resolve(VEHICLE) : Promise.reject(null));
  (OwnerDB as any).findById = jest.fn(() => Promise.resolve({fiatCurrencyCode: 'USD'}));
  const api = new Api();

  const res = await chai.request(api.server).get(`/api/auth/vehicle/MDAwMDM2`)
    .set('authorization', 'Bearer ' + AUTH_TOKEN)
    .set('version', '1.3.0');

  expect(res.status).to.eql(200);
  expect(res.body).to.eql(VEHICLE);
});
