import * as chai from 'chai';
import chaiHttp = require('chai-http');
import { Auth } from '../common/lib/Auth';
import Api from './Api';
import * as vehicles from './cassandra/Vehicles';
import * as activeRides from './cassandra/ActiveRides';
import * as kafka from '../common/lib/Kafka';
import * as riders from './cassandra/Rider';
import * as userJobs from '../common/cassandra/UserJobs';
import AccountControllerCommon from '../common/controllers/AccountController';
import OwnerDB from './../owner/cassandra/Owner';
import * as rideSummary from './cassandra/RideSummary';

chai.use(chaiHttp);
const expect = chai.expect;
const clientVersion = '1.1.0';
const TWILIO_INVALID_VERIFICATION_CODE = '60022';
const RIDE_START_TIME = '2007-04-05T14:30Z';
const TEST_USER_PHONE_NUMBER = '972500000000';
const REGULAR_USER_PHONE_NUMBER = '972500000001';
const TEST_USER_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZmZi1mZm' +
  'ZmLWZmZmZmZmZmZmZmZiIsImlhdCI6MTU0OTg5OTg2OH0.a8B_zN8iALmRW0AQPrNGYW_ou5--8p5uR2adFOgnArk';

const REGULAR_USER_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZmZi1mZm' +
  'ZmLWZmZmZmZmZmZmZmMSIsImlhdCI6MTU1MTM0OTcwMn0.oqbPF9nSlk3C7xiDU_u9qF9L9IosU0PzoJH1rMHVBO4';

describe('baseRoute for Test user', () => {

  it('send sms should respond correctly for test user', async () => {
    const api = new Api();
    const res = await chai.request(api.server).post(`/api/sms`)
      .query({ phoneNumber: TEST_USER_PHONE_NUMBER, countryCode: '972' })
      .set('version', clientVersion);
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({ message: `Ride Hailing api sent sms to ${TEST_USER_PHONE_NUMBER}` });
  });

  it('verifyCode with code = 0000 should not call verification_check, and success for test user', async () => {
    const api = new Api();
    (Auth as any).generateSignedToken = jest.fn(() => TEST_USER_AUTH_TOKEN);
    const res = await chai.request(api.server).get(`/api/verify-code`)
      .query({ phoneNumber: TEST_USER_PHONE_NUMBER, countryCode: '972', verificationCode: '0000' })
      .set('version', clientVersion);
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({ token: TEST_USER_AUTH_TOKEN });
  });

  it('account should return test user data', async () => {
    (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
    (activeRides as any).default.getActiveRide = jest.fn(() => Promise.resolve({ startTime: RIDE_START_TIME }));
    (riders.default as any).findById = jest.fn(() => ({
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      davBalance: 0,
    }));
    (rideSummary as any).default.getRideHistory = jest.fn().mockResolvedValue([]);
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/account`)
      .set('authorization', 'Bearer ' + TEST_USER_AUTH_TOKEN)
      .set('version', clientVersion);
    expect(res.status).to.eql(200);
    expect(res.body).to.have.property('account');
    expect(res.body.account).to.deep.include({
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      isPaymentValid: false,
      davBalance: 0,
      activeRide: {
        statusCode: 200,
        ride: {
          startTime: RIDE_START_TIME,
        },
      },
    });
  });

  it('should respond with test scooter only', async () => {
    const testVehicle = {
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      status: 'available',
      batteryLevel: 100,
      model: 'Test Scooter',
      qrCode: '000000',
      geoHash: 's00000000',
      operatorName: 'Test Manager',
      basePrice: '1',
      pricePerMinute: '0.15',
    };
    (vehicles.default as any).findById = jest.fn(() => testVehicle);
    (vehicles.default as any).getSearchResultsByLocation = jest.fn(() => ({
      jsonString: JSON.stringify([
        {
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          status: 'available',
          batteryPercentage: 100,
          model: 'Test Scooter',
          qrCode: '000000',
          geoHash: 's00000000',
        },
        {
          id: '3e91befa-85e1-48c5-867f-f4cd11a90705',
          status: 'available',
          batteryPercentage: 17,
          model: 'Mi Electric Scooter',
          qrCode: '000083',
          geoHash: 'sv8wrxwjuu',
        },
        {
          id: '47873463-e76e-40a7-a277-afaa74545eac',
          status: 'available',
          batteryPercentage: 27,
          model: 'Mi Electric Scooter',
          qrCode: '000036',
          geoHash: 'sv8wrnsn3e',
        },
      ]),
    }));
    (kafka as any).default.sendMessage = jest.fn().mockResolvedValue(null);
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/vehicles/wa14g438`)
      .set('authorization', 'Bearer ' + TEST_USER_AUTH_TOKEN)
      .set('version', clientVersion);
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({
      vehicles: [testVehicle],
    });
  });

  it('should success to unlock scooter with qrCode = 000000', async () => {
    (activeRides as any).default.getActiveRide = jest.fn().mockResolvedValue(null);
    (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
    (userJobs as any).default.insert = jest.fn().mockResolvedValue(null);
    (kafka as any).default.sendMessage = jest.fn().mockResolvedValue(null);
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/vehicle/000000/unlock`)
      .set('authorization', 'Bearer ' + TEST_USER_AUTH_TOKEN)
      .set('version', clientVersion);
    expect(res.status).to.eql(200);
  });

  it('should fail to unlock scooter with qrCode != 000000, and respond 400', async () => {
    (kafka as any).default.sendMessage = jest.fn().mockResolvedValue(null);
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/vehicle/000001/unlock`)
      .set('authorization', 'Bearer ' + TEST_USER_AUTH_TOKEN)
      .set('version', clientVersion);
    expect(res.status).to.eql(400);
  });
});

