import { Request, Response } from 'express';
import AccountController from './AccountController';
import * as auth from '../../common/lib/Auth';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import * as LibPhoneNumber from 'libphonenumber-js';
import * as bcrypt from 'bcrypt';
import Logger from '../lib/Logger';
import { IUser } from '../User';
import { IPersonalDetails } from '../../owner/cassandra/Owner';

const TEST_USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const TEST_USER_PHONE = '972500000000';
const TEST_USER_COUNTRY_CODE = '972';

describe('AccountController class', () => {

  const responseMock = () => {
    const res: any = {
      sendStatus: jest.fn((status: number) => res),
      status: jest.fn((status: number) => res),
      json: jest.fn((body: any) => res),
    };
    return res;
  };

  describe('testUserMiddleware', () => {
    it('should identify test user', (next: any) => {
      const requestMock = jest.fn<Request>(() => ({
        user: { id: TEST_USER_ID },
      }));
      const request = new requestMock();
      const response = responseMock();

      AccountController.testUserMiddleware(request, response, () => {
        expect(request.isTestUser).toBeTruthy();
        next();
      });
    });

    it('should identify non-test user', (next: any) => {
      const requestMock = jest.fn<Request>(() => ({
        user: { id: '0' },
      }));
      const request = new requestMock();
      const response = responseMock();

      AccountController.testUserMiddleware(request, response, () => {
        expect(request.isTestUser).toBeFalsy();
        next();
      });
    });
  });

  describe('sendSMS', () => {

    it('should get 200 response when valid params are sent for non test user', () => {
      const authyMock = {
        phones: () => authyPhonesMock,
      };
      (AccountController as any)._authy = authyMock;
      const authyPhonesMock = {
        verification_start: jest.fn((phone: string, country: string, configObject: any, cb: (err: any, res: any) => void) =>
          cb(null, null)),
      };

      const phoneNumber = '1234567';
      const countryCode = '972';
      const requestMock = jest.fn<Request>(() => ({
        query: { phoneNumber, countryCode },
      }));
      const requestMockInstance = new requestMock();

      const responseMockInstance = responseMock();

      (AccountController as any)._authy = authyMock;
      AccountController.sendSMS(requestMockInstance, responseMockInstance);

      expect(authyPhonesMock.verification_start).toBeCalledWith(phoneNumber, countryCode, expect.anything(), expect.anything());
      expect(responseMockInstance.status).toBeCalledWith(200);
      expect(responseMockInstance.json).toBeCalledWith({
        message: `Ride Hailing api sent sms to ${phoneNumber}`,
      });
    });

    it('should get 500 response due to authy error', async () => {
      (AccountController as any)._authy = {
        phones: () => authyPhonesMock,
      };
      const authyPhonesMock = {
        verification_start: jest.fn((phone: string, country: string, configObject: any, cb: (err: any, res: any) => void) =>
          cb('error', null)),
      };

      const phoneNumber = '1234567';
      const countryCode = '972';
      const requestMock = jest.fn<Request>(() => ({
        query: { phoneNumber, countryCode },
        connection: { remoteAddress: 'address' },
      }));
      const requestMockInstance = new requestMock();

      const responseMockInstance = responseMock();

      AccountController.sendSMS(requestMockInstance, responseMockInstance);

      expect(authyPhonesMock.verification_start).toBeCalledWith(phoneNumber, countryCode, expect.anything(), expect.anything());
      expect(responseMockInstance.status).toBeCalledWith(500);
      expect(responseMockInstance.json).toBeCalledWith(expect.anything());
    });

    it('should not send for test user', async () => {
      const requestMock = jest.fn<Request>(() => ({
        query: {
          phoneNumber: TEST_USER_PHONE,
          countryCode: TEST_USER_COUNTRY_CODE,
        },
      }));

      const verificationStart = jest.fn((a: any, b: any, c: any, cb: (err: any, res: any) => void) => { cb(null, null); });
      const phones = jest.fn(() => ({ verification_start: verificationStart }));

      const request = new requestMock();
      const response = responseMock();
      (AccountController as any)._authy = { phones };

      await AccountController.sendSMS(request, response);

      expect(phones).not.toHaveBeenCalled();
      expect(verificationStart).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
    });
  });

  describe('verifyCode', () => {
    it('should verify code and insert new user to DB for non-test user', async () => {
      const requestMock = jest.fn<Request>(() => ({
        connection: { remoteAddress: '' },
        query: {
          phoneNumber: '55555555',
          countryCode: '+972',
          verificationCode: '1111',
        },
      }));

      const verificationCheck = jest.fn((a: any, b: any, c: any, cb: (err: any, res: any) => void) => { cb(null, null); });
      const phones = jest.fn(() => ({ verification_check: verificationCheck }));

      const request = new requestMock();
      const response = responseMock();
      (AccountController as any)._authy = { phones };

      const insert = jest.fn().mockResolvedValue('blah-blah');
      const findByPhone = jest.fn().mockResolvedValue(null);
      const token = 'token';
      (auth as any).Auth.generateSignedToken = jest.fn((userId: string) => token);

      await AccountController.verifyCode(request, response, insert, findByPhone);

      expect(phones).toHaveBeenCalled();
      expect(verificationCheck).toHaveBeenCalled();
      expect(insert).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toBeCalledWith({ token });
    });

    it('should throw error due to DB error for non-test user', async () => {
      const requestMock = jest.fn<Request>(() => ({
        connection: { remoteAddress: '' },
        query: {
          phoneNumber: '55555555',
          countryCode: '+972',
          verificationCode: '1111',
        },
      }));

      const verificationCheck = jest.fn((a: any, b: any, c: any, cb: (err: any, res: any) => void) => { cb(null, null); });
      const phones = jest.fn(() => ({ verification_check: verificationCheck }));

      const request = new requestMock();
      const response = responseMock();
      (AccountController as any)._authy = { phones };

      const insert = jest.fn().mockRejectedValue('DB error');
      const findByPhone = jest.fn().mockResolvedValue(null);

      await AccountController.verifyCode(request, response, insert, findByPhone);

      expect(phones).toHaveBeenCalled();
      expect(verificationCheck).toHaveBeenCalled();
      expect(insert).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toBeCalledWith('DB error');
    });

    it('should verify code and not update existing user for non-test user', async () => {
      const user: IUser = {
        id: 'bla',
        firstName: 'bla',
        lastName: 'bla',
        phoneNumber: '55555555',
      };
      const requestMock = jest.fn<Request>(() => ({
        connection: { remoteAddress: '' },
        query: {
          phoneNumber: '55555555',
          countryCode: '+972',
          verificationCode: '1111',
        },
      }));

      const verificationCheck = jest.fn((a: any, b: any, c: any, cb: (err: any, res: any) => void) => { cb(null, null); });
      const phones = jest.fn(() => ({ verification_check: verificationCheck }));

      const request = new requestMock();
      const response = responseMock();
      (AccountController as any)._authy = { phones };

      const insert = jest.fn().mockResolvedValue('blah-blah');
      const findByPhone = jest.fn().mockResolvedValue(user);
      (LibPhoneNumber as any).parsePhoneNumber = jest.fn((phone: string) => ({ number: '12345' }));
      const token = 'token';
      (auth as any).Auth.generateSignedToken = jest.fn((userId: string) => token);

      await AccountController.verifyCode(request, response, insert, findByPhone);

      expect(phones).toHaveBeenCalled();
      expect(verificationCheck).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toBeCalledWith({ token });
      expect(findByPhone).toHaveBeenCalledWith('12345');
      expect(insert).not.toHaveBeenCalled();
    });

    it('should throw error due to phone parsing error', async () => {
      const user: IUser = {
        id: 'bla',
        firstName: 'bla',
        lastName: 'bla',
        phoneNumber: '55555555',
      };
      const requestMock = jest.fn<Request>(() => ({
        connection: { remoteAddress: '' },
        query: {
          phoneNumber: '55555555',
          countryCode: '+972',
          verificationCode: '1111',
        },
      }));

      const verificationCheck = jest.fn((a: any, b: any, c: any, cb: (err: any, res: any) => void) => { cb(null, null); });
      const phones = jest.fn(() => ({ verification_check: verificationCheck }));

      const request = new requestMock();
      const response = responseMock();
      (AccountController as any)._authy = { phones };

      const insert = jest.fn().mockResolvedValue('blah-blah');
      const findByPhone = jest.fn().mockResolvedValue(user);
      (LibPhoneNumber as any).parsePhoneNumber = jest.fn((phone: string) => { throw new Error('parse error'); });
      const token = 'token';

      await AccountController.verifyCode(request, response, insert, findByPhone);

      expect(phones).toHaveBeenCalled();
      expect(verificationCheck).toHaveBeenCalled();
      expect(response.status).toBeCalledWith(500);
      expect(response.json).toBeCalledWith(new Error('parse error'));
    });

    it('should get 200 response with verified false when wrong verification is sent', async () => {
      const authyMock = {
        phones: () => authyPhonesMock,
      };
      (AccountController as any)._authy = authyMock;
      const authyPhonesMock = {
        verification_check: jest.fn((phone: string, country: string, verification: string, cb: (err: any, res: any) => void) =>
          cb({ error_code: '60022' }, null)),
      };

      const phoneNumber = '1234567';
      const countryCode = '972';
      const verificationCode = '1234';
      const requestMock = jest.fn<Request>(() => ({
        query: { phoneNumber, countryCode, verificationCode },
        connection: { remoteAddress: 'address' },
      }));
      const requestMockInstance = new requestMock();

      const responseMockInstance = responseMock();
      const token = 'token';
      (auth as any).generateSignedToken = jest.fn((userId: string) => token);
      const insert = jest.fn().mockResolvedValue('blah-blah');
      const findByPhone = jest.fn().mockResolvedValue(null);

      await AccountController.verifyCode(requestMockInstance, responseMockInstance, insert, findByPhone);
      expect(authyPhonesMock.verification_check).toBeCalledWith(phoneNumber, countryCode, verificationCode, expect.anything());
      expect(responseMockInstance.status).toBeCalledWith(200);
      expect(responseMockInstance.json).toBeCalledWith({ verified: false });
      expect(insert).not.toBeCalled();
      expect(findByPhone).not.toBeCalled();
    });

    it('should get 200 response with verified false and expired true when code has been expired', async () => {
      const authyMock = {
        phones: () => authyPhonesMock,
      };
      (AccountController as any)._authy = authyMock;
      const authyPhonesMock = {
        verification_check: jest.fn((phone: string, country: string, verification: string, cb: (err: any, res: any) => void) =>
          cb({ error_code: '60023' }, null)),
      };

      const phoneNumber = '1234567';
      const countryCode = '972';
      const verificationCode = '1397';
      const requestMock = jest.fn<Request>(() => ({
        query: { phoneNumber, countryCode, verificationCode },
        connection: { remoteAddress: 'address' },
      }));
      const requestMockInstance = new requestMock();

      const responseMockInstance = responseMock();
      const token = 'token';
      (auth as any).generateSignedToken = jest.fn((userId: string) => token);
      const insert = jest.fn().mockResolvedValue('blah-blah');
      const findByPhone = jest.fn().mockResolvedValue(null);

      await AccountController.verifyCode(requestMockInstance, responseMockInstance, insert, findByPhone);

      expect(authyPhonesMock.verification_check).toBeCalledWith(phoneNumber, countryCode, verificationCode, expect.anything());
      expect(responseMockInstance.status).toBeCalledWith(200);
      expect(responseMockInstance.json).toBeCalledWith({ verified: false, expired: true });
      expect(insert).not.toBeCalled();
      expect(findByPhone).not.toBeCalled();
      expect(responseMockInstance.json).toBeCalledWith({ verified: false, expired: true });
    });

    it('should not verify code nor update DB for test user', async () => {
      const requestMock = jest.fn<Request>(() => ({
        connection: { remoteAddress: '' },
        query: {
          phoneNumber: TEST_USER_PHONE,
          countryCode: TEST_USER_COUNTRY_CODE,
          verificationCode: '0000',
        },
      }));

      const verificationCheck = jest.fn((a: any, b: any, c: any, cb: (err: any, res: any) => void) => { cb(null, null); });
      const phones = jest.fn(() => ({ verification_check: verificationCheck }));

      const request = new requestMock();
      const response = responseMock();
      (AccountController as any)._authy = { phones };

      const insert = jest.fn().mockResolvedValue('blah-blah');
      const findByPhone = jest.fn().mockResolvedValue({ id: '1' });
      await AccountController.verifyCode(request, response, insert, findByPhone);

      expect(phones).not.toHaveBeenCalled();
      expect(verificationCheck).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getCurrentlyLoggedIn', () => {
    it('should return existing user', async () => {
      const user: IUser = {
        id: '1234',
        firstName: 'name',
        password: 'pass',
        privateKey: null,
      };

      const expectedUser: IUser = {
        id: '1234',
        firstName: 'name',
        isPaymentValid: false,
      };

      const dbFindById = jest.fn().mockResolvedValue(user);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          id: '1234',
        },
      }));
      const request = new requestMock();
      const response = responseMock();
      (auth as any).Auth.serverSecret = 'secret';

      await AccountController.getCurrentlyLoggedIn(request, response, dbFindById);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({ account: expectedUser });
    });

    it('should return 401 due to wrong input', async () => {

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          firstName: 'name',
        },
      }));

      const request = new requestMock();
      const response = responseMock();
      const dbFindById = jest.fn().mockResolvedValue(null);
      (auth as any).Auth.serverSecret = 'secret';

      await AccountController.getCurrentlyLoggedIn(request, response, dbFindById);

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        message: 'User id is not set',
      });
    });

    it('should return 401 due to not existing user in database', async () => {

      const dbFindById = jest.fn().mockResolvedValue(null);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          id: '1234',
        },
      }));
      const request = new requestMock();
      const response = responseMock();
      (auth as any).Auth.serverSecret = 'secret';

      await AccountController.getCurrentlyLoggedIn(request, response, dbFindById);

      expect(response.status).toHaveBeenCalledWith(401);
      expect(dbFindById).toHaveBeenCalledWith('1234');
    });

    it('should return 500 due to database error', async () => {

      const dbFindById = jest.fn().mockRejectedValue('DB error');
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          id: '1234',
        },
      }));
      const request = new requestMock();
      const response = responseMock();
      (Logger as any).log = jest.fn().mockReturnValue(null);
      (auth as any).Auth.serverSecret = 'secret';

      await AccountController.getCurrentlyLoggedIn(request, response, dbFindById);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(dbFindById).toHaveBeenCalledWith('1234');
      expect((Logger as any).log).toHaveBeenCalledWith('DB error');
    });
  });

  describe('authenticate', () => {
    it('should return token for valid password', async () => {
      const user: IUser = {
        id: '1234',
        password: 'pass',
      };
      const dbFindByEmail = jest.fn().mockResolvedValue(user);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        body: {
          email: 'email',
          password: 'pass',
        },
      }));

      const token = 'token';
      const request = new requestMock();
      const response = responseMock();
      (auth as any).Auth.serverSecret = 'secret';
      (auth as any).Auth.generateSignedToken = jest.fn((userId: string) => token);
      (bcrypt as any).compare = jest.fn().mockResolvedValue(true);

      await AccountController.authenticate(request, response, dbFindByEmail);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({ token });
      expect((bcrypt as any).compare).toHaveBeenCalledWith('pass', 'pass');
    });

    it('should return user authenticated false for invalid password', async () => {
      const user: IUser = {
        id: '1234',
        password: 'pass',
      };
      const dbFindByEmail = jest.fn().mockResolvedValue(user);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        body: {
          email: 'email',
          password: 'invalid',
        },
      }));

      const request = new requestMock();
      const response = responseMock();
      (bcrypt as any).compare = jest.fn().mockResolvedValue(false);
      (auth as any).Auth.serverSecret = 'secret';

      await AccountController.authenticate(request, response, dbFindByEmail);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({ userAuthenticated: false });
      expect((bcrypt as any).compare).toHaveBeenCalledWith('invalid', 'pass');
    });

    it('should return user authenticated false for not existing user', async () => {
      const dbFindByEmail = jest.fn().mockResolvedValue(null);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        body: {
          email: 'email',
          password: 'pass',
        },
      }));

      const request = new requestMock();
      const response = responseMock();
      (bcrypt as any).compare = jest.fn().mockResolvedValue(false);

      await AccountController.authenticate(request, response, dbFindByEmail);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({ userAuthenticated: false });
      expect((bcrypt as any).compare).not.toHaveBeenCalled();
    });
  });

  describe('updatePersonalDetails', () => {
    it('should update personal details and return 200', async () => {
      const user: IPersonalDetails = {
        id: '1234',
        firstName: 'first name',
        lastName: 'last name',
        profileImageUrl: 'url',
        email: 'new email',
      };
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        body: {
          firstName: 'first name',
          lastName: 'last name',
          profileImageUrl: 'url',
          email: 'new email',
        },
        user: {
          id: '1234',
        },
      }));

      const request = new requestMock();
      const response = responseMock();
      (auth as any).Auth.serverSecret = 'secret';
      const updatePersonalDetails = jest.fn().mockResolvedValue(null);

      await AccountController.updatePersonalDetails(request, response, updatePersonalDetails);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({ message: 'Updated user details' });
      expect(updatePersonalDetails).toHaveBeenCalledWith(user);
    });

    it('should fail to update personal details and return 500', async () => {
      const user: IPersonalDetails = {
        id: '1234',
        firstName: 'first name',
        lastName: 'last name',
        profileImageUrl: 'url',
        email: 'new email',
      };
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        body: {
          firstName: 'first name',
          lastName: 'last name',
          profileImageUrl: 'url',
          email: 'new email',
        },
        user: {
          id: '1234',
        },
      }));

      const request = new requestMock();
      const response = responseMock();
      (auth as any).Auth.serverSecret = 'secret';
      const updatePersonalDetails = jest.fn().mockRejectedValue(null);

      await AccountController.updatePersonalDetails(request, response, updatePersonalDetails);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({ message: 'Failed to update user details' });
      expect(updatePersonalDetails).toHaveBeenCalledWith(user);
    });
  });
});
