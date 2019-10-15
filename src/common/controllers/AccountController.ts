import { Request, Response, NextFunction } from 'express';
import * as bcrypt from 'bcrypt';
import { IRequestWithAuthentication, Auth, IDecodedToken } from '../lib/Auth';
import Logger from '../lib/Logger';
import { parsePhoneNumber } from 'libphonenumber-js';
import uuid = require('uuid');
import { IPersonalDetails, IUser } from '../User';
import compareVersions = require('compare-versions');

const TWILIO_INVALID_VERIFICATION_CODE = '60022';
const TWILIO_EXPIRED_VERIFICATION_CODE = '60023';
const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
const TEST_USER_PHONE_NUMBER = '972500000000';
const TEST_USER_COUNTRY_CODE = '972';
const TEST_USER_VERIFICATION_CODE = '0000';
const TEST_USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

interface IPaymentMethod {
  paymentMethodId: string;
  paymentMethodCustomer: string;
}

interface ILoginDetails {
  email: string;
  password: string;
}

declare module 'express' {
  // tslint:disable-next-line:interface-name
  interface Request {
    isTestUser: boolean;
  }
}

export default class AccountController {

  protected static _authy: any = require('authy')(TWILIO_API_KEY);

  private static getEmailBody(passwordResetLink: string) {
    return `You've recently requested to reset your password for your Mooving account. To change your password, click the link below:
    </br>${passwordResetLink}</br>
    If you didn't make this request, please ignore this email.
    </br>
    Thanks,
    </br>
    Mooving team`;
  }

  public static testUserMiddleware(request: Request, response: Response, next: NextFunction) {
    request.isTestUser = request.user && request.user.id === TEST_USER_ID;
    next();
  }

  public static async clientLog(request: IRequestWithAuthentication, response: Response) {
    const ip = (request.headers['x-forwarded-for'] as string).split(',')[0];
    Logger.log(`Client Log -- ${ip} -- ${JSON.stringify(request.body)}`);
    response.json({});
  }

  public static sendSMS(request: Request, response: Response) {
    if (!request.query.phoneNumber || !request.query.countryCode) {
      response.status(400).json({});
      return;
    }
    if (request.query.phoneNumber.trim() === TEST_USER_PHONE_NUMBER && request.query.countryCode === TEST_USER_COUNTRY_CODE) {
      // This is the Test User/Owner
      response.status(200).json({
        message: `Ride Hailing api sent sms to ${request.query.phoneNumber}`,
      });
    } else {
      AccountController._authy.phones().verification_start(request.query.phoneNumber, request.query.countryCode,
        { via: 'sms', locale: 'en', code_length: '4' }, (err: any, res: any) => {
          if (err) {
            response.status(500).json(err);
          } else {
            response.status(200).json({
              message: `Ride Hailing api sent sms to ${request.query.phoneNumber}`,
            });
          }
        });
    }
  }

  public static async verifyCode(request: Request, response: Response, dbUpdate: (user: IUser) => Promise<void>,
    findByPhone: (phoneNumber: string) => Promise<IUser>) {
    if (!request.query.phoneNumber || !request.query.countryCode || !request.query.verificationCode) {
      response.status(400).json({});
      return;
    }
    const isTestUser = request.query.phoneNumber.trim() === TEST_USER_PHONE_NUMBER &&
      request.query.countryCode === TEST_USER_COUNTRY_CODE;
    if (isTestUser) {
      if (request.query.verificationCode === TEST_USER_VERIFICATION_CODE) {
        const token = Auth.generateSignedToken(TEST_USER_ID);
        response.status(200).json({
          token,
        });
      } else {
        response.status(200).json({
          verified: false,
        });
      }
    } else {
      return new Promise<void>((resolve, reject) => {
        this._authy.phones().verification_check(request.query.phoneNumber, request.query.countryCode, request.query.verificationCode,
          async (err: any, res: any) => {
            if (err) {
              switch (err.error_code) {
                case TWILIO_INVALID_VERIFICATION_CODE: {
                  response.status(200).json({
                    verified: false,
                  });
                  break;
                }
                case TWILIO_EXPIRED_VERIFICATION_CODE: {
                  response.status(200).json({
                    verified: false,
                    expired: true,
                  });
                  break;
                }
                default:
                  response.status(500).json(err);
                  break;
              }
            } else {
              try {
                const formattedPhoneNumber = parsePhoneNumber(`+${request.query.phoneNumber}`);
                const phoneNumber = String(formattedPhoneNumber.number);
                let user = await findByPhone(phoneNumber);
                if (!user) {
                  user = {
                    id: uuid(),
                    phoneNumber,
                    phoneConfirmed: true,
                    createdFrom: request.connection.remoteAddress,
                  };
                  await dbUpdate(user);
                }

                const token = Auth.generateSignedToken(user.id);
                response.status(200).json({
                  token,
                });
              } catch (err) {
                Logger.log(err);
                response.status(500).json(err);
              }
            }
            resolve();
          });
      });
    }
  }

  public static async getCurrentlyLoggedIn(request: IRequestWithAuthentication, response: Response, dbFindById: (id: string) => Promise<IUser>) {
    try {
      const userId = request.user && request.user.id;
      if (!userId) {
        response.status(401).json({
          message: 'User id is not set',
        });
      } else {
        const user = await dbFindById(userId);
        if (!!user) {
          user.isPaymentValid = !!user.paymentMethodId;
          delete user.password;
          delete user.privateKey;
          delete user.paymentMethodId;

          response.status(200).json({
            account: user,
          });
        } else {
          response.status(401).json({});
        }
      }
    } catch (err) {
      response.status(500).json({});
      Logger.log(err);
    }
  }

  public static async authenticate(request: Request, response: Response, dbFindByEmail: (email: string) => Promise<IUser>) {
    const loginDetails: ILoginDetails = request.body;
    const user = await dbFindByEmail(loginDetails.email);
    if (!!user) {
      const passwordCorrect = await bcrypt.compare(loginDetails.password, user.password);
      if (passwordCorrect) {
        const token = Auth.generateSignedToken(user.id);
        response.status(200).json({ token });
        return;
      }
    }
    response.status(200).json({ userAuthenticated: false });
  }

  public static async updatePersonalDetails(request: IRequestWithAuthentication, response: Response,
    updatePersonalDetails: (personalDetails: IPersonalDetails) => Promise<void>) {
    if (request.user && request.user.id) {
      try {
        const personalDetails: IPersonalDetails = request.body;
        personalDetails.id = request.user.id;
        await updatePersonalDetails(personalDetails);
        response.status(200).json({
          message: `Updated user details`,
        });
      } catch (err) {
        response.status(500).json({
          message: `Failed to update user details`,
        });
      }
    } else {
      response.status(401).json({
        message: 'User id is not set',
      });
    }
  }

  public static async verifyClientVersion(request: Request, response: Response, minVersion: string) {
    const clientVersion = request.header('version') || '0';
    if (compareVersions(clientVersion, minVersion) > 0) {
      response.status(200).send('OK');
    } else {
      response.status(404).send('Version Unsupported');
    }
  }
}
