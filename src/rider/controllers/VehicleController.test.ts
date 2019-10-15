import Kafka, { KAFKA_HOST } from '../../common/lib/Kafka';
import cassandra from '../cassandra/Vehicles';
import cassandraOwnerDB from '../../owner/cassandra/Owner';
import VehicleController from './VehicleController';
import { IRequestWithAuthentication } from '../../common/lib/Auth';

const responseMock = () => {
  const res: any = {
    sendStatus: jest.fn((status: number) => res),
    status: jest.fn((status: number) => res),
    send: jest.fn((status: number) => res),
    json: jest.fn((body: any) => res),
  };
  return res;
};

const TEST_USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const TEST_VEHICLE_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const USER_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const VEHICLE_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const OWNER_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const QR_CODE = '000083';
const GEO_HASH = 'sv8wrxwjuu';
const SEARCH_PREFIX_LENGTH = 6;
const TEST_SCOOTER = {
  id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  status: 'available',
  batteryLevel: 100,
  model: 'Test Scooter',
  qrCode: '000000',
  geoHash: 's00000000',
  operatorName: 'Test Manager',
  basePrice: '1',
  pricePerMinute: '0.15',
};

const kafkaConfigMock = {
  seedUrl: KAFKA_HOST,
  searchTopic: 'search-vehicles',
};

describe('VehicleController class', () => {

  describe('getVehicleByQrCode method', () => {

    it('should call cassandra findByQrCode with vehicle QR code, and call response with status 200 and vehicle data', async () => {
      const VEHICLE = {
        vehicleId: VEHICLE_ID,
        status: 'available',
        ownerId: OWNER_ID,
      };
      const findByQrCodeMock = jest.fn(() => Promise.resolve(VEHICLE));
      const findOwnerById = jest.fn(() => Promise.resolve({ fiatCurrencyCode: 'USD' }));
      (cassandra as any).findByQrCode = findByQrCodeMock;
      (cassandraOwnerDB as any).findById = findOwnerById;
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: { code: QR_CODE },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      await VehicleController.getVehicleByQrCode(requestMockInstance, responseMockInstance);
      expect(findByQrCodeMock).toHaveBeenCalledWith(QR_CODE);
      expect(findOwnerById).toHaveBeenCalledWith(OWNER_ID);
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseMockInstance.json).toHaveBeenCalledWith({ ...VEHICLE, currencyCode: 'USD' });
    });

    it('should return 404 for test vehicle qr code', async () => {
      (cassandra as any).findByQrCode = jest.fn().mockResolvedValue(TEST_SCOOTER);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: { code: TEST_SCOOTER.qrCode },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      await VehicleController.getVehicleByQrCode(requestMockInstance, responseMockInstance);
      expect(responseMockInstance.status).toHaveBeenCalledWith(404);
      expect(responseMockInstance.send).toHaveBeenCalledWith('Vehicle not found');
    });

    it('should return 404 when found no scooter', async () => {
      (cassandra as any).findByQrCode = jest.fn().mockResolvedValue(null);
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: { code: QR_CODE },
        user: { id: USER_ID },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      await VehicleController.getVehicleByQrCode(requestMockInstance, responseMockInstance);
      expect((cassandra as any).findByQrCode).toHaveBeenCalledWith(QR_CODE);
      expect(responseMockInstance.status).toHaveBeenCalledWith(404);
      expect(responseMockInstance.send).toHaveBeenCalledWith('Vehicle not found');
    });
  });

  describe('getVehicles method', () => {

    it('should call cassandra getSearchResultsByLocation with first 6 chars of the location hash and response with status 200', async () => {
      const VEHICLE = {
        id: VEHICLE_ID,
      };

      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: { geoHash: GEO_HASH },
        user: { id: USER_ID },
        query: { accuracyLevel: SEARCH_PREFIX_LENGTH },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      const getSearchResultsByLocationMock = jest.fn(() => Promise.resolve({ jsonString: JSON.stringify([VEHICLE]) }));
      (cassandra as any).getSearchResultsByLocation = getSearchResultsByLocationMock;
      await VehicleController.getVehicles(requestMockInstance, responseMockInstance);
      expect(getSearchResultsByLocationMock).toHaveBeenCalledWith(GEO_HASH.substr(0, SEARCH_PREFIX_LENGTH));
      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseMockInstance.json).toHaveBeenCalledWith({ vehicles: [VEHICLE] });
    });

    it(`should call cassandra findVehiclesByLocation with first 8 chars of the location hash,
        send message to kafka with correct parameters, call createEmptyVehiclesSearchResult with
        location hash and 6, and response with null`, async (done: () => void) => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        params: { geoHash: GEO_HASH },
        user: { id: USER_ID },
        query: { accuracyLevel: SEARCH_PREFIX_LENGTH },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      const getSearchResultsByLocationMock = jest.fn(() => Promise.resolve(null));
      const createEmptyVehiclesSearchResultMock = jest.fn(() => Promise.resolve(null));
      (cassandra as any).createEmptyVehiclesSearchResult = createEmptyVehiclesSearchResultMock;
      (cassandra as any).getSearchResultsByLocation = getSearchResultsByLocationMock;
      Kafka.sendMessage = jest.fn().mockResolvedValue(null);
      await VehicleController.getVehicles(requestMockInstance, responseMockInstance);
      expect(getSearchResultsByLocationMock).toHaveBeenCalledWith(GEO_HASH.substr(0, SEARCH_PREFIX_LENGTH));
      expect(createEmptyVehiclesSearchResultMock)
        .toHaveBeenCalledWith(GEO_HASH.substr(0, SEARCH_PREFIX_LENGTH), SEARCH_PREFIX_LENGTH);
      expect(Kafka.sendMessage).toHaveBeenCalledWith(kafkaConfigMock.searchTopic, JSON.stringify({
        searchPrefixLength: 6,
        locationHash: GEO_HASH.substr(0, SEARCH_PREFIX_LENGTH),
      }), kafkaConfigMock.seedUrl);
      expect(responseMockInstance.status).toHaveBeenCalledWith(202);
      expect(responseMockInstance.json).toHaveBeenCalledWith(null);
      done();
    });

    it('should get 200 with test scooter when test user searches for scooters', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: TEST_USER_ID },
        params: { geoHash: '1' },
        query: { accuracyLevel: 0 },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      const testVehicle = { id: TEST_VEHICLE_ID };
      (cassandra as any).getSearchResultsByLocation = jest.fn(() => Promise.resolve({
        jsonString: JSON.stringify([{ id: VEHICLE_ID }]),
      }));
      (cassandra as any).findById = jest.fn(() => Promise.resolve(testVehicle));

      await VehicleController.getVehicles(requestMockInstance, responseMockInstance);

      expect(responseMockInstance.status).toHaveBeenCalledWith(200);
      expect(responseMockInstance.json).toHaveBeenCalledWith({ vehicles: [testVehicle] });
    });

    it('should get 400 when geo hash is missing', async () => {
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        user: { id: USER_ID },
        query: { accuracyLevel: SEARCH_PREFIX_LENGTH },
      }));
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();

      await VehicleController.getVehicles(requestMockInstance, responseMockInstance);

      expect(responseMockInstance.status).toHaveBeenCalledWith(400);
      expect(responseMockInstance.json).toHaveBeenCalledWith({});
    });
  });
});
