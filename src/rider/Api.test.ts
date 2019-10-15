import * as chai from 'chai';
import chaiHttp = require('chai-http');
import Api from './Api';
import * as cassandra from '../common/cassandra/client';
import Rider, * as riders from './cassandra/Rider';
import * as vehicles from './cassandra/Vehicles';
import * as activeRides from './cassandra/ActiveRides';
import * as rideSummary from './cassandra/RideSummary';
import OwnerDB from './../owner/cassandra/Owner';
import * as userJobs from '../common/cassandra/UserJobs';
import AccountControllerCommon from '../common/controllers/AccountController';
import * as auth from '../common/lib/Auth';
import * as LibPhoneNumber from 'libphonenumber-js';
import * as kafka from '../common/lib/Kafka';
import * as nodeFetch from 'node-fetch';
import * as KafkaNode from 'kafka-node';

chai.use(chaiHttp);
const expect = chai.expect;

const MAX_VERSION = '9999.9999.9999';
const TEST_USER_PHONE = '972500000000';
const TEST_USER_COUNTRY_CODE = '972';

const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZm' +
  'Zi1mZmZmLWZmZmZmZmZmZmZmMSIsImlhdCI6MTUxNjIzOTAyMn0.DScuYWKme_HwM1ghuk1aRK_uFJyGTHop1tvPtVppX2k';

const USER_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const VEHICLE_ID1 = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const VEHICLE_ID2 = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const QR_CODE1 = '000083';
const QR_CODE2 = '000036';
const GEO_HASH1 = 'sv8wrxwjuu';
const GEO_HASH2 = 'sv8wrnsn3e';

(cassandra as any).default.init = jest.fn();
(cassandra as any).default.getClient = jest.fn(() => ({
  execute: jest.fn().mockResolvedValue({ first: jest.fn() }),
}));

