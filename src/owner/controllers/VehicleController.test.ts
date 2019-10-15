import VehicleController from './VehicleController';
import { Response } from 'express';
import cassandra, { IVehicle, IVehicleStats } from '../cassandra/Vehicles';
import * as userJobs from '../../common/cassandra/UserJobs';
import * as uuid from 'uuid';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import Kafka from '../../common/lib/Kafka';
import { KAFKA_HOST } from '../../common/lib/Kafka';

const USER_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const VEHICLE_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const JOB_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff3';

describe('VehicleController class', () => {

  describe('getOwnerVehiclesStatuses method', () => {

    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should call cassandra findVehiclesByOwner with owner id and response with status 200', async () => {

      const vehicle = {
        id: VEHICLE_ID,
        status: 'STATUS',
        inTransition: false,
        batteryLevel: 50,
        geoHash: 'geoHash',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findVehiclesByOwner = jest.fn().mockResolvedValue([vehicle]);

      await VehicleController.getOwnerVehiclesStatuses(requestMockInstance, responseMockInstance);

      expect((cassandra as any).findVehiclesByOwner).toHaveBeenCalledWith(USER_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ vehicles: [vehicle] });
    });
  });

  describe('changeStatus method', () => {

    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should send kafka cordon message', async () => {

      const vehicle = {
        id: VEHICLE_ID,
        ownerId: USER_ID,
        status: 'available',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: {
          id: VEHICLE_ID,
          status: 'notavailable',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (uuid as any).v4 = jest.fn().mockReturnValue(JOB_ID);
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (userJobs as any).default.insert = jest.fn().mockResolvedValue(null);
      (Kafka as any).sendMessage = jest.fn().mockResolvedValue(null);

      await VehicleController.changeStatus(requestMockInstance, responseMockInstance);
      expect(Kafka.sendMessage).toHaveBeenCalledWith(
        'cordon-vehicle',
        JSON.stringify({
          vehicleId: VEHICLE_ID,
          jobId: JOB_ID,
        }),
        KAFKA_HOST);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ job_id: JOB_ID });
    });

    it('should send kafka cordon + garage message', async () => {

      const vehicle = {
        id: VEHICLE_ID,
        ownerId: USER_ID,
        status: 'available',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: {
          id: VEHICLE_ID,
          status: 'maintenance',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (uuid as any).v4 = jest.fn().mockReturnValue(JOB_ID);
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (userJobs as any).default.insert = jest.fn().mockResolvedValue(null);
      (Kafka as any).sendMessage = jest.fn().mockResolvedValue(null);

      await VehicleController.changeStatus(requestMockInstance, responseMockInstance);
      expect(Kafka.sendMessage).toHaveBeenCalledWith(
        'cordon-garage-vehicle',
        JSON.stringify({
          vehicleId: VEHICLE_ID,
          jobId: JOB_ID,
        }),
        KAFKA_HOST);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ job_id: JOB_ID });
    });

    it('should send kafka garage message', async () => {

      const vehicle = {
        id: VEHICLE_ID,
        ownerId: USER_ID,
        status: 'notavailable',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: {
          id: VEHICLE_ID,
          status: 'maintenance',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (uuid as any).v4 = jest.fn().mockReturnValue(JOB_ID);
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (userJobs as any).default.insert = jest.fn().mockResolvedValue(null);
      (Kafka as any).sendMessage = jest.fn().mockResolvedValue(null);

      await VehicleController.changeStatus(requestMockInstance, responseMockInstance);
      expect(Kafka.sendMessage).toHaveBeenCalledWith(
        'garage-vehicle',
        JSON.stringify({
          vehicleId: VEHICLE_ID,
          jobId: JOB_ID,
        }),
        KAFKA_HOST);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ job_id: JOB_ID });
    });

    it('should send kafka uncordon message', async () => {

      const vehicle = {
        id: VEHICLE_ID,
        ownerId: USER_ID,
        status: 'notavailable',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: {
          id: VEHICLE_ID,
          status: 'available',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (uuid as any).v4 = jest.fn().mockReturnValue(JOB_ID);
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (userJobs as any).default.insert = jest.fn().mockResolvedValue(null);
      (Kafka as any).sendMessage = jest.fn().mockResolvedValue(null);

      await VehicleController.changeStatus(requestMockInstance, responseMockInstance);
      expect(Kafka.sendMessage).toHaveBeenCalledWith(
        'uncordon-vehicle',
        JSON.stringify({
          vehicleId: VEHICLE_ID,
          jobId: JOB_ID,
        }),
        KAFKA_HOST);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ job_id: JOB_ID });
    });

    it('should send kafka uncordon + ungarage message', async () => {

      const vehicle = {
        id: VEHICLE_ID,
        ownerId: USER_ID,
        status: 'maintenance',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: {
          id: VEHICLE_ID,
          status: 'available',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (uuid as any).v4 = jest.fn().mockReturnValue(JOB_ID);
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (userJobs as any).default.insert = jest.fn().mockResolvedValue(null);
      (Kafka as any).sendMessage = jest.fn().mockResolvedValue(null);

      await VehicleController.changeStatus(requestMockInstance, responseMockInstance);
      expect(Kafka.sendMessage).toHaveBeenCalledWith(
        'ungarage-uncordon-vehicle',
        JSON.stringify({
          vehicleId: VEHICLE_ID,
          jobId: JOB_ID,
        }),
        KAFKA_HOST);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ job_id: JOB_ID });
    });

    it('should send kafka ungarage message', async () => {

      const vehicle = {
        id: VEHICLE_ID,
        ownerId: USER_ID,
        status: 'maintenance',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: {
          id: VEHICLE_ID,
          status: 'notavailable',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (uuid as any).v4 = jest.fn().mockReturnValue(JOB_ID);
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (userJobs as any).default.insert = jest.fn().mockResolvedValue(null);
      (Kafka as any).sendMessage = jest.fn().mockResolvedValue(null);

      await VehicleController.changeStatus(requestMockInstance, responseMockInstance);
      expect(Kafka.sendMessage).toHaveBeenCalledWith(
        'ungarage-vehicle',
        JSON.stringify({
          vehicleId: VEHICLE_ID,
          jobId: JOB_ID,
        }),
        KAFKA_HOST);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ job_id: JOB_ID });
    });

    it('should not send a message to kafka and response 401', async () => {

      const vehicle = {
        id: VEHICLE_ID,
        ownerId: 'ANOTHER_USER_ID',
        status: 'notavailable',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: {
          id: VEHICLE_ID,
          status: 'notavailable',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (Kafka as any).sendMessage = jest.fn().mockResolvedValue(null);
      await VehicleController.changeStatus(requestMockInstance, responseMockInstance);
      expect(Kafka.sendMessage).not.toHaveBeenCalled();
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(401);
    });

    it('should not send a message to kafka and response 200', async () => {

      const vehicle = {
        id: VEHICLE_ID,
        ownerId: USER_ID,
        status: 'notavailable',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: {
          id: VEHICLE_ID,
          status: 'notavailable',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (Kafka as any).sendMessage = jest.fn().mockResolvedValue(null);
      await VehicleController.changeStatus(requestMockInstance, responseMockInstance);
      expect(Kafka.sendMessage).not.toHaveBeenCalled();
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
    });

  });

  describe('getOwnerVehicles method', () => {

    beforeEach(() => {
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should call cassandra findVehiclesByOwner with owner id and response with status 200', async () => {

      const vehicle = {
        vehicleId: VEHICLE_ID,
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date: new Date().toISOString(),
        },
        user: { id: USER_ID },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findVehiclesByOwner = jest.fn().mockResolvedValue([vehicle]);
      (cassandra as any).getOwnerVehiclesStats = jest.fn().mockResolvedValue([vehicle]);

      await VehicleController.getOwnerVehicles(requestMockInstance, responseMockInstance);

      expect((cassandra as any).findVehiclesByOwner).toHaveBeenCalledWith(USER_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ vehicles: [vehicle] });
    });

    it('should get status 400 because of bad date', async () => {

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date: 'bad date',
        },
        user: { id: USER_ID },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();

      await VehicleController.getOwnerVehicles(requestMockInstance, responseMockInstance);

      expect(responseMockInstance.status).toHaveBeenCalledWith(400);
    });

    it('should get status 400 when no date is sent', async () => {

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
        },
        user: { id: USER_ID },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();

      await VehicleController.getOwnerVehicles(requestMockInstance, responseMockInstance);

      expect(responseMockInstance.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 when cassandra throws as error', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date: new Date().toISOString(),
        },
        user: { id: USER_ID },
      }));
      const responseMock = jest.fn<Response>(() => ({
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findVehiclesByOwner = jest.fn().mockRejectedValue([]);

      await VehicleController.getOwnerVehicles(requestMockInstance, responseMockInstance);

      expect((cassandra as any).findVehiclesByOwner).toHaveBeenCalledWith(USER_ID);
      expect((cassandra as any).getOwnerVehiclesStats).not.toHaveBeenCalled();
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(500);
    });
  });

  describe('getVehicleDetails method', () => {
    it('should return 500 when cassandra throws an error', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: {
          id: 'vehicleId',
        },
        query: {
          date: new Date().toISOString(),
        },
        user: { id: USER_ID },
      }));
      const responseMock = jest.fn<Response>(() => ({
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findById = jest.fn().mockRejectedValue(null);

      await VehicleController.getVehicleDetails(requestMockInstance, responseMockInstance);

      expect((cassandra as any).findById).toHaveBeenCalledWith('vehicleId');
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(500);
    });

    it('should return vehicle without stats', async () => {
      const vehicle: IVehicle = {
        id: 'vehicleId',
        status: 'available',
        ownerId: USER_ID,
      };

      const expectedResponse: any = {
        id: 'vehicleId',
        status: 'available',
        ownerId: USER_ID,
        dailyUse: 0,
        dailyProfit: 0,
        feedbackRatingCount: [0, 0, 0, 0, 0],
        lastParkingImageUrl: null,
        lastRider: {
          id: null,
        },
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date: new Date().toISOString(),
        },
        user: { id: USER_ID },
        params: {
          id: 'vehicleId',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (cassandra as any).getOwnerVehicleStatsByVehicleId = jest.fn().mockResolvedValue(null);

      await VehicleController.getVehicleDetails(requestMockInstance, responseMockInstance);

      expect((cassandra as any).findById).toHaveBeenCalledWith('vehicleId');
      expect((cassandra as any).getOwnerVehicleStatsByVehicleId)
        .toHaveBeenCalledWith(USER_ID, new Date(requestMockInstance.query.date), 'vehicleId');
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith(expectedResponse);
    });

    it('should return vehicle with stats', async () => {
      const vehicle: IVehicle = {
        id: 'vehicleId',
        status: 'available',
        ownerId: USER_ID,
      };

      const vehicleStats: IVehicleStats = {
        id: 'vehicleId',
        dailyUse: 3,
        dailyProfit: 4,
        feedbackRatingCount: [0, 0, 1, 2, 2],
        lastParkingImageUrl: null,
      };

      const expectedResponse: any = {
        id: 'vehicleId',
        status: 'available',
        ownerId: USER_ID,
        dailyUse: 3,
        dailyProfit: 4,
        feedbackRatingCount: [0, 0, 1, 2, 2],
        lastParkingImageUrl: null,
        lastRider: {
          id: null,
        },
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date: new Date().toISOString(),
        },
        user: { id: USER_ID },
        params: {
          id: 'vehicleId',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);
      (cassandra as any).getOwnerVehicleStatsByVehicleId = jest.fn().mockResolvedValue(vehicleStats);

      await VehicleController.getVehicleDetails(requestMockInstance, responseMockInstance);

      expect((cassandra as any).findById).toHaveBeenCalledWith('vehicleId');
      expect((cassandra as any).getOwnerVehicleStatsByVehicleId)
        .toHaveBeenCalledWith(USER_ID, new Date(requestMockInstance.query.date), 'vehicleId');
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith(expectedResponse);
    });

    it('should return 404 when vehicle not found in database', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: {
          id: 'vehicleId',
        },
        query: {
          date: new Date().toISOString(),
        },
        user: { id: USER_ID },
      }));
      const responseMock = jest.fn<Response>(() => ({
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findById = jest.fn().mockResolvedValue(null);

      await VehicleController.getVehicleDetails(requestMockInstance, responseMockInstance);

      expect((cassandra as any).findById).toHaveBeenCalledWith('vehicleId');
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(404);
    });

    it('should return 403 because vehicle has another owner id', async () => {
      const vehicle: IVehicle = {
        id: 'vehicleId',
        status: 'available',
        ownerId: 'another id',
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date: new Date().toISOString(),
        },
        user: { id: USER_ID },
        params: {
          id: 'vehicleId',
        },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).findById = jest.fn().mockResolvedValue(vehicle);

      await VehicleController.getVehicleDetails(requestMockInstance, responseMockInstance);

      expect((cassandra as any).findById).toHaveBeenCalledWith('vehicleId');
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(403);
    });
  });

  describe('getFeedbacks method', () => {

    it('should return an empty array in case there is no rideSummaries', async () => {
      const date = new Date().toISOString();
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date,
        },
        user: { id: USER_ID },
        params: { id: USER_ID },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).getOwnerVehiclesFeedbacks = jest.fn().mockResolvedValue([]);
      (cassandra as any).findById = jest.fn().mockResolvedValue({ ownerId: USER_ID });

      await VehicleController.getFeedbacks(requestMockInstance, responseMockInstance);

      expect((cassandra as any).getOwnerVehiclesFeedbacks).toHaveBeenCalledWith(USER_ID, date);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ feedbacks: [] });
    });

    it('should return set of 5 feedbacks', async () => {
      const date = new Date().toISOString();
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date,
        },
        user: { id: USER_ID },
        params: { id: USER_ID },
      }));
      const responseJsonMock = jest.fn();
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      const rideSummary = {
        vehicleId: USER_ID,
        feedbackTags: ['tag'],
        rating: 5,
        parkingImageUrl: 'parking_image_url',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      };
      (cassandra as any).getOwnerVehiclesFeedbacks = jest.fn().mockResolvedValue([
        rideSummary, rideSummary, rideSummary, rideSummary, rideSummary,
      ]);
      (cassandra as any).findById = jest.fn().mockResolvedValue({ ownerId: USER_ID });

      await VehicleController.getFeedbacks(requestMockInstance, responseMockInstance);

      expect((cassandra as any).getOwnerVehiclesFeedbacks).toHaveBeenCalledWith(USER_ID, date);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ feedbacks: [rideSummary, rideSummary, rideSummary, rideSummary, rideSummary] });
    });

    it('should return status 401 when vehicle owner != user_id', async () => {
      const date = new Date().toISOString();
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date,
        },
        user: { id: USER_ID },
        params: { id: USER_ID },
      }));
      const responseMock = jest.fn<Response>(() => ({
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      const rideSummary = {
        vehicleId: USER_ID,
        feedbackTags: ['tag'],
        rating: 5,
        parkingImageUrl: 'parking_image_url',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      };
      (cassandra as any).getOwnerVehiclesFeedbacks = jest.fn().mockResolvedValue([
        rideSummary, rideSummary, rideSummary, rideSummary, rideSummary,
      ]);
      (cassandra as any).findById = jest.fn().mockResolvedValue({ ownerId: 'ANOTHER_USER_ID' });
      await VehicleController.getFeedbacks(requestMockInstance, responseMockInstance);

      expect((cassandra as any).getOwnerVehiclesFeedbacks).not.toHaveBeenCalled();
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(401);
    });

    it('should return status 500 in case of cassandra error', async () => {
      const date = new Date().toISOString();
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: {
          date,
        },
        user: { id: USER_ID },
        params: { id: USER_ID },
      }));
      const responseMock = jest.fn<Response>(() => ({
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();
      (cassandra as any).getOwnerVehiclesFeedbacks = jest.fn().mockRejectedValue(null);
      (cassandra as any).findById = jest.fn().mockResolvedValue({ ownerId: USER_ID });

      await VehicleController.getFeedbacks(requestMockInstance, responseMockInstance);

      expect((cassandra as any).getOwnerVehiclesFeedbacks).toHaveBeenCalledWith(USER_ID, date);
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(500);
    });

  });

  describe('isJob Failed method', () => {
    it('should return job has not failed', async () => {
      const responseJsonMock = jest.fn();
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: { id: JOB_ID },
      }));
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();

      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue({ jobId: JOB_ID, state: 'started' });

      await VehicleController.isJobFailed(requestMockInstance, responseMockInstance);

      expect((userJobs as any).default.getUserJob).toHaveBeenCalledWith(JOB_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ failed: false });
    });

    it('should return job has failed', async () => {
      const responseJsonMock = jest.fn();
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: { id: JOB_ID },
      }));
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();

      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue({ jobId: JOB_ID, state: 'failed' });

      await VehicleController.isJobFailed(requestMockInstance, responseMockInstance);

      expect((userJobs as any).default.getUserJob).toHaveBeenCalledWith(JOB_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseJsonMock).toHaveBeenCalledWith({ failed: true });
    });

    it('should return job has failed', async () => {
      const responseJsonMock = jest.fn();
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: { id: JOB_ID },
      }));
      const responseMock = jest.fn<Response>(() => ({
        status: jest.fn(() => ({
          json: responseJsonMock,
        })),
        sendStatus: jest.fn(),
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = new responseMock();

      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);

      await VehicleController.isJobFailed(requestMockInstance, responseMockInstance);

      expect((userJobs as any).default.getUserJob).toHaveBeenCalledWith(JOB_ID);
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(404);
    });
  });
});
