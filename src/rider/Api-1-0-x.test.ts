import * as chai from 'chai';
import chaiHttp = require('chai-http');
import { Auth } from '../common/lib/Auth';
import Api from './Api';
import * as kafka from '../common/lib/Kafka';
import * as riders from './cassandra/Rider';
import * as activeRides from './cassandra/ActiveRides';
import * as rideSummary from './cassandra/RideSummary';
import * as userJobs from '../common/cassandra/UserJobs';
import * as LibPhoneNumber from 'libphonenumber-js';
import AccountControllerCommon from '../common/controllers/AccountController';
import * as auth from '../common/lib/Auth';

chai.use(chaiHttp);
const expect = chai.expect;

const USER_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const VEHICLE_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff2';

const QR_CODE = '000083';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZmZi1mZm' +
  'ZmLWZmZmZmZmZmZmZmMSIsImlhdCI6MTU1MTM0OTcwMn0.oqbPF9nSlk3C7xiDU_u9qF9L9IosU0PzoJH1rMHVBO4';

describe('baseRoute', () => {

  beforeAll(() => {
    process.env.TWILIO_API_KEY = 'apiKey';
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should be json', async () => {
    const api = new Api();
    const res = await chai.request(api.server).get('/');
    expect(res.type).to.eql('application/json');
    expect(res.body.message).to.contain('API');
  });

  it('should return not found for verify client version', async () => {
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/verify-client-version`);
    expect(res.status).to.eql(404);
  });

  it('should return an array with no vehicles', async () => {
    const api = new Api();
    const res = await chai.request(api.server).get(`/vehicles/sv8wrxwj`)
      .set('authorization', 'Bearer ' + AUTH_TOKEN);
    expect(res.body.vehicles).to.eql([]);
  });

  it('should not return vehicle', async () => {
    const api = new Api();
    const res = await chai.request(api.server).get(`/vehicle/${QR_CODE}`)
      .set('authorization', 'Bearer ' + AUTH_TOKEN);
    expect(res.status).to.eql(404);
  });

  it('should get active ride', async () => {
    const RIDE_START_TIME = '2007-04-05T14:30Z';
    (activeRides as any).default.getActiveRide = jest.fn(() => Promise.resolve({ startTime: RIDE_START_TIME }));
    const api = new Api();
    const res = await chai.request(api.server).get(`/active-ride`)
      .set('authorization', 'Bearer ' + AUTH_TOKEN);
    expect(res.status).to.eql(200);
    expect(res.body).to.eql(null);
  });

  it('should get Account Details', async () => {
    const RIDE_START_TIME = '2007-04-05T14:30Z';
    (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
    (activeRides as any).default.getActiveRide = jest.fn(() => Promise.resolve({ startTime: RIDE_START_TIME }));
    (riders as any).default.findById = jest.fn(() => Promise.resolve({ id: USER_ID }));
    (rideSummary as any).default.getRideHistory = jest.fn().mockResolvedValue([]);
    const api = new Api();
    const res = await chai.request(api.server).get(`/account`)
      .set('authorization', 'Bearer ' + AUTH_TOKEN);
    expect(res.status).to.eql(200);
    expect(res.body).to.have.property('account');
    expect(res.body.account).to.deep.include({ id: USER_ID, isPaymentValid: false });
  });

  it('should update personal details', async () => {
    (riders as any).default.updatePersonalDetails = jest.fn(personalDetails => Promise.resolve({}));
    const api = new Api();
    const res = await chai.request(api.server).put(`/update-personal-details`)
      .set('authorization', 'Bearer ' + AUTH_TOKEN)
      .send({ id: USER_ID });
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({ message: 'Updated user details' });
  });

  it('send sms should respond correctly', async () => {
    const PHONE_NUMBER = '+972500000001';
    (AccountControllerCommon as any)._authy = {
      phones: jest.fn(() => ({
        verification_start: jest.fn((phone, countryCode, options, cb) => cb(false, true)),
      })),
    };
    const api = new Api();
    const res = await chai.request(api.server).post(`/sms`)
      .query({ phoneNumber: PHONE_NUMBER, countryCode: '+972' });
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({ message: `Ride Hailing api sent sms to ${PHONE_NUMBER}` });
  });

  it('verify code should respond correctly', async () => {
    const PHONE_NUMBER = '+972500000001';
    (AccountControllerCommon as any)._authy = {
      phones: jest.fn(() => ({
        verification_check: jest.fn((phone, countryCode, verificationCode, cb) => cb(false, true)),
      })),
    };
    (riders as any).default.findByPhone = jest.fn(phone => Promise.resolve(false));
    (riders as any).default.insert = jest.fn(data => Promise.resolve(USER_ID));
    (LibPhoneNumber as any).parsePhoneNumber = jest.fn((phone: string) => ({ number: phone }));
    (auth as any).Auth.generateSignedToken = jest.fn((userId: string) => AUTH_TOKEN);
    const api = new Api();
    const res = await chai.request(api.server).get(`/verify-code`)
      .query({
        phoneNumber: PHONE_NUMBER,
        countryCode: '+972',
        verificationCode: '0000',
      });
    expect(res.status).to.eql(200);
    const decodedToken = Auth.decodeToken(res.body.token);
    expect(decodedToken).to.have.property('id');
    expect(decodedToken).to.have.property('iat');
  });
});
