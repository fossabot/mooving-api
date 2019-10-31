import * as chai from 'chai';
import chaiHttp = require('chai-http');
import { Auth } from '../common/lib/Auth';
import Api from './Api';
import * as cassandra from '../common/cassandra/client';
import * as vehicles from './cassandra/Vehicles';
import * as owners from './cassandra/Owner';
import * as kafka from '../common/lib/Kafka';
import * as LibPhoneNumber from 'libphonenumber-js';
import AccountControllerCommon from '../common/controllers/AccountController';
import AccountController from './controllers/AccountController';

chai.use(chaiHttp);
const expect = chai.expect;
const TWILIO_INVALID_VERIFICATION_CODE = '60022';
const TEST_USER_PHONE_NUMBER = '972500000000';
const REGULAR_USER_PHONE_NUMBER = '<PHONE_NUMBER>';
const TEST_USER_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZmZi1mZm' +
  'ZmLWZmZmZmZmZmZmZmZiIsImlhdCI6MTU0OTg5OTg2OH0.a8B_zN8iALmRW0AQPrNGYW_ou5--8p5uR2adFOgnArk';

const REGULAR_USER_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZmZmZmZmZmLWZmZmYtZmZmZi1mZm' +
  'ZmLWZmZmZmZmZmZmZmMSIsImlhdCI6MTU1MTM0OTcwMn0.oqbPF9nSlk3C7xiDU_u9qF9L9IosU0PzoJH1rMHVBO4';

describe('baseRoute for Test user', () => {

  it('send sms should respond correctly for test user', async () => {
    const api = new Api();
    const res = await chai.request(api.server).post(`/api/sms`)
      .query({ phoneNumber: TEST_USER_PHONE_NUMBER, countryCode: '972' });
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({ message: `Ride Hailing api sent sms to ${TEST_USER_PHONE_NUMBER}` });
  });

  it('verifyCode with code = 0000 should not call verification_check, and success for test user', async () => {
    const authyMock = {
      phones: jest.fn(() => ({
        verification_check: jest.fn((phone, countryCode, verificationCode, cb) =>
          cb({ error_code: TWILIO_INVALID_VERIFICATION_CODE })),
      })),
    };
    (AccountControllerCommon as any)._authy = authyMock;
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/verify-code`)
      .query({ phoneNumber: REGULAR_USER_PHONE_NUMBER, countryCode: '972', verificationCode: '0000' });
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({ verified: false });
  });

  it('account should return test user data', async () => {
    (owners.default as any).findById = jest.fn(() => ({
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      davBalance: 5,
    }));
    (owners.default as any).getOwnerDavBalanceDelta = jest.fn(() => ({
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      davBalance: 1,
    }));
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/account`)
      .set('authorization', 'Bearer ' + TEST_USER_AUTH_TOKEN);
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({
      account: {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        isPaymentValid: false,
        davBalance: 6,
      },
    });
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
      .query({ phoneNumber: REGULAR_USER_PHONE_NUMBER, countryCode: '972', verificationCode: '0000' });
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({ verified: false });
  });

  it('account should call DB and return regular user data', async () => {
    (owners.default as any).findById = jest.fn(() => ({
      id: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
      davBalance: 10,
    }));
    (owners.default as any).getOwnerDavBalanceDelta = jest.fn(() => ({
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      davBalance: 1,
    }));
    const api = new Api();
    const res = await chai.request(api.server).get(`/api/auth/account`)
      .set('authorization', 'Bearer ' + REGULAR_USER_AUTH_TOKEN);
    expect(res.status).to.eql(200);
    expect(res.body).to.eql({
      account: {
        id: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
        isPaymentValid: false,
        davBalance: 11,
      },
    });
  });
});
