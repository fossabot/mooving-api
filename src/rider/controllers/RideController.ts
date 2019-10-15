import { Response } from 'express';
import ActiveRidesDB, { IRideWithStatusCode } from '../cassandra/ActiveRides';
import RideSummaryDB, { IRideSummary } from '../cassandra/RideSummary';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import Kafka, { KAFKA_HOST } from '../../common/lib/Kafka';
import Logger from '../../common/lib/Logger';
import Rider from '../cassandra/Rider';
import UserJobs, { IUserJob } from '../../common/cassandra/UserJobs';
import Vehicles from '../../owner/cassandra/Vehicles';
import Owner from '../../owner/cassandra/Owner';

const TIME_TO_RATE = process.env.TIME_TO_RATE || 600;
const END_RIDE_TOPIC = process.env.END_RIDE_TOPIC || 'end-ride';
const UPDATE_DAV_BALANCE_TOPIC = process.env.UPDATE_DAV_BALANCE_TOPIC || 'update-dav-balance';
const UNLOCK_VEHICLE_TOPIC = process.env.UNLOCK_VEHICLE_TOPIC || 'unlock-vehicle';
const RAYVEN_FEEDBACK_TOPIC = process.env.RAYVEN_FEEDBACK_TOPIC || 'rayven-feedback';
const TEST_USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const TEST_VEHICLE_QR_CODE = '000000';

interface IExtendedRideSummary extends IRideSummary {
  currencyUnicode: string;
}

export default class RideController {

  // tslint:disable:object-literal-key-quotes
  private static CURRENCY_TO_UNICODE: { [key: string]: string; } = {
    'USD': '\u0024',
    'EUR': '\u20AC',
    'ILS': '\u20AA',
    'GBP': '\u00A3',
    'HUF': '\u0046',
    'IDR': '\u0052',
    'PHP': '\u20B1',
    'PLN': '\u007A',
  };

  private static rayvenBroadcast(rideSummary: IRideSummary) {
    const rideId = Buffer.from(JSON.stringify({
      vehicleId: rideSummary.vehicleId,
      riderId: rideSummary.riderId,
      startTime: rideSummary.startTime,
    })).toString('base64');
    const message = {
      vehicle_id: rideSummary.vehicleId,
      user_id: rideSummary.riderId,
      ride_id: rideId,
      rating: rideSummary.rating,
      price: rideSummary.price,
      currency: rideSummary.currencyCode,
      feedback_tags: rideSummary.tags,
      datetime: Date.now(),
    };
    Kafka.sendMessage(RAYVEN_FEEDBACK_TOPIC, JSON.stringify(message), KAFKA_HOST);
  }

  public static async getRideSummary(request: IRequestWithAuthentication, response: Response) {
    try {
      const userId = request.user.id;
      const vehicleId = request.query.vehicleId;
      const startTime = request.query.startTime;
      if (!request.user || !request.user.id || !request.query.vehicleId || !request.query.startTime) {
        response.status(400).json({});
        return;
      }
      const rideSummary = await RideSummaryDB.getRideSummary(userId, vehicleId, startTime);
      if (!!rideSummary) {
        const extendedRideSummary: IExtendedRideSummary = {
          ...rideSummary,
          currencyUnicode: RideController.CURRENCY_TO_UNICODE[rideSummary.currencyCode],
          davAwarded: rideSummary.davAwarded,
        };
        response.status(200).json(extendedRideSummary);
      } else {
        response.status(200).json(null);
      }
    } catch (err) {
      Logger.log(err);
      response.status(500).json({});
    }
  }

  public static return200BodyNull(request: IRequestWithAuthentication, response: Response) {
    response.status(200).json(null);
  }

  public static async fetchActiveRideWithStatus(riderId: string): Promise<IRideWithStatusCode> {
    const ride = await ActiveRidesDB.getActiveRide(riderId);
    const statusCode = await RideController.getUserJobStatus(riderId, !!ride);
    return {
      statusCode,
      ride: ride || {},
    };
  }

  public static async getUserJobStatus(riderId: string, isRideActive: boolean): Promise<number> {
    const userJob: IUserJob = await UserJobs.getUserJob(riderId);
    if (!userJob) {
      if (isRideActive) {
        return 200;
      } else {
        return 404;
      }
    } else {
      if (userJob.type === 'unlock') {
        if (userJob.state === 'started') {
          if (isRideActive) {
            await UserJobs.delete(riderId);
            return 200;
          } else {
            return 404;
          }
        } else if (userJob.state === 'failed') {
          await UserJobs.delete(riderId);
          return 424;
        } else {
          return 404;
        }
      } else {
        return 400;
      }
    }
  }