describe('baseRoute for Regular user', () => {

  it('verifyCode with code = 0000 should make a verification_check and fail for regular user', async () => {
    const authyMock = {
      phones: jest.fn(() => ({
        verification_check: jest.fn((phone, countryCode, verificationCode, cb) =>
          cb({ error_code: TWILIO_INVALID_VERIFICATION_CODE })),
      })),
    };
    (AccountControllerCommon as any)._authy = authyMock;
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/verify-code`)
      .query({ phoneNumber: REGULAR_USER_PHONE_NUMBER, countryCode: '972', verificationCode: '0000' })
      .set('version', clientVersion);
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({ verified: false });
  });

  it('account should call DB and return regular user data', async () => {
    (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
    (activeRides as any).default.getActiveRide = jest.fn(() => Promise.resolve({}));
    (riders.default as any).findById = jest.fn(() => ({
      id: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
      davBalance: 3.5,
    }));
    (rideSummary as any).default.getRideHistory = jest.fn().mockResolvedValue([]);
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/account`)
      .set('authorization', 'Bearer ' + REGULAR_USER_AUTH_TOKEN)
      .set('version', clientVersion);
    expect(res.status).to.eql(200);
    expect(res.body).to.have.property('account');
    expect(res.body.account).to.deep.include({
      id: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
      isPaymentValid: false,
      davBalance: 3.5,
      activeRide: {
        statusCode: 200,
        ride: {},
      },
    });
  });

  it('should respond with scooter list that not contain the test scooter', async () => {
    (vehicles.default as any).getSearchResultsByLocation = jest.fn(() => ({
      jsonString: JSON.stringify([
        {
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          status: 'available',
          batteryPercentage: 100,
          model: 'Test Scooter',
          qrCode: '000000',
          geoHash: 's00000000',
        },
        {
          id: '3e91befa-85e1-48c5-867f-f4cd11a90705',
          status: 'available',
          batteryPercentage: 17,
          model: 'Mi Electric Scooter',
          qrCode: '000083',
          geoHash: 'sv8wrxwjuu',
        },
        {
          id: '47873463-e76e-40a7-a277-afaa74545eac',
          status: 'available',
          batteryPercentage: 27,
          model: 'Mi Electric Scooter',
          qrCode: '000036',
          geoHash: 'sv8wrnsn3e',
        },
      ]),
    }));
    (kafka as any).default.sendMessage = jest.fn().mockResolvedValue(null);
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/vehicles/wa14g438`)
      .set('authorization', 'Bearer ' + REGULAR_USER_AUTH_TOKEN)
      .set('version', clientVersion);
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({
      vehicles: [
        {
          id: '3e91befa-85e1-48c5-867f-f4cd11a90705',
          status: 'available',
          batteryLevel: 17,
          model: 'Mi Electric Scooter',
          qrCode: '000083',
          geoHash: 'sv8wrxwjuu',
        },
        {
          id: '47873463-e76e-40a7-a277-afaa74545eac',
          status: 'available',
          batteryLevel: 27,
          model: 'Mi Electric Scooter',
          qrCode: '000036',
          geoHash: 'sv8wrnsn3e',
        },
      ],
    });
  });

  it('should respond not found (404) for qrCode = 000000', async () => {
    (vehicles.default as any).findByQrCode = jest.fn(() => ({
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      status: 'available',
      batteryLevel: 100,
      model: 'Test Scooter',
      qrCode: '000000',
      geoHash: 's00000000',
    }));
    (kafka as any).default.sendMessage = jest.fn().mockResolvedValue(null);
    (OwnerDB as any).findById = jest.fn(() => Promise.resolve({fiatCurrencyCode: 'USD'}));
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/vehicle/000000`)
      .set('authorization', 'Bearer ' + REGULAR_USER_AUTH_TOKEN)
      .set('version', clientVersion);
    expect(res.status).to.eql(404);
  });

  it('should fail to unlock scooter with qrCode = 000000, and respond 400', async () => {
    (kafka as any).default.sendMessage = jest.fn().mockResolvedValue(null);
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/vehicle/000000/unlock`)
      .set('authorization', 'Bearer ' + REGULAR_USER_AUTH_TOKEN)
      .set('version', clientVersion);
    expect(res.status).to.eql(400);
  });

});
