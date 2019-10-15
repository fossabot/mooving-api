import { Request, Response, NextFunction } from 'express';
import StatsController from './../common/controllers/StatsController';
import AccountController from './controllers/AccountController';
import * as compareVersions from 'compare-versions';
import VehicleController from './controllers/VehicleController';
import OwnerController from './controllers/OwnerController';
import ApiBase from '../common/Api';
import AccountControllerCommon from '../common/controllers/AccountController';
import { Router } from 'express';
import passport = require('passport');
import Logger from '../common/lib/Logger';
import * as bodyParser from 'body-parser';
import Versions from '../common/lib/Versions';

export default class Api extends ApiBase {

  private routesForOldAPI() {
    const auth = passport.authenticate('bearer', { session: false });
    this.server.get('/vehicles', Versions.check((v: string) => compareVersions(v, '1.0.x.x') <= 0),
      auth, VehicleController.getEmptyVehiclesSet);
  }

  protected config(): void {
    super.config();

    this.server.get('/', StatsController.getInfo('Owner'));
    this.server.get('/health', StatsController.getInfo('Owner'));

    this.routesForOldAPI();
    const api = Router();
    const auth = Router();

    this.server.use('/api/', api);
    this.server.use('/api/auth/', passport.authenticate('bearer', { session: false }), AccountControllerCommon.testUserMiddleware, auth);

    api.post('/sms', AccountControllerCommon.sendSMS);
    api.get('/verify-code', AccountController.verifyCode);
    api.post('/client-log', bodyParser.text({ type: '*/*' }), AccountController.clientLog);
    api.get('/verify-client-version', AccountController.verifyClientVersion);

    auth.put('/update-personal-details', AccountController.updatePersonalDetails);
    auth.get('/account', AccountController.getCurrentlyLoggedIn);
    auth.get('/vehicles', VehicleController.getOwnerVehicles);
    auth.get('/vehicles/statuses', VehicleController.getOwnerVehiclesStatuses);
    auth.get('/vehicles/:id', VehicleController.getVehicleDetails);
    auth.put('/vehicles/:id/:status', VehicleController.changeStatus);
    auth.get('/vehicles/:id/feedbacks', VehicleController.getFeedbacks);
    auth.get('/owner/stats', OwnerController.getOwnerStats);

    this.server.use((err: any, req: Request, res: Response, next: NextFunction) => {
      Logger.log(err);
      res.sendStatus(500).json(err);
    });
    this.server.use('*', (req: Request, res: Response, next: NextFunction) => {
      res.sendStatus(404);
    });
  }
}
