import { Request, Response } from 'express';

// tslint:disable-next-line:no-var-requires
const userAgentDeviceDetector = require('ua-device-detector');

const IOS_APP_ID = process.env.IOS_APP_ID || '<IOS_APP_ID>';

export default class DeepLinksController {
  public static async appleAppSiteAssociation(request: Request, response: Response) {
    response.send({
      applinks: {
        apps: [],
        details: [
              {
                appID: IOS_APP_ID,
                paths: ['*'],
              },
          ],
      },
  });
  }

  public static async unlock(request: Request, response: Response) {
    const userAgent = request.get('User-Agent');
    const deviceInfo = userAgentDeviceDetector.parseUserAgent(userAgent);
    if (deviceInfo.os === 'android') {
      response.redirect('https://play.google.com/store/apps/details?id=<HOSTNAME>');
    } else if (deviceInfo.os === 'ios') {
      response.redirect('https://itunes.apple.com/us/app/<ITUNES_URL>');
    } else {
      response.redirect('https://<HOSTNAME>/app');
    }
  }
}