describe('baseRoute', () => {
  beforeAll(() => {
    process.env.TWILIO_API_KEY = 'apiKey';
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();
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

  it('health check should fail due to cassandra error', async () => {
    const api = new Api();
    (cassandra as any).default.getClient = jest.fn(() => ({
      execute: jest.fn().mockRejectedValue({ msg: 'error' }),
    }));
    (KafkaNode as any).KafkaClient = jest.fn(() => ({
      connect: jest.fn(),
      on: jest.fn((type: string, cb: () => void) => {
        if (type === 'ready') {
          cb();
        }
      }),
    }));
    const res = await chai.request(api.server).get('/health');
    expect(res.status).to.eql(500);
  });

  it('health check should fail to kafka error', async () => {
    const api = new Api();
    (cassandra as any).default.getClient = jest.fn(() => ({
      execute: jest.fn().mockResolvedValue({ msg: 'success' }),
    }));
    (KafkaNode as any).KafkaClient = jest.fn(() => ({
      connect: jest.fn(),
      on: jest.fn((type: string, cb: () => void) => {
        if (type === 'error') {
          cb();
        }
      }),
    }));
    const res = await chai.request(api.server).get('/health');
    expect(res.status).to.eql(500);
  });

  it('health check should success', async () => {
    const api = new Api();
    (cassandra as any).default.getClient = jest.fn(() => ({
      execute: jest.fn().mockResolvedValue({ msg: 'success' }),
    }));
    (KafkaNode as any).KafkaClient = jest.fn(() => ({
      connect: jest.fn(),
      on: jest.fn((type: string, cb: () => void) => {
        if (type === 'ready') {
          cb();
        }
      }),
    }));
    const res = await chai.request(api.server).get('/health');
    expect(res.status).to.eql(200);
  });

});

describe('Account Controller Methods', () => {
  describe('verify client version', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should return ok for latest version', async () => {
      const api = new Api();
      const res = await chai.request(api.server).get(`/api/verify-client-version`).set('version', MAX_VERSION);
      expect(res.status).to.eql(200);
    });

    it('should return not found for no version', async () => {
      const api = new Api();
      const res = await chai.request(api.server).get(`/api/verify-client-version`);
      expect(res.status).to.eql(404);
    });
  });

  describe('send sms', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should return 400 if missing phone', async () => {
      const api = new Api();

      const res = await chai.request(api.server).post(`/api/sms`)
        .query({ phoneNumber: '972500000001' })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
    });

    it('should return 400 if missing country code', async () => {
      const api = new Api();

      const res = await chai.request(api.server).post(`/api/sms`)
        .query({ countryCode: '972' })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
    });

    it('should return 200 for test user', async () => {
      const api = new Api();

      const res = await chai.request(api.server).post(`/api/sms`)
        .query({ phoneNumber: TEST_USER_PHONE, countryCode: TEST_USER_COUNTRY_CODE })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({ message: `Ride Hailing api sent sms to ${TEST_USER_PHONE}` });
    });

    it('should respond with 200 and success message', async () => {
      const PHONE_NUMBER = '972500000001';
      (AccountControllerCommon as any)._authy = {
        phones: jest.fn(() => ({
          verification_start: jest.fn((phone, countryCode, options, cb) => cb(false, true)),
        })),
      };
      const api = new Api();

      const res = await chai.request(api.server).post(`/api/sms`)
        .query({ phoneNumber: PHONE_NUMBER, countryCode: '972' })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({ message: `Ride Hailing api sent sms to ${PHONE_NUMBER}` });
    });

    it('should respond with 500 when twilio return an error', async () => {
      const PHONE_NUMBER = '972500000001';
      (AccountControllerCommon as any)._authy = {
        phones: jest.fn(() => ({
          verification_start: jest.fn((phone, countryCode, options, cb) => cb('twilio error', true)),
        })),
      };
      const api = new Api();

      const res = await chai.request(api.server).post(`/api/sms`)
        .query({ phoneNumber: PHONE_NUMBER, countryCode: '972' })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(500);
      expect(res.body).to.eql('twilio error');
    });
  });

  describe('verify code', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should return 400 if missing phone', async () => {
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          countryCode: '972',
          verificationCode: '0000',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
    });

    it('should return 400 if missing country code', async () => {
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          phoneNumber: '972500000001',
          verificationCode: '0000',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
    });

    it('should return 400 if missing verificationCode', async () => {
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          phoneNumber: '972500000001',
          countryCode: '972',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
    });

    it('should respond with 200 and new token for new user', async () => {
      const PHONE_NUMBER = '972500000001';
      (AccountControllerCommon as any)._authy = {
        phones: jest.fn(() => ({
          verification_check: jest.fn((phone, countryCode, verificationCode, cb) => cb(false, true)),
        })),
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (riders as any).default.findByPhone = jest.fn().mockResolvedValue(false);
      (riders as any).default.insert = jest.fn().mockResolvedValue(USER_ID);
      (LibPhoneNumber as any).parsePhoneNumber = jest.fn((phone: string) => ({ number: phone }));
      (auth as any).Auth.generateSignedToken = jest.fn((userId: string) => AUTH_TOKEN);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          phoneNumber: PHONE_NUMBER,
          countryCode: '+972',
          verificationCode: '0000',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      const decodedToken = (auth as any).Auth.decodeToken(res.body.token);
      expect(decodedToken).to.have.property('id');
      expect(decodedToken).to.have.property('iat');
    });

    it('should get 200 response with verified false when wrong verification is sent', async () => {
      (AccountControllerCommon as any)._authy = {
        phones: jest.fn(() => ({
          verification_check: jest.fn((phone: string, country: string, verification: string, cb: (err: any, res: any) => void) =>
            cb({ error_code: '60022' }, null)),
        })),
      };

      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          phoneNumber: '972500000001',
          countryCode: '+972',
          verificationCode: '0000',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({ verified: false });
    });

    it('should get 200 response with verified false and expired true when code has been expired', async () => {
      (AccountControllerCommon as any)._authy = {
        phones: jest.fn(() => ({
          verification_check: jest.fn((phone: string, country: string, verification: string, cb: (err: any, res: any) => void) =>
            cb({ error_code: '60023' }, null)),
        })),
      };

      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          phoneNumber: '972500000001',
          countryCode: '+972',
          verificationCode: '0000',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({ verified: false, expired: true });
    });

    it('should get error due to phone parsing error', async () => {
      (AccountControllerCommon as any)._authy = {
        phones: jest.fn(() => ({
          verification_check: jest.fn((phone, countryCode, verificationCode, cb) => cb(null, null)),
        })),
      };
      (LibPhoneNumber as any).parsePhoneNumber = jest.fn((phone: string) => { throw new Error('parse error'); });

      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          phoneNumber: '972500000001',
          countryCode: '+972',
          verificationCode: '0000',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(500);
    });

    it('verify code should respond with 200 and token for test user', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (auth as any).Auth.generateSignedToken = jest.fn((userId: string) => AUTH_TOKEN);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          phoneNumber: TEST_USER_PHONE,
          countryCode: TEST_USER_COUNTRY_CODE,
          verificationCode: '0000',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      const decodedToken = (auth as any).Auth.decodeToken(res.body.token);
      expect(decodedToken).to.have.property('id');
      expect(decodedToken).to.have.property('iat');
    });

    it('should throw error due to DB error while fetching user', async () => {
      const PHONE_NUMBER = '972500000001';
      (AccountControllerCommon as any)._authy = {
        phones: jest.fn(() => ({
          verification_check: jest.fn((phone, countryCode, verificationCode, cb) => cb(null, null)),
        })),
      };
      (LibPhoneNumber as any).parsePhoneNumber = jest.fn((phone: string) => ({ number: phone }));
      (riders as any).default.findByPhone = jest.fn().mockRejectedValue('DB error');
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          phoneNumber: PHONE_NUMBER,
          countryCode: '972',
          verificationCode: '0000',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(500);
      expect(res.body).to.eql('DB error');
    });

    it('should throw error due to DB error while insert new user', async () => {
      const PHONE_NUMBER = '972500000001';
      (AccountControllerCommon as any)._authy = {
        phones: jest.fn(() => ({
          verification_check: jest.fn((phone, countryCode, verificationCode, cb) => cb(null, null)),
        })),
      };
      (LibPhoneNumber as any).parsePhoneNumber = jest.fn((phone: string) => ({ number: phone }));
      (riders as any).default.findByPhone = jest.fn().mockResolvedValue(false);
      (riders as any).default.insert = jest.fn().mockRejectedValue('DB error');
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/verify-code`)
        .query({
          phoneNumber: PHONE_NUMBER,
          countryCode: '972',
          verificationCode: '0000',
        })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(500);
      expect(res.body).to.eql('DB error');
    });
  });

  describe('get account details', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should get Account Details', async () => {
      const RIDE_START_TIME = '2007-04-05T14:30Z';
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
      (activeRides as any).default.getActiveRide = jest.fn(() => Promise.resolve({ startTime: RIDE_START_TIME }));
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (riders as any).default.findById = jest.fn().mockResolvedValue({ id: USER_ID, davBalance: 8 });
      (rideSummary as any).default.getRideHistory = jest.fn().mockResolvedValue([{davAwarded: 2}, {davAwarded: 5}, {davAwarded: 1}]);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/account`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.have.property('account');
      expect(res.body.account).to.deep.include({
        id: USER_ID,
        isPaymentValid: false,
        davBalance: 8,
        activeRide: {
          statusCode: 200,
          ride: {
            startTime: RIDE_START_TIME,
          },
        },
      });
    });

    it('should get 401 when token is not set', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/account`)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(401);
      expect(res.body).to.eql({});
    });

    it('should get 401 when user id is not exist', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (riders as any).default.findById = jest.fn().mockResolvedValue(null);
      (rideSummary as any).default.getRideHistory = jest.fn().mockResolvedValue([]);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/account`)
        .set('authorization', 'Bearer lies')
        .set('authorization', 'Bearer ' + AUTH_TOKEN);

      expect(res.status).to.eql(401);
      expect(res.body).to.eql({});
    });
  });

  describe('update personal details', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should return 200 when successfully updated personal details', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (riders as any).default.updatePersonalDetails = jest.fn().mockResolvedValue({});
      const api = new Api();

      const res = await chai.request(api.server).put(`/api/auth/update-personal-details`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({ message: 'Updated user details' });
    });

    it('should return 401 when user id is not set', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (riders as any).default.updatePersonalDetails = jest.fn().mockResolvedValue({});
      const api = new Api();
      const res = await chai.request(api.server).put(`/api/auth/update-personal-details`)
        .set('version', MAX_VERSION);
      expect(res.status).to.eql(401);
      expect(res.body).to.eql({});
    });
  });

  describe('update payment method', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should return 200 when successfully updated credit card', async () => {
      const paymentMethod = {
        pfToken: 'id',
        firstName: 'test',
        lastName: 'test',
      };
      (riders as any).default.updatePaymentDetails = jest.fn().mockResolvedValue(null);

      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (nodeFetch as any).default = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          vaultedShopperId: 'id',
          paymentSources: {
            creditCardInfo: [{
              creditCard: {
                last4: '1234',
                brand: 'visa',
              },
            }],
          },
        }),
      });
      const api = new Api();

      const res = await chai.request(api.server).put(`/api/auth/credit-card`)
        .send(paymentMethod)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
    });

    it('should return 500 when failed to update credit card because invalid request data', async () => {
      const paymentMethod = {
        paymentMethodId: 'id',
        paymentMethodCustomer: 'customer',
      };
      (riders as any).default.updatePaymentDetails = jest.fn().mockRejectedValue(null);

      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();

      const res = await chai.request(api.server).put(`/api/auth/credit-card`)
        .send(paymentMethod)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(500);
    });
  });
});

