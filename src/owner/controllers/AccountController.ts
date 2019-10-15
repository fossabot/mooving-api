import { Request, Response } from 'express';
import OwnerDB, { IPersonalDetails, IOwner } from '../cassandra/Owner';
import VehicleDB from '../cassandra/Vehicles';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import AccountControllerCommon from '../../common/controllers/AccountController';
const UNSUPPORTED_VERSION = '1.0.x.x';
export default class AccountController {

  public static async verifyClientVersion(request: Request, response: Response) {
    return await AccountControllerCommon.verifyClientVersion(request, response, UNSUPPORTED_VERSION);
  }

  public static async updatePersonalDetails(request: IRequestWithAuthentication, response: Response) {
    try {
      const personalDetails: IPersonalDetails = request.body;
      const userId = request.user.id;
      const account = await OwnerDB.findById(userId);
      if (account.companyName !== personalDetails.companyName) {
        VehicleDB.updateAllOwnerVehicles(userId, {operatorName: personalDetails.companyName});
      }
      return await AccountControllerCommon.updatePersonalDetails(request, response, OwnerDB.updatePersonalDetails);
    } catch (err) {
      response.status(500).json({
        message: `Failed to update user details`,
      });
    }
  }

  public static async verifyCode(request: Request, response: Response) {
    return await AccountControllerCommon.verifyCode(request, response, OwnerDB.insert, OwnerDB.findByPhone);
  }

  public static async getCurrentlyLoggedIn(request: IRequestWithAuthentication, response: Response) {
    return AccountControllerCommon.getCurrentlyLoggedIn(request, response, async (id: string) => {
      const owner: IOwner = await OwnerDB.findById(id);
      const ownerBalanceDelta = await OwnerDB.getOwnerDavBalanceDelta(id);
      owner.davBalance += ownerBalanceDelta.davBalance;
      return owner;
    });
  }

  public static async clientLog(request: IRequestWithAuthentication, response: Response) {
    return await AccountControllerCommon.clientLog(request, response);
  }
}
