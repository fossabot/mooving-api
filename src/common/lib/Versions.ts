import { Request, Response, NextFunction } from 'express';

export default class Versions {

  public static check(isSupported: (version: string) => boolean ) {
    return (req: Request, res: Response, next: NextFunction) => {
      // if the clientVersion isSupported, pass the control to the next middleware
      const clientVersion = req.header('version') || '0';
      if (clientVersion && isSupported(clientVersion)) {
        next();
      } else { // otherwise skip to the next route
        next('route');
      }
    };
  }
}
