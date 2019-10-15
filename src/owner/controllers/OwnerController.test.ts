import OwnerController from './OwnerController';
import cassandra from '../cassandra/Owner';
import { Request } from 'express';

const USER_ID = 'ffffffff-ffff-ffff-ffff-fffffffffff1';

describe('OwnerController class', () => {

  describe('getOwnerStats method', () => {

    it('should call cassandra getOwnerStats with owner id and response with status 200', async () => {
      const requestMock = jest.fn<Request>(() => ({
        params: { },
        query: { date: '2019-02-14' },
        user: { id: USER_ID },
      }));
      const responseMock = () => {
        const res: any =  {
          sendStatus: jest.fn((status: number) => res),
          status: jest.fn((status: number) => res),
          json: jest.fn((body: any) => res),
        };
        return res;
      };
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      const getOwnerStatsMock = jest.fn((userId: string, date: Date) => Promise.resolve({
        id: USER_ID,
        date: '2019-02-14',
        totalRidesCount: 6,
        totalDAVRevenue: 5.4,
        totalFiatRevenue: 51.30,
        currencyCode: 'USD',
      }));
      (cassandra as any).getOwnerStats = getOwnerStatsMock;
      await OwnerController.getOwnerStats(requestMockInstance, responseMockInstance);
      expect(cassandra.getOwnerStats).toHaveBeenCalledWith(USER_ID, requestMockInstance.query.date);
      expect(responseMockInstance.status).toBeCalledWith(200);
      expect(responseMockInstance.json).toBeCalledWith({
        id: USER_ID,
        date: '2019-02-14',
        totalRidesCount: 6,
        totalDAVRevenue: 5.4,
        totalFiatRevenue: 51.30,
        currencyCode: 'USD',
      });
    });

    it('should not call cassandra getOwnerStats and response with status 404', async () => {
      const requestMock = jest.fn<Request>(() => ({
        params: { },
        query: { date: null },
        user: { id: USER_ID },
      }));
      const responseMock = () => {
        const res: any =  {
          sendStatus: jest.fn((status: number) => res),
          status: jest.fn((status: number) => res),
          json: jest.fn((body: any) => res),
        };
        return res;
      };
      const requestMockInstance = new requestMock();
      const responseMockInstance = responseMock();
      const getOwnerStatsMock = jest.fn((userId: string, date: Date) => Promise.resolve({
        id: USER_ID,
        date: '2019-02-14',
        totalRidesCount: 6,
        totalDAVRevenue: 5.4,
        totalFiatRevenue: 51.30,
        currencyCode: 'USD',
      }));
      (cassandra as any).getOwnerStats = getOwnerStatsMock;
      await OwnerController.getOwnerStats(requestMockInstance, responseMockInstance);
      expect(cassandra.getOwnerStats).not.toHaveBeenCalled();
      expect(responseMockInstance.sendStatus).toBeCalledWith(404);
    });
  });
});
