import * as auth from './Auth';
import * as jwt from 'jsonwebtoken';

describe('authentication', () => {

  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should return token', async () => {
    const token = 'token';
    (jwt as any).sign = jest.fn((payload, options) => token);
    expect(auth.Auth.generateSignedToken('123')).toEqual(token);
  });

  it('should authenticate', async () => {
    const token = 'token';
    const driver = { id: '123' };
    const cb = jest.fn((err, user) => user);
    (auth as any).Auth.decodeToken = jest.fn(() => driver);
    const res = auth.Auth.authenticateCallback(token, cb);
    expect(res).toEqual(driver);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(null, driver);
    expect(auth.Auth.decodeToken).toHaveBeenCalledTimes(1);
    expect(auth.Auth.decodeToken).toHaveBeenCalledWith(token);
  });
});