describe('Vehicle Controller Methods', () => {

  describe('get vehicles', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should return an array of vehicles', async () => {
      const MOCK_VEHICLES_DBRESULT = [
        {
          id: VEHICLE_ID1,
          status: 'available',
          batteryPercentage: 17,
          model: 'Mi Electric Scooter',
          qrCode: QR_CODE1,
          geoHash: GEO_HASH1,
        },
        {
          id: VEHICLE_ID2,
          status: 'available',
          batteryPercentage: 18,
          model: 'Mi Electric Scooter',
          qrCode: QR_CODE2,
          geoHash: GEO_HASH2,
        },
      ];
      const MOCK_VEHICLES_REQ_RESULT = [
        {
          id: VEHICLE_ID1,
          status: 'available',
          batteryLevel: 17,
          model: 'Mi Electric Scooter',
          qrCode: QR_CODE1,
          geoHash: GEO_HASH1,
        },
        {
          id: VEHICLE_ID2,
          status: 'available',
          batteryLevel: 18,
          model: 'Mi Electric Scooter',
          qrCode: QR_CODE2,
          geoHash: GEO_HASH2,
        },
      ];
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (vehicles as any).default.getSearchResultsByLocation = jest.fn().mockResolvedValue({ jsonString: JSON.stringify(MOCK_VEHICLES_DBRESULT) });
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicles/${GEO_HASH1}`)
        .query({ accuracyLevel: 4 })
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body.vehicles).to.eql(MOCK_VEHICLES_REQ_RESULT);
    });

    it('should return vehicle', async () => {
      const VEHICLE = {
        id: VEHICLE_ID2,
        status: 'available',
        batteryLevel: 38,
        model: 'Mi Electric Scooter',
        qrCode: QR_CODE2,
        geoHash: GEO_HASH2,
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (vehicles as any).default.findByQrCode = jest.fn().mockResolvedValue(VEHICLE);
      (OwnerDB as any).findById = jest.fn(() => Promise.resolve({fiatCurrencyCode: 'USD'}));
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicle/${QR_CODE2}`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql(VEHICLE);
    });
  });
});

