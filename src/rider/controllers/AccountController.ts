import { Request, Response } from 'express';
import AccountControllerCommon from '../../common/controllers/AccountController';
import RiderDB, { IRiderWithActiveRide } from '../cassandra/Rider';
import RideSummaryDB, { IRideSummary } from '../cassandra/RideSummary';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import Logger from '../../common/lib/Logger';
import * as moment from 'moment';
import * as storage from '@google-cloud/storage';
import RideController from './RideController';

const client = new storage.Storage();

const UNSUPPORTED_VERSION = '1.1.x.x';
const INVOICES_BUCKET_NAME = process.env.INVOICES_BUCKET_NAME || '<GCS_BUCKET>';

export default class AccountController {

  public static async verifyClientVersion(request: Request, response: Response) {
    return await AccountControllerCommon.verifyClientVersion(request, response, UNSUPPORTED_VERSION);
  }

  public static async verifyCode(request: Request, response: Response) {
    return await AccountControllerCommon.verifyCode(request, response, RiderDB.insert, RiderDB.findByPhone);
  }

  public static async getCurrentlyLoggedIn(request: IRequestWithAuthentication, response: Response) {
    try {
      return AccountControllerCommon.getCurrentlyLoggedIn(request, response, async (id: string) => {
        const rider: IRiderWithActiveRide = await RiderDB.findById(id) as IRiderWithActiveRide;
        if (rider) {
          rider.activeRide = await RideController.fetchActiveRideWithStatus(rider.id);
          rider.userGotDavReward = !!rider.davBalance;
        }
        return rider;
      });
    } catch (e) {
      response.status(500).json({});
      Logger.log(e);
    }
  }

  public static async updatePersonalDetails(request: IRequestWithAuthentication, response: Response) {
    return await AccountControllerCommon.updatePersonalDetails(request, response, RiderDB.updatePersonalDetails);
  }

  public static async clientLog(request: IRequestWithAuthentication, response: Response) {
    return await AccountControllerCommon.clientLog(request, response);
  }

  public static async getRideHistory(request: IRequestWithAuthentication, response: Response) {
    try {
      const riderId = request.user.id;
      const rideHistory = await RideSummaryDB.getRideHistory(riderId);
      response.status(200).json({ rideHistory });
    } catch (err) {
      Logger.log(err);
      response.status(500).json({ message: 'unexpected error occurred' });
    }
  }

  public static async getRideRecipe(request: Request, response: Response) {
    try {
      const riderId = request.user.id;
      const fileName = `${moment(request.params.date).utc().format('YY-MM-DD_HH-mm_')}${riderId}.pdf`;
      try {
        const bucket = client.bucket(INVOICES_BUCKET_NAME);
        const remoteReadStream = bucket.file(fileName).createReadStream();
        response.set('Cache-Control', 'public, max-age=31557600');
        remoteReadStream.on('end', () => {
          remoteReadStream.destroy();
        });
        remoteReadStream.pipe(response);
      } catch (err) {
        Logger.log(`cannot find ${fileName}`);
        response.status(404).json({ message: 'file not exist' });
      }
    } catch (err) {
      Logger.log(err);
      response.status(500).json({ message: 'unexpected error occurred' });
    }
  }
}
