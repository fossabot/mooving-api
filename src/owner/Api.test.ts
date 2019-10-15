import * as chai from 'chai';
import chaiHttp = require('chai-http');
import Api from './Api';
import * as cassandra from '../common/cassandra/client';
import * as vehicles from './cassandra/Vehicles';
import * as owners from './cassandra/Owner';
import * as auth from '../common/lib/Auth';

chai.use(chaiHttp);
const expect = chai.expect;

const USER_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const VEHICLE_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const MAX_VERSION = '9999.9999.9999';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZm' +
  'Zi1mZmZmLWZmZmZmZmZmZmZmMSIsImlhdCI6MTUxNjIzOTAyMn0.DScuYWKme_HwM1ghuk1aRK_uFJyGTHop1tvPtVppX2k';

describe('baseRoute', () => {
  beforeAll(() => {
    process.env.TWILIO_API_KEY = 'apiKey';
  });

  // TODO: You could create a container suite. Include all suites in it and use a single 'beforeEach' when it is duplicated.
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();
    (cassandra as any).default.init = jest.fn();
    (cassandra as any).default.getClient = jest.fn(() => ({
      execute: jest.fn().mockResolvedValue({ first: jest.fn() }),
    }));
  });

  it('should be json', async () => {
    const api = new Api();
    const res = await chai.request(api.server).get('/');
    expect(res.type).to.eql('application/json');
  });

  it('should have a message prop', async () => {
    const api = new Api();
    const res = await chai.request(api.server).get('/');
    expect(res.body.message).to.contain('API');
  });
});

describe('vehicle controller methods', () => {

  describe('get owner vehicles', () => {

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
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({ vehicles: [vehicle] });
    });

    it('should get 400 when date is invaild', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicles`)
        .query({ date: 'not date' })
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
      expect(res.body).to.eql({ message: 'Date is invalid' });
    });

    it('should get 400 when no date is sent', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicles`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
      expect(res.body).to.eql({ message: 'Date is invalid' });
    });
  });

  describe('get vehicle details', () => {

    it('should get vehicle details', async () => {
      const vehicle = {
        vehicleId: VEHICLE_ID,
        ownerId: USER_ID,
      };
      const vehicleStatsResponse = {
        vehicleId: VEHICLE_ID,
        ownerId: USER_ID,
        lastRider: {
          id: null as string,
        },
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (vehicles as any).default.findById = jest.fn().mockResolvedValue(vehicle);
      (vehicles as any).default.getOwnerVehicleStatsByVehicleId = jest.fn().mockResolvedValue(vehicle);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicles/${VEHICLE_ID}`)
        .query({ date: new Date().toISOString() })
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql(vehicleStatsResponse);
    });

    it('should get 404 when vehicle not found in db', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (vehicles as any).default.findById = jest.fn().mockResolvedValue(null);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicles/${VEHICLE_ID}`)
        .query({ date: new Date().toISOString() })
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(404);
    });

    it('should get 403 when vehicle has another owner id then the current user', async () => {
      const vehicle = {
        vehicleId: VEHICLE_ID,
        ownerId: 'another owner',
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (vehicles as any).default.findById = jest.fn().mockResolvedValue(vehicle);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicles/${VEHICLE_ID}`)
        .query({ date: new Date().toISOString() })
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(403);
    });

    it('should get 400 when date is invalid', async () => {
      const vehicle = {
        vehicleId: VEHICLE_ID,
        ownerId: USER_ID,
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (vehicles as any).default.findById = jest.fn().mockResolvedValue(vehicle);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicles/${VEHICLE_ID}`)
        .query({ date: 'invalid' })
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
    });

    it('should get 400 when no date is sent', async () => {
      const vehicle = {
        vehicleId: VEHICLE_ID,
        ownerId: USER_ID,
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (vehicles as any).default.findById = jest.fn().mockResolvedValue(vehicle);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicles/${VEHICLE_ID}`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
    });
  });
});

describe('owner controller methods', () => {

  describe('get owners stats', () => {
    it('should get owner stats', async () => {
      const ownerStats = {
        id: USER_ID,
        date: '2019-02-14',
        totalRidesCount: 6,
        totalDAVRevenue: 5.4,
        totalFiatRevenue: 51.30,
        currencyCode: 'USD',
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (owners as any).default.getOwnerStats = jest.fn().mockResolvedValue(ownerStats);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/owner/stats`)
        .query({ date: new Date().toISOString() })
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql(ownerStats);
    });

    it('should get 200 with empty response because db table is empty', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (owners as any).default.getOwnerStats = jest.fn().mockResolvedValue(null);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/owner/stats`)
        .query({ date: new Date().toISOString() })
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({});
    });

    it('should get 404 because date is invalid', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/owner/stats`)
        .query({ date: 'invalid' })
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(404);
    });

    it('should get 404 because no date is sent', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/owner/stats`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(404);
    });
  });
});
