import * as express from 'express';
import StatsController from './../common/controllers/StatsController';
import AccountController from './controllers/AccountController';
import PaymentController from './controllers/PaymentController';
import VehicleController from './controllers/VehicleController';
import RideController from './controllers/RideController';
import * as compareVersions from 'compare-versions';
import Versions from '../common/lib/Versions';
import AccountControllerCommon from '../common/controllers/AccountController';
import * as path from 'path';
import ApiBase from '../common/Api';
import passport = require('passport');
import Logger from '../common/lib/Logger';
import * as bodyParser from 'body-parser';
import DeepLinksController from './controllers/DeeplinksController';

export default class Api extends ApiBase {

  private routesForOldAPI() {
    const auth = passport.authenticate('bearer', { session: false });
    this.server.post('/sms', Versions.check((v: string) => compareVersions(v, '1.1.x.x') <= 0), AccountControllerCommon.sendSMS);
    this.server.get('/verify-code', Versions.check((v: string) => compareVersions(v, '1.1.x.x') <= 0), AccountController.verifyCode);
    this.server.put('/update-personal-details', Versions.check((v: string) => compareVersions(v, '1.1.x.x') <= 0),
      auth, AccountController.updatePersonalDetails);
    this.server.get('/account', Versions.check((v: string) => compareVersions(v, '1.1.x.x') <= 0), auth, AccountController.getCurrentlyLoggedIn);
    this.server.get('/vehicles/:geoHash', Versions.check((v: string) => compareVersions(v, '1.1.x.x') <= 0),
      auth, VehicleController.getEmptyVehiclesSet);
    this.server.get('/vehicle/:code', Versions.check((v: string) => compareVersions(v, '1.1.x.x') <= 0), auth, VehicleController.getNoVehicle);
    this.server.get('/active-ride', Versions.check((v: string) => compareVersions(v, '1.1.x.x') <= 0), auth, RideController.return200BodyNull);
  }

  protected config(): void {
    super.config();

    const sdkDebugLog = process.env.SDK_DEBUG_LOG === 'true' || true;
    if (sdkDebugLog) {
      this.server.use('/', (req, res, next) => {
        const json = res.json;
        const send = res.send;
        (res as any).json = (data: any) => {
          Logger.log(`${req.url}: ${res.statusCode} ${res.statusMessage} ${JSON.stringify(data)}`);
          json.call(res, data);
        };
        (res as any).send = (data: any) => {
          Logger.log(`${req.url}: ${res.statusCode} ${res.statusMessage} ${data}`);
          send.call(res, data);
        };
        next();
      });
    }

    this.server.get('/', StatsController.getInfo('Rider'));
    this.server.get('/health', StatsController.healthCheck('Rider'));

    this.routesForOldAPI();
    const api = express.Router();
    const deepLinks = express.Router();
    const auth = express.Router();

    this.server.use('/deeplinks/', deepLinks);

    deepLinks.get('/apple-app-site-association', DeepLinksController.appleAppSiteAssociation);
    deepLinks.get('/qr/unlock/:qrCode', DeepLinksController.unlock);
    deepLinks.get('/', DeepLinksController.unlock);

    const ensureAuthenticated = passport.authenticate('bearer', { session: false });

    this.server.use('/api/', api);
    this.server.use('/api/auth/', ensureAuthenticated, AccountControllerCommon.testUserMiddleware, auth);

    api.post('/sms', AccountControllerCommon.sendSMS);
    api.get('/verify-code', AccountController.verifyCode);
    api.get('/verify-client-version', AccountController.verifyClientVersion);
    api.get('/support-info/:vehicleId', VehicleController.getSupportInformation);
    api.post('/client-log', bodyParser.text({ type: '*/*' }), AccountController.clientLog);

    auth.put('/update-personal-details', AccountController.updatePersonalDetails);
    auth.get('/account', AccountController.getCurrentlyLoggedIn);
    auth.get('/ride-history', AccountController.getRideHistory);
    auth.get('/generate-payment-token', PaymentController.generateToken);
    auth.put('/credit-card', PaymentController.updateCreditCard);
    auth.get('/credit-card', PaymentController.getCardInfo);
    auth.put('/remove-credit-card', PaymentController.removeCreditCard);
    auth.get('/vehicles/:geoHash', VehicleController.getVehicles);
    auth.get('/vehicle/:code',
      Versions.check((v: string) => compareVersions(v, '1.3.x.x') < 0),
      VehicleController.getVehicleByQrCode);
    auth.get('/vehicle/:code',
      Versions.check((v: string) => compareVersions(v, '1.3.x.x') >= 0),
      VehicleController.formatQrCode,
      VehicleController.getVehicleByQrCode);
    auth.get('/vehicle/:code/unlock', RideController.unlockVehicle);
    auth.post('/vehicle/lock', RideController.lockVehicle);
    auth.get('/ride-summary', RideController.getRideSummary);
    auth.get('/active-ride', RideController.getActiveRide);
    auth.put('/rate', RideController.rate);
    auth.get('/invoice/:date', AccountController.getRideRecipe);
    auth.put('/ride-payment', RideController.setRidePaymentMethod);

    this.server.set('views', './src/static');
    this.server.set('view engine', 'ejs');
    this.server.get('/static/v1/PaymentForm.html', ensureAuthenticated, PaymentController.renderPaymentPage);

    this.server.use('/static', express.static(path.join(__dirname, '../static')));

    this.server.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      Logger.log(err);
      res.status(500).json(err);
    });
    this.server.use('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(404).json({});
    });
  }
}
