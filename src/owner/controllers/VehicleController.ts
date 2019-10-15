import { Response } from 'express';
import * as uuid from 'uuid';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import VehiclesDB, { IVehicleStats } from '../cassandra/Vehicles';
import Logger from '../../common/lib/Logger';
import { IVehicle, VehicleStatus } from '../../rider/cassandra/Vehicles';
import UserJobs, { IUserJob } from '../../common/cassandra/UserJobs';
import Kafka from '../../common/lib/Kafka';
import { KAFKA_HOST } from '../../common/lib/Kafka';

export default class VehicleController {

  public static readonly topicMap = {
    [`${VehicleStatus.available},${VehicleStatus.notavailable}`]: 'cordon-vehicle',
    [`${VehicleStatus.available},${VehicleStatus.maintenance}`]: 'cordon-garage-vehicle',
    [`${VehicleStatus.notavailable},${VehicleStatus.available}`]: 'uncordon-vehicle',
    [`${VehicleStatus.notavailable},${VehicleStatus.maintenance}`]: 'garage-vehicle',
    [`${VehicleStatus.maintenance},${VehicleStatus.available}`]: 'ungarage-uncordon-vehicle',
    [`${VehicleStatus.maintenance},${VehicleStatus.notavailable}`]: 'ungarage-vehicle',
  };

  private static getTopic(actualStatus: string, desiredStatus: string) {
    return this.topicMap[`${actualStatus},${desiredStatus}`];
  }

  public static async getOwnerVehicles(request: IRequestWithAuthentication, response: Response) {
    try {
      const ownerId = request.user.id;
      const dateString = request.query.date;
      const date: Date = new Date(dateString);
      if (new Date(date) instanceof Date && isFinite(Date.parse(dateString))) {
        const vehicles: IVehicle[] = await VehiclesDB.findVehiclesByOwner(ownerId);
        const vehicleStatsArray: IVehicleStats[] = await VehiclesDB.getOwnerVehiclesStats(ownerId, date);
        const vehicleStats = new Map<string, IVehicleStats>(
          vehicleStatsArray.map(
            (v: IVehicleStats): [string, IVehicleStats] => [v.id, v],
          ),
        );
        response.status(200).json({
          vehicles: vehicles.map(vehicle => ({
            ...vehicle,
            ...vehicleStats.get(vehicle.id),
          })) || [],
        });
      } else {
        response.status(400).json({ message: 'Date is invalid' });
      }
    } catch (err) {
      Logger.log(err);
      response.sendStatus(500);
    }
  }

  public static getEmptyVehiclesSet(request: IRequestWithAuthentication, response: Response) {
    response.status(200).json({
      vehicles: [],
    });
  }

  public static async getOwnerVehiclesStatuses(request: IRequestWithAuthentication, response: Response) {
    try {
      const ownerId = request.user.id;
      const vehicles: IVehicle[] = await VehiclesDB.findVehiclesByOwner(ownerId);
      response.status(200).json({
        vehicles: vehicles.map(vehicle => ({
          id: vehicle.id,
          status: vehicle.status,
          inTransition: vehicle.inTransition,
          geoHash: vehicle.geoHash,
          batteryLevel: vehicle.batteryLevel,
        })),
      });
    } catch (err) {
      Logger.log(err);
      response.sendStatus(500);
    }
  }

  public static async getFeedbacks(request: IRequestWithAuthentication, response: Response) {
    try {
      const ownerId = request.user.id;
      const fromTime = request.query.date;
      const vehicleId = request.params.id;
      const vehicle = await VehiclesDB.findById(vehicleId);
      if (vehicle.ownerId !== ownerId) {
        response.sendStatus(401);
      } else {
        const feedbacks = await VehiclesDB.getOwnerVehiclesFeedbacks(vehicleId, fromTime);
        response.status(200).json({ feedbacks });
      }
    } catch (err) {
      Logger.log(err);
      response.sendStatus(500);
    }
  }

  public static async changeStatus(request: IRequestWithAuthentication, response: Response) {
    try {
      const ownerId = request.user.id;
      const vehicleId = request.params.id;
      const vehicleStatus = request.params.status;
      const vehicle = await VehiclesDB.findById(vehicleId);
      if (vehicle.ownerId !== ownerId) {
        response.sendStatus(401);
        return;
      }
      if (vehicle.status === vehicleStatus) {
        response.status(200).json({ message: 'ok' });
        return;
      }
      const jobId = uuid.v4();
      await UserJobs.insert({ id: jobId, state: 'pending', type: 'vehicle status change' });
      const message: any = {
        vehicleId,
        vendor: vehicle.vendor,
        deviceId: vehicle.deviceId,
        jobId,
      };
      const topic = VehicleController.getTopic(vehicle.status, vehicleStatus);
      await Kafka.sendMessage(topic, JSON.stringify(message), KAFKA_HOST);
      response.status(200).json({ job_id: jobId });
    } catch (err) {
      Logger.log(err);
      response.sendStatus(500);
    }
  }

  public static async getVehicleDetails(request: IRequestWithAuthentication, response: Response) {
    try {
      const ownerId = request.user.id;
      const vehicleId = request.params.id;
      const vehicle = await VehiclesDB.findById(vehicleId);
      if (vehicle !== null) {
        if (vehicle.ownerId === ownerId) {
          const dateString = request.query.date;
          const date: Date = new Date(dateString);
          if (new Date(date) instanceof Date && isFinite(Date.parse(dateString))) {
            let vehicleStats: IVehicleStats = await VehiclesDB.getOwnerVehicleStatsByVehicleId(ownerId, date, vehicle.id);
            if (!vehicleStats) {
              vehicleStats = {
                dailyUse: 0,
                dailyProfit: 0,
                feedbackRatingCount: [0, 0, 0, 0, 0],
                lastParkingImageUrl: null,
              };
            }
            response.status(200).json({
              ...vehicle,
              ...vehicleStats,
              lastRider: {
                id: null,
              },
            });
          } else {
            response.status(400).json({ message: 'Date is invalid' });
          }
        } else {
          response.sendStatus(403);
        }
      } else {
        response.sendStatus(404);
      }
    } catch (err) {
      Logger.log(err);
      response.sendStatus(500);
    }
  }

  public static async isJobFailed(request: IRequestWithAuthentication, response: Response) {
    try {
      const jobId = request.params.id;
      const job: IUserJob = await UserJobs.getUserJob(jobId);
      if (!job) {
        response.sendStatus(404);
      } else {
        if (job.state === 'failed') {
          response.status(200).json({ failed: true });
        } else {
          response.status(200).json({ failed: false });
        }
      }
    } catch (err) {
      Logger.log(err);
      response.sendStatus(500);
    }

  }
}
