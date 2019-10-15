import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { IRequestWithAuthentication } from '../lib/Auth';
import DAVTokenController from './DAVTokenController';

const responseMock = () => {
  const res: any = {
    sendStatus: jest.fn((status: number) => res),
    send: jest.fn((message: string) => res),
    status: jest.fn((status: number) => res),
    json: jest.fn((body: any) => res),
  };
  return res;
};

describe('TokenController class', () => {
  describe('authenticateDriver method', () => {

    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
      jest.clearAllMocks();
    });

    it('should send tokens when valid password is provided', async () => {
      const id = uuid();
      const password = 'funindav1234';
      const ip = '10.0.0.1';
      const city = 'Vatican';
      const hashedPassword = '$2b$10$K6BIhI1E6tBtsiWvBlh/zuN.C.2yT5Cu/GCOJHs9419Bm1PefvPyu';

      const driver = {
        recipientAddress: '0x0',
        tokenAmount: 15,
        password,
      };

      const savedDriver = {
        id,
        createdFrom: ip,
        email: 'test@dav.network',
        firstName: 'His Holiness Pope Francis',
        lastName: 'Francis',
        password: '$2b$10$K6BIhI1E6tBtsiWvBlh/zuN.C.2yT5Cu/GCOJHs9419Bm1PefvPyu',
        phoneConfirmed: true,
        phoneNumber: '+1236479879',
        profileImageUrl: 'Img1',
      };

      jest.doMock('bcrypt', () => ({
        compare: jest.fn((receivedPass, savedPass) => Promise.resolve(true)),
      }));

      const findById = jest.fn(d => savedDriver);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        body: driver,
        user: { id },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      await DAVTokenController.tokenTransfer(findById)(requestMockInstance, responseMockInstance);
      expect(findById).toHaveBeenCalledWith(id);
      expect(findById).toHaveBeenCalledTimes(1);
      expect(responseMockInstance.sendStatus).toBeCalledWith(200);
    });

  });

  it('should fail when password is invalid', async () => {
    const id = uuid();
    const password = 'funindav123456';
    const ip = '10.0.0.1';
    const city = 'Vatican';
    const hashedPassword = '$2b$10$K6BIhI1E6tBtsiWvBlh/zuN.C.2yT5Cu/GCOJHs9419Bm1PefvPyu';

    const driver = {
      recipientAddress: '0x0',
      tokenAmount: 15,
      password,
    };

    const savedDriver = {
      id,
      createdFrom: ip,
      email: 'test@dav.network',
      firstName: 'His Holiness Pope Francis',
      lastName: 'Francis',
      password: '$2b$10$K6BIhI1E6tBtsiWvBlh/zuN.C.2yT5Cu/GCOJHs9419Bm1PefvPyu',
      phoneConfirmed: true,
      phoneNumber: '+1236479879',
      profileImageUrl: 'Img1',
    };

    jest.doMock('bcrypt', () => ({
      compare: jest.fn((receivedPass, savedPass) => Promise.resolve(false)),
    }));

    const findById = jest.fn(d => savedDriver);
    const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
      body: driver,
      user: { id },
    }));
    const requestMockInstance = new requestMock();
    const responseMockInstance = responseMock();
    await DAVTokenController.tokenTransfer(findById)(requestMockInstance, responseMockInstance);
    expect(findById).toHaveBeenCalledTimes(1);
    expect(responseMockInstance.status).toBeCalledWith(401);
    expect(responseMockInstance.send).toBeCalledWith('Driver authentication failed');
  });
});
