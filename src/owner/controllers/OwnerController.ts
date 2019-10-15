import { Request, Response } from 'express';
import Owner from '../cassandra/Owner';
import Logger from '../../common/lib/Logger';

export default class OwnerController {
  public static async getOwnerStats(request: Request, response: Response) {
    try {
      const date = request.query.date;
      if (new Date(date) instanceof Date && isFinite(Date.parse(date))) {
        const stats = await Owner.getOwnerStats(request.user.id, date);
        response.status(200).json(stats || {});
      } else {
        response.sendStatus(404);
      }
    } catch (err) {
      Logger.log(err);
      // TODO: change to 500 in manager related version
      response.sendStatus(404);
    }
  }
}
