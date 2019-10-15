import { Response, NextFunction } from 'express';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import VehiclesDB, { VehicleStatus } from '../cassandra/Vehicles';
import OwnerDB from '../../owner/cassandra/Owner';
import Kafka, { KAFKA_HOST } from '../../common/lib/Kafka';
import Logger from '../../common/lib/Logger';

const MAX_RANGE = process.env.MAX_RANGE || 4;

const SEARCH_VEHICLES_TOPIC = process.env.SEARCH_VEHICLES_TOPIC || 'search-vehicles';
const TEST_USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const TEST_VEHICLE_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

export default class VehicleController {

  public static formatQrCode(request: IRequestWithAuthentication, response: Response, next: NextFunction) {
    let vehicleCode = request.params.code;
    vehicleCode = Buffer.from(vehicleCode, 'base64').toString('ascii');
    request.params.code = vehicleCode;
    next();
  }

  public static async getVehicleByQrCode(request: IRequestWithAuthentication, response: Response) {
    try {
      const userId = request.user.id;
      let vehicleCode = request.params.code;
      vehicleCode = vehicleCode.substring(vehicleCode.lastIndexOf('/') + 1);
      const vehicle = await VehiclesDB.findByQrCode(vehicleCode);
      const owner = await OwnerDB.findById(vehicle.ownerId);
      vehicle.currencyCode = owner.fiatCurrencyCode;
      if (
        vehicle &&
        ((userId === TEST_USER_ID && vehicle.id === TEST_VEHICLE_ID) ||
          (userId !== TEST_USER_ID && vehicle.id !== TEST_VEHICLE_ID))
      ) {
        if (vehicle.status !== VehicleStatus.available) {
          response.status(200).json({ status: 'error', reason: vehicle.status });
        } else if (vehicle.batteryLevel < 20) {
          response.status(200).json({ status: 'error', reason: 'batteryLevel' });
        } else {
          response.status(200).json(vehicle);
        }
      } else {
        response.status(404).send('Vehicle not found');
      }
    } catch (err) {
      response.status(404).send('Vehicle not found');
    }
  }

  public static getNoVehicle(request: IRequestWithAuthentication, response: Response) {
    response.status(404).send('Vehicle not found');
  }

  public static async getVehicles(request: IRequestWithAuthentication, response: Response) {
    try {
      const userId = request.user.id;
      if (!request.params || !request.params.geoHash) {
        response.status(400).json({});
        return;
      }
      const searchPrefixLength = Math.max(request.query.accuracyLevel || 0, Number(MAX_RANGE));
      const locationHash = request.params.geoHash.substring(0, searchPrefixLength);
      const searchResults = await VehiclesDB.getSearchResultsByLocation(locationHash);
      if (searchResults === null) {
        const message = {
          searchPrefixLength,
          locationHash,
        };
        await VehiclesDB.createEmptyVehiclesSearchResult(locationHash, searchPrefixLength);
        Kafka.sendMessage(SEARCH_VEHICLES_TOPIC, JSON.stringify(message), KAFKA_HOST);
        response.status(202).json(null);
      } else {
        let vehicles = VehiclesDB.getVehiclesFromSearchResults(searchResults.jsonString);
        if (vehicles === null) {
          response.status(202).json(null);
        } else {
          if (userId === TEST_USER_ID) {
            vehicles = [await VehiclesDB.findById(TEST_VEHICLE_ID)];
          } else {
            vehicles = vehicles.filter(vehicle => vehicle.id !== TEST_VEHICLE_ID);
          }
          response.status(200).json({ vehicles });
        }
      }
    } catch (err) {
      Logger.log(err);
      response.status(500).json({});
    }
  }

  public static getEmptyVehiclesSet(request: IRequestWithAuthentication, response: Response) {
    response.status(200).json({
      vehicles: [],
    });
  }

  public static async getSupportInformation(request: IRequestWithAuthentication, response: Response) {
    try {
      const vehicleId = request.params.vehicleId;
      const vehicle = await VehiclesDB.findById(vehicleId);
      if (vehicle) {
        const vehicleOwnerId = vehicle.ownerId;
        const owner = await OwnerDB.findById(vehicleOwnerId);
        response.status(200).json({
          supportInfo: owner.supportInfo,
        });
      } else {
        response.sendStatus(404);
      }
    } catch (err) {
      Logger.log(err);
      response.sendStatus(500);
    }
  }

}
