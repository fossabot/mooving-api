import Kafka, { KAFKA_HOST } from '../../common/lib/Kafka';
import cassandraRideSummary from '../cassandra/RideSummary';
import cassandraActiveRides from '../cassandra/ActiveRides';
import RideController from './RideController';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import Logger from '../../common/lib/Logger';
import * as riders from '../cassandra/Rider';
import * as userJobs from '../../common/cassandra/UserJobs';

const responseMock = () => {
  const res: any = {
    send: jest.fn((status: number) => res),
    status: jest.fn((status: number) => res),
    sendStatus: jest.fn((status: number) => res),
    json: jest.fn((body: any) => res),
  };
  return res;
};

const USER_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const VEHICLE_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const QR_CODE = '000083';
const GEO_HASH = 'sv8wrxwjuu';
const SEARCH_PREFIX_LENGTH = 6;
const RIDE_START_TIME = '2007-04-05T14:30Z';
const ERROR = 'ERROR';
const PARKING_IMAGE_URL = 'PARKING_IMAGE_URL';

const kafkaConfigMock = {
  seedUrl: KAFKA_HOST,
  endRideTopic: 'end-ride',
  unlockTopic: 'unlock-vehicle',
};

describe('RideController class', () => {

  describe('getRideSummary method', () => {

    it('should call cassandra getRideSummary with correct parameters, and call response with status 200 and rideSummary', async () => {
      const getRideSummaryMock = jest.fn().mockResolvedValue({
        price: 50,
        riderId: USER_ID,
        vehicleId: VEHICLE_ID,
        currencyCode: 'USD',
        davAwarded: 5.3,
      });
      (cassandraRideSummary as any).getRideSummary = getRideSummaryMock;
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: { vehicleId: VEHICLE_ID, startTime: RIDE_START_TIME },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.getRideSummary(requestMockInstance, responseMockInstance);

      expect(getRideSummaryMock).toHaveBeenCalledWith(USER_ID, VEHICLE_ID, RIDE_START_TIME);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseMockInstance.json).toHaveBeenCalledWith({
        price: 50,
        riderId: USER_ID,
        vehicleId: VEHICLE_ID,
        currencyCode: 'USD',
        currencyUnicode: '\u0024',
        davAwarded: 5.3,
      });
    });

    it('should get 400 when no vehicle id', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: { startTime: RIDE_START_TIME },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.getRideSummary(requestMockInstance, responseMockInstance);

      expect(responseMockInstance.status).toHaveBeenCalledWith(400);
      expect(responseMockInstance.json).toHaveBeenCalledWith({});
    });

    it('should get 400 when no start time', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: { vehicleId: VEHICLE_ID },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.getRideSummary(requestMockInstance, responseMockInstance);

      expect(responseMockInstance.status).toHaveBeenCalledWith(400);
      expect(responseMockInstance.json).toHaveBeenCalledWith({});
    });

    it('should get 500 when cassandra throws an error', async () => {
      (cassandraRideSummary as any).getRideSummary = jest.fn().mockRejectedValue('DB error');
      (Logger as any).log = jest.fn().mockReturnValue(null);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        query: { vehicleId: VEHICLE_ID, startTime: RIDE_START_TIME },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.getRideSummary(requestMockInstance, responseMockInstance);

      expect((cassandraRideSummary as any).getRideSummary).toHaveBeenCalledWith(USER_ID, VEHICLE_ID, RIDE_START_TIME);
      expect(responseMockInstance.status).toHaveBeenCalledWith(500);
      expect((Logger as any).log).toHaveBeenCalledWith('DB error');
    });

  });

  describe('getActiveRide method', () => {

    it('should call cassandra getActiveRide with correct parameters, and call response with ActiveRide', async () => {
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue({ startTime: RIDE_START_TIME });
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue({ jobId: USER_ID, state: 'started', type: 'unlock' });
      (userJobs as any).default.delete = jest.fn().mockResolvedValue(null);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.getActiveRide(requestMockInstance, responseMockInstance);

      expect((cassandraActiveRides as any).getActiveRide).toHaveBeenCalledWith(USER_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseMockInstance.json).toHaveBeenCalledWith({
        startTime: RIDE_START_TIME,
      });
    });

    it('should return 404 when no active ride and no job', async () => {
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.delete = jest.fn().mockResolvedValue(null);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.getActiveRide(requestMockInstance, responseMockInstance);

      expect((cassandraActiveRides as any).getActiveRide).toHaveBeenCalledWith(USER_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 when no active ride but there is a job', async () => {
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue({ jobId: USER_ID, state: 'started', type: 'unlock' });
      (userJobs as any).default.delete = jest.fn().mockResolvedValue(null);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.getActiveRide(requestMockInstance, responseMockInstance);

      expect((cassandraActiveRides as any).getActiveRide).toHaveBeenCalledWith(USER_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(404);
    });

    it('should return 424 when no active ride and the job has failed', async () => {
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue({ jobId: USER_ID, state: 'failed', type: 'unlock' });
      (userJobs as any).default.delete = jest.fn().mockResolvedValue(null);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.getActiveRide(requestMockInstance, responseMockInstance);

      expect((cassandraActiveRides as any).getActiveRide).toHaveBeenCalledWith(USER_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(424);
    });

    it('should return 400 when no active ride and the job is not unlock type', async () => {
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue({ jobId: USER_ID, state: 'started', type: 'lie' });
      (userJobs as any).default.delete = jest.fn().mockResolvedValue(null);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.getActiveRide(requestMockInstance, responseMockInstance);

      expect((cassandraActiveRides as any).getActiveRide).toHaveBeenCalledWith(USER_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(400);
    });

    it('should call cassandra getActiveRide, and call response with error', async () => {
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockRejectedValue(ERROR);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      (Logger as any).log = jest.fn().mockReturnValue(null);

      await RideController.getActiveRide(requestMockInstance, responseMockInstance);

      expect((cassandraActiveRides as any).getActiveRide).toHaveBeenCalledWith(USER_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(500);
      expect((Logger as any).log).toHaveBeenCalledWith(ERROR);
    });
  });

  describe('unlockVehicle method', () => {

    it('should send message to kafka with correct parameters, and call response with status 200', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: { code: QR_CODE },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      Kafka.sendMessage = jest.fn().mockResolvedValue(null);
      (riders as any).default.findById = jest.fn().mockResolvedValue({ paymentMethodId: '1234' });
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.insert = jest.fn().mockResolvedValue(null);

      await RideController.unlockVehicle(requestMockInstance, responseMockInstance);

      expect((userJobs as any).default.insert).toHaveBeenCalledWith({ id: USER_ID, state: 'pending', type: 'unlock' });
      expect(Kafka.sendMessage).toHaveBeenCalledWith(kafkaConfigMock.unlockTopic, JSON.stringify({
        qrCode: QR_CODE,
        riderId: USER_ID,
        jobId: USER_ID,
      }), kafkaConfigMock.seedUrl);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
    });

    it('should find activeRide and no job, and call response with status 400', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: { code: QR_CODE },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      Kafka.sendMessage = jest.fn().mockResolvedValue(null);
      (riders as any).default.findById = jest.fn().mockResolvedValue({ paymentMethodId: '1234' });
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue({ startTime: RIDE_START_TIME });
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);
      (Logger as any).log = jest.fn().mockReturnValue(null);

      await RideController.unlockVehicle(requestMockInstance, responseMockInstance);

      expect(Kafka.sendMessage).not.toHaveBeenCalled();
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(400);
    });

    it('should find existing job, and call response with status 400 without send message to kafka', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: { code: QR_CODE },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      Kafka.sendMessage = jest.fn().mockResolvedValue(null);
      (riders as any).default.findById = jest.fn().mockResolvedValue({ paymentMethodId: '1234' });
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue({ jobId: USER_ID, state: 'started', type: 'unlock' });
      (Logger as any).log = jest.fn().mockReturnValue(null);

      await RideController.unlockVehicle(requestMockInstance, responseMockInstance);

      expect(Kafka.sendMessage).not.toHaveBeenCalled();
      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(400);
    });

    it('should get 400 when rider has no payment method', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: { code: QR_CODE },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      (Logger as any).log = jest.fn().mockReturnValue(null);
      (riders as any).default.findById = jest.fn().mockResolvedValue({ paymentMethodId: null });
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue({ startTime: RIDE_START_TIME });
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);

      await RideController.unlockVehicle(requestMockInstance, responseMockInstance);

      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(400);
    });

    it('should get 500 when kafka throws as error', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        params: { code: QR_CODE },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      Kafka.sendMessage = jest.fn().mockRejectedValue(ERROR);
      (Logger as any).log = jest.fn().mockReturnValue(null);
      (riders as any).default.findById = jest.fn().mockResolvedValue({ paymentMethodId: '1234' });
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue(null);
      (userJobs as any).default.getUserJob = jest.fn().mockResolvedValue(null);

      await RideController.unlockVehicle(requestMockInstance, responseMockInstance);

      expect(Kafka.sendMessage).toHaveBeenCalledWith(kafkaConfigMock.unlockTopic, JSON.stringify({
        qrCode: QR_CODE,
        riderId: USER_ID,
        jobId: USER_ID,
      }), kafkaConfigMock.seedUrl);
      expect(responseMockInstance.status).toHaveBeenCalledWith(500);
      expect((Logger as any).log).toHaveBeenCalledWith(ERROR);
    });
  });

  describe('lockVehicle method', () => {

    it('should send message to kafka with correct parameters, and call response with status 200', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        body: { parkingImageUrl: PARKING_IMAGE_URL },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue({ startTime: RIDE_START_TIME });
      Kafka.sendMessage = jest.fn().mockResolvedValue(null);

      await RideController.lockVehicle(requestMockInstance, responseMockInstance);

      expect(Kafka.sendMessage).toHaveBeenCalledWith(kafkaConfigMock.endRideTopic, JSON.stringify({
        riderId: USER_ID,
        parkingImageUrl: PARKING_IMAGE_URL,
        paymentMethodDAV: false,
      }), kafkaConfigMock.seedUrl);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
    });

    it('should send message to kafka with correct parameters, and call response with status 500', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        body: { parkingImageUrl: PARKING_IMAGE_URL },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue({ startTime: RIDE_START_TIME });
      Kafka.sendMessage = jest.fn().mockRejectedValue(ERROR);
      (Logger as any).log = jest.fn().mockReturnValue(null);

      await RideController.lockVehicle(requestMockInstance, responseMockInstance);

      expect(Kafka.sendMessage).toHaveBeenCalledWith(kafkaConfigMock.endRideTopic, JSON.stringify({
        riderId: USER_ID,
        parkingImageUrl: PARKING_IMAGE_URL,
        paymentMethodDAV: false,
      }), kafkaConfigMock.seedUrl);
      expect(responseMockInstance.status).toHaveBeenCalledWith(500);
      expect((Logger as any).log).toHaveBeenCalledWith(ERROR);
    });

    it('should return 400 when no active ride', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        body: { parkingImageUrl: PARKING_IMAGE_URL },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      (cassandraActiveRides as any).getActiveRide = jest.fn().mockResolvedValue(null);

      await RideController.lockVehicle(requestMockInstance, responseMockInstance);

      expect(responseMockInstance.sendStatus).toHaveBeenCalledWith(400);
    });
  });

  describe('setRating method', () => {

    it('should call cassandra setRating with correct parameters, and call response with status 200', async () => {
      const setRatingMock = jest.fn().mockResolvedValue(true);
      const getRideSummaryMock = jest.fn().mockResolvedValue({
        price: 50,
        riderId: USER_ID,
        vehicleId: VEHICLE_ID,
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
        endTime: new Date(Date.now() - 4000).toISOString(),
      });
      (cassandraRideSummary as any).getRideSummary = getRideSummaryMock;
      (cassandraRideSummary as any).setRating = setRatingMock;
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        body: {
          price: 50,
          riderId: USER_ID,
          vehicleId: VEHICLE_ID,
          tags: ['tag1', 'tag2', 'tag3'],
          startTime: '2019-03-05T08:45:53.826Z',
        },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await RideController.rate(requestMockInstance, responseMockInstance);

      expect(setRatingMock).toHaveBeenCalledWith({
        riderId: USER_ID,
        vehicleId: VEHICLE_ID,
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
      });
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
    });

    it('should call cassandra setRating with correct parameters, and call response with status 500 and error', async () => {
      const setRatingMock = jest.fn().mockRejectedValue(ERROR);
      const getRideSummaryMock = jest.fn().mockResolvedValue({
        price: 50,
        riderId: USER_ID,
        vehicleId: VEHICLE_ID,
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
        endTime: new Date(Date.now() - 4000).toISOString(),
      });
      (cassandraRideSummary as any).setRating = setRatingMock;
      (cassandraRideSummary as any).getRideSummary = getRideSummaryMock;
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        body: {
          price: 50,
          riderId: USER_ID,
          vehicleId: VEHICLE_ID,
          tags: ['tag1', 'tag2', 'tag3'],
          startTime: '2019-03-05T08:45:53.826Z',
        },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      (Logger as any).log = jest.fn().mockReturnValue(null);

      await RideController.rate(requestMockInstance, responseMockInstance);

      expect(setRatingMock).toHaveBeenCalledWith({
        riderId: USER_ID,
        vehicleId: VEHICLE_ID,
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
      });
      expect(responseMockInstance.status).toHaveBeenCalledWith(500);
      expect((Logger as any).log).toHaveBeenCalledWith(ERROR);
    });

    it('time limit expired, should respond 403', async () => {
      const setRatingMock = jest.fn().mockResolvedValue(true);
      const getRideSummaryMock = jest.fn().mockResolvedValue({
        price: 50,
        riderId: USER_ID,
        vehicleId: VEHICLE_ID,
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
        endTime: '2019-03-05T08:45:44.683Z',
      });
      (cassandraRideSummary as any).getRideSummary = getRideSummaryMock;
      (cassandraRideSummary as any).setRating = setRatingMock;
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        body: {
          riderId: USER_ID,
          vehicleId: VEHICLE_ID,
          tags: ['tag1', 'tag2', 'tag3'],
          startTime: '2019-03-05T08:45:53.826Z',
        },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      await RideController.rate(requestMockInstance, responseMockInstance);
      expect(setRatingMock).not.toBeCalled();
      expect(responseMockInstance.status).toHaveBeenCalledWith(403);
    });

    it('time limit on time, should call cassandra setRating with correct parameters, and call response with status 200', async () => {
      const setRatingMock = jest.fn().mockResolvedValue(true);
      const getRideSummaryMock = jest.fn().mockResolvedValue({
        price: 50,
        riderId: USER_ID,
        vehicleId: VEHICLE_ID,
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
        endTime: new Date(Date.now() - 4000).toISOString(),
      });
      (cassandraRideSummary as any).setRating = setRatingMock;
      (cassandraRideSummary as any).getRideSummary = getRideSummaryMock;
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        body: {
          riderId: USER_ID,
          vehicleId: VEHICLE_ID,
          tags: ['tag1', 'tag2', 'tag3'],
          startTime: '2019-03-05T08:45:53.826Z',
        },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      await RideController.rate(requestMockInstance, responseMockInstance);
      expect(setRatingMock).toHaveBeenCalledWith({
        riderId: USER_ID,
        vehicleId: VEHICLE_ID,
        tags: ['tag1', 'tag2', 'tag3'],
        startTime: '2019-03-05T08:45:53.826Z',
      });
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
    });
  });

});