  public static async getActiveRide(request: IRequestWithAuthentication, response: Response) {
    try {
      const userId = request.user.id;
      const rideWithStatus = await RideController.fetchActiveRideWithStatus(userId);
      response.status(rideWithStatus.statusCode).json(rideWithStatus.ride);
    } catch (err) {
      Logger.log(err);
      response.status(500).json({});
    }
  }

  public static async unlockVehicle(request: IRequestWithAuthentication, response: Response) {
    const qrCode = request.params.code;
    const riderId = request.user.id;
    if ((riderId === TEST_USER_ID) !== (qrCode === TEST_VEHICLE_QR_CODE)) {
      return response.status(400).json({ message: `Try to Unlock test scooter from non test user` });
    }
    try {
      const ride = await ActiveRidesDB.getActiveRide(riderId);
      const jobExistForRider = await UserJobs.getUserJob(riderId);
      if (!ride && !jobExistForRider) {
        const message = {
          qrCode,
          riderId,
          jobId: riderId,
        };
        if (riderId !== TEST_USER_ID) {
          const rider = await Rider.findById(riderId);
          if (!rider || !rider.paymentMethodId) {
            Logger.log(`rider ${riderId} has no payment method id`);
            response.status(400).json({});
            return;
          }
        }
        await UserJobs.insert({ id: riderId, state: 'pending', type: 'unlock' });
        await Kafka.sendMessage(UNLOCK_VEHICLE_TOPIC, JSON.stringify(message), KAFKA_HOST);
        response.status(200).json({ message: 'ok' });
      } else {
        response.sendStatus(400);
      }
    } catch (err) {
      Logger.log(err);
      response.status(500).json({});
    }
  }

  public static async lockVehicle(request: IRequestWithAuthentication, response: Response) {
    const riderId = request.user.id;
    const { parkingImageUrl } = request.body;
    const paymentMethodDAV = false;
    try {
      const ride = await ActiveRidesDB.getActiveRide(riderId);
      if (!!ride) {
        const message = {
          riderId,
          parkingImageUrl,
          paymentMethodDAV,
        };
        await Kafka.sendMessage(END_RIDE_TOPIC, JSON.stringify(message), KAFKA_HOST);
        response.status(200).json({ message: 'ok' });
      } else {
        response.sendStatus(400);
      }
    } catch (err) {
      Logger.log(err);
      response.status(500).json({});
    }
  }

  public static async rate(request: IRequestWithAuthentication, response: Response) {
    try {
      const riderId = request.user.id;
      const { vehicleId, startTime, tags, rating } = request.body;
      if (!vehicleId || !startTime) {
        response.status(400).json({});
        return;
      }
      const rideSummary = await RideSummaryDB.getRideSummary(riderId, vehicleId, startTime);
      const isRateAllowed = Date.now() - Number(TIME_TO_RATE) * 1000 < Number(new Date(rideSummary.endTime));
      if (isRateAllowed) {
        await RideSummaryDB.setRating({
          riderId,
          vehicleId,
          startTime,
          tags,
          rating,
          effectiveDate: rideSummary.effectiveDate,
        });
        RideController.rayvenBroadcast({ ...rideSummary, riderId, vehicleId, startTime, tags, rating });
        response.status(200).json({});
      } else {
        return response.status(403)
          .json({ message: `Time for feedback is expired, you had to post your feedback within ${Number(TIME_TO_RATE) / 60} minutes` });
      }
    } catch (err) {
      Logger.log(err);
      response.status(500).json({ message: 'unexpected error occurred' });
    }
  }

  public static async setRidePaymentMethod(request: IRequestWithAuthentication, response: Response) {
    try {
      const riderId = request.user.id;
      const { vehicleId, startTime, method: paymentMethod } = request.body;
      const paymentMethodDav = paymentMethod === 'dav';
      const message = {
        riderId,
        vehicleId,
        startTime,
        paymentMethodDav,
      };
      if (!vehicleId || !startTime) {
        response.status(400).json({});
        return;
      }
      await Kafka.sendMessage(UPDATE_DAV_BALANCE_TOPIC, JSON.stringify(message), KAFKA_HOST);
      response.status(200).json({});
    } catch (err) {
      Logger.log(err);
      response.status(500).json({ message: 'unexpected error occurred' });
    }
  }

  public static formatRating(request: IRequestWithAuthentication, response: Response, next: () => void) {
    request.body.rating = request.body.rating ? 5 : 1;
    next();
  }
}
