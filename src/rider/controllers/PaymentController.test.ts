import PaymentController from './PaymentController';
import * as auth from '../../common/lib/Auth';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import cassandra from '../cassandra/Rider';
import * as nodeFetch from 'node-fetch';

describe('PaymentController class', () => {

  const responseMock = () => {
    const res: any = {
      status: jest.fn((status: number) => res),
      json: jest.fn((body: any) => res),
    };
    return res;
  };

  describe('updateCreditCard', () => {

    it('should return 200 when successfully updated credit card', async () => {
      const paymentMethod = {
        pfToken: 'id',
        firstName: 'test',
        lastName: 'test',
      };
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          id: 'id',
        },
        body: paymentMethod,
      }));
      const updatePaymentMethod = jest.fn().mockResolvedValue(null);

      const request = new requestMock();
      const response = responseMock();
      (auth as any).Auth.serverSecret = 'secret';
      (cassandra as any).updatePaymentDetails = updatePaymentMethod;
      (nodeFetch as any).default = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          vaultedShopperId: 'id',
          paymentSources: {
            creditCardInfo: [{
              creditCard: {
                last4: '1234',
                brand: 'visa',
              },
            }],
          },
        }),
      });
      await PaymentController.updateCreditCard(request, response);
      expect(updatePaymentMethod).toHaveBeenCalledWith('id', 'id');
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 when failed to update credit card', async () => {
      const paymentMethod = {
        pfToken: 'id',
      };
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          id: 'id',
          firstName: 'test',
          lastName: 'test',
        },
        body: paymentMethod,
      }));
      const updatePaymentMethod = jest.fn().mockRejectedValue(null);

      const request = new requestMock();
      const response = responseMock();
      (cassandra as any).updatePaymentDetails = updatePaymentMethod;
      (auth as any).Auth.serverSecret = 'secret';
      (nodeFetch as any).default = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          vaultedShopperId: 'id',
          paymentSources: {
            creditCardInfo: [{
              creditCard: {
                last4: '1234',
                brand: 'visa',
              },
            }],
          },
        }),
      });
      await PaymentController.updateCreditCard(request, response);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(updatePaymentMethod).toHaveBeenCalledWith('id', 'id');
    });

    it('should return 500 when response is not ok', async () => {
      const paymentMethod = {
        pfToken: 'id',
      };
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          id: 'id',
          firstName: 'test',
          lastName: 'test',
        },
        body: paymentMethod,
      }));
      const updatePaymentMethod = jest.fn().mockRejectedValue(null);

      const request = new requestMock();
      const response = responseMock();
      (cassandra as any).updatePaymentDetails = updatePaymentMethod;
      (auth as any).Auth.serverSecret = 'secret';
      (nodeFetch as any).default = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: 'some error occured',
        }),
      });
      await PaymentController.updateCreditCard(request, response);

      expect(response.status).toHaveBeenCalledWith(400);
      expect(updatePaymentMethod).not.toHaveBeenCalled();
    });

    it('should return 500 when failed to update credit card because invalid request', async () => {
      const paymentMethod = {
        pfToken: 'id',
        firstName: 'test',
        lastName: 'test',
      };
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          notId: 'id',
        },
        body: paymentMethod,
      }));
      const updatePaymentMethod = jest.fn().mockRejectedValue(null);

      const request = new requestMock();
      const response = responseMock();
      (auth as any).Auth.serverSecret = 'secret';
      (cassandra as any).updatePaymentDetails = updatePaymentMethod;
      (nodeFetch as any).default = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          vaultedShopperId: 'id',
          paymentSources: {
            creditCardInfo: [{
              creditCard: {
                last4: '1234',
                brand: 'visa',
              },
            }],
          },
        }),
      });
      await PaymentController.updateCreditCard(request, response);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(updatePaymentMethod).toHaveBeenCalledWith(undefined, 'id');
    });
  });

  describe('removeCreditCard', () => {

    it('should return 200 when successfully remove credit card', async () => {
      const paymentMethod = {
        paymentMethodId: '',
        paymentMethodCustomer: '',
      };
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          id: 'id',
        },
      }));
      const updatePaymentMethod = jest.fn().mockResolvedValue(null);

      const request = new requestMock();
      const response = responseMock();
      (auth as any).Auth.serverSecret = 'secret';
      (cassandra as any).updatePaymentDetails = updatePaymentMethod;
      (nodeFetch as any).default = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          vaultedShopperId: 'id',
          paymentSources: {
            creditCardInfo: [{
              creditCard: {
                last4: '1234',
                brand: 'visa',
              },
            }],
          },
        }),
      });
      await PaymentController.removeCreditCard(request, response);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(updatePaymentMethod).toHaveBeenCalledWith('id', null);
    });

    it('should return 500 when failed to remove credit card', async () => {
      const paymentMethod = {
        paymentMethodId: '',
        paymentMethodCustomer: '',
      };
      const requestMock = jest.fn<IRequestWithAuthentication>(() => ({
        connection: { remoteAddress: '' },
        user: {
          id: 'id',
        },
      }));
      const updatePaymentMethod = jest.fn().mockRejectedValue(null);

      const request = new requestMock();
      const response = responseMock();
      (cassandra as any).updatePaymentDetails = updatePaymentMethod;
      (auth as any).Auth.serverSecret = 'secret';

      await PaymentController.removeCreditCard(request, response);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(updatePaymentMethod).toHaveBeenCalledWith('id', null);
    });

  });

});
