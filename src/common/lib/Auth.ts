import * as passport from 'passport';
import { Strategy } from 'passport-http-bearer';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { IUser } from '../User';

export interface IRequestWithAuthentication extends Request {
  user: any;
}

export interface IDecodedToken {
  id: string;
  iat: number;
}

export class Auth {

  private static serverSecret = process.env.JWT_SEED || 'secret';

  public static generateSignedToken(userId: string) {
    const payload = { id: userId };
    return jwt.sign(payload, Auth.serverSecret);
  }

  public static decodeToken(token: string): IDecodedToken {
    const res = jwt.verify(token, Auth.serverSecret) as IDecodedToken;
    if (!!res) {
      return res;
    }
  }

  public static authenticateCallback(token: string, done: (a: any, b?: any) => void) {
    try {
      const user = Auth.decodeToken(token);
      if (user.id) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    } catch (err) {
      return done(err);
    }
  }
}

passport.serializeUser<any, any>((user, done) => {
  done(undefined, user.id);
});

passport.deserializeUser((id: string, done) => {
  try {
    const user = { id };
    done(undefined, user);
  } catch (err) {
    done(err, undefined);
  }
});

passport.use(new Strategy(Auth.authenticateCallback));