it('should return batteryLevel error', async () => {
  const VEHICLE = {
    id: 'ffffffff-ffff-ffff-ffff-fffffffffff2',
    status: 'available',
    batteryLevel: 18,
    model: 'Mi Electric Scooter',
    qrCode: '000036',
    geoHash: 'sv8wrnsn3e',
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
  expect(res.body).to.eql({status: 'error', reason: 'batteryLevel'});
});

it('should return notavailable error', async () => {
  const VEHICLE = {
    id: 'ffffffff-ffff-ffff-ffff-fffffffffff2',
    status: 'notavailable',
    batteryLevel: 18,
    model: 'Mi Electric Scooter',
    qrCode: '000036',
    geoHash: 'sv8wrnsn3e',
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
  expect(res.body).to.eql({status: 'error', reason: 'notavailable'});
});

it('should return maintenance error', async () => {
  const VEHICLE = {
    id: 'ffffffff-ffff-ffff-ffff-fffffffffff2',
    status: 'maintenance',
    batteryLevel: 18,
    model: 'Mi Electric Scooter',
    qrCode: '000036',
    geoHash: 'sv8wrnsn3e',
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
  expect(res.body).to.eql({status: 'error', reason: 'maintenance'});
});

describe('Rider Controller methods', () => {

  describe('unlock vehicle', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should return 200 when successfully unlocked', async () => {
      (activeRides as any).default.getActiveRide = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (kafka as any).default.sendMessage = jest.fn().mockResolvedValue(null);
      (riders as any).default.findById = jest.fn().mockResolvedValue({paymentMethodId: '1234'});
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicle/${QR_CODE1}/unlock`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({ message: 'ok' });
    });

    it('should return 400 when rider has no payment method', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (kafka as any).default.sendMessage = jest.fn().mockResolvedValue(null);
      (riders as any).default.findById = jest.fn().mockResolvedValue({paymentMethodId: null});
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
      (activeRides as any).default.getActiveRide = jest.fn().mockResolvedValue(null);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/vehicle/${QR_CODE1}/unlock`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
      expect(res.body).to.eql({});
    });
  });

  describe('lock vehicle', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should lock', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const rideStartTime = '2007-04-05T14:30Z';
      (kafka as any).default.sendMessage = jest.fn().mockResolvedValue(null);
      (activeRides as any).default.getActiveRide = jest.fn().mockResolvedValue({ startTime: rideStartTime });
      const api = new Api();

      const res = await chai.request(api.server).post(`/api/auth/vehicle/lock`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .send({ parkingImageUrl: '/some/image/path' })
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({ message: 'ok' });
    });
  });

  describe('get active ride', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should get active ride', async () => {
      const rideStartTime = '2007-04-05T14:30Z';
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (activeRides as any).default.getActiveRide = jest.fn().mockResolvedValue({ startTime: rideStartTime });
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue({jobId: USER_ID, state: 'started', type: 'unlock'});
      (userJobs as any).default.delete = jest.fn().mockResolvedValue(null);
      const api = new Api();

      const res = await chai.request(api.server).get(`/api/auth/active-ride`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql({ startTime: rideStartTime });
    });
  });

  describe('get ride summary', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should get ride summary', async () => {
      const rideStartTime = '2007-04-05T14:30Z';
      const rideSummaryMock = {
        price: 50,
        riderId: 'USER_ID',
        vehicleId: 'VEHICLE_ID',
        currencyCode: 'USD',
        currencyUnicode: '\u0024',
        davAwarded: 5.3,
      };

      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (rideSummary as any).default.getRideSummary = jest.fn().mockResolvedValue(rideSummaryMock);
      const api = new Api();

      const res = await chai.request(api.server)
        .get(`/api/auth/ride-summary?vehicleId=${VEHICLE_ID1}&startTime=${rideStartTime}`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(200);
      expect(res.body).to.eql(rideSummaryMock);
    });

    it('should get 400 when vehicle id is missing', async () => {
      const rideStartTime = '2007-04-05T14:30Z';
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();

      const res = await chai.request(api.server)
        .get(`/api/auth/ride-summary?vehicleId=&startTime=${rideStartTime}`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);
      expect(res.status).to.eql(400);
      expect(res.body).to.eql({});
    });

    it('should get 400 when start time is missing', async () => {
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();

      const res = await chai.request(api.server)
        .get(`/api/auth/ride-summary?vehicleId=${VEHICLE_ID1}&startTime=`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .set('version', MAX_VERSION);
      expect(res.status).to.eql(400);
      expect(res.body).to.eql({});
    });
  });

  describe('rate ride', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should return 200 when successfully rated ride', async () => {
      const rideSummaryMock = {
        price: 50,
        vehicleId: 'VEHICLE_ID',
        rating: 3,
        effectiveDate: 'effective_date',
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
        endTime: new Date(Date.now() - 4000).toISOString(),
      };
      const getRideSummaryMock = jest.fn().mockResolvedValue(rideSummaryMock);
      const setRatingMock = jest.fn().mockResolvedValue({});
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (rideSummary as any).default.setRating = setRatingMock;
      (rideSummary as any).default.getRideSummary = getRideSummaryMock;
      (kafka as any).default.sendMessage = jest.fn().mockReturnValue(null);
      const api = new Api();
      const res = await chai.request(api.server).put(`/api/auth/rate`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .send(rideSummaryMock)
        .set('version', MAX_VERSION);
      expect(setRatingMock.mock.calls[0][0]).to.eql({
        riderId: USER_ID,
        vehicleId: 'VEHICLE_ID',
        rating: 3,
        effectiveDate: 'effective_date',
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
      });
      expect(res.status).to.eql(200);
      expect(res.body).to.eql({});
    });

    it('should return 400 when vehicle id is missing', async () => {
      const rideSummaryMock = {
        rating: 3,
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();
      const res = await chai.request(api.server).put(`/api/auth/rate`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .send(rideSummaryMock)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
      expect(res.body).to.eql({});
    });

    it('should return 400 when start time is missing', async () => {
      const rideSummaryMock = {
        rating: 3,
        tags: ['tag1', 'tag2', 'tag3'],
        vehicleId: 'VEHICLE_ID',
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      const api = new Api();
      const res = await chai.request(api.server).put(`/api/auth/rate`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .send(rideSummaryMock)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(400);
      expect(res.body).to.eql({});
    });

    it('should return 500 when no ride summary in db', async () => {
      const rideSummaryMock = {
        vehicleId: 'VEHICLE_ID',
        rating: 3,
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
      };
      (auth as any).Auth.serverSecret = 'SUPERSECRET';
      (rideSummary as any).default.getRideSummary = jest.fn().mockResolvedValue(null);
      const api = new Api();
      const res = await chai.request(api.server).put(`/api/auth/rate`)
        .set('authorization', 'Bearer ' + AUTH_TOKEN)
        .send(rideSummaryMock)
        .set('version', MAX_VERSION);

      expect(res.status).to.eql(500);
      expect(res.body).to.eql({ message: 'unexpected error occurred' });
    });
  });
});
