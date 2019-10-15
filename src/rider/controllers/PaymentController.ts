import { Request, Response } from 'express';
import RiderDB from '../cassandra/Rider';
import { IRequestWithAuthentication } from '../../common/lib/Auth';
import fetch, { Headers } from 'node-fetch';
import Logger from '../../common/lib/Logger';

const BLUE_SNAP_API = process.env.BLUE_SNAP_API || 'https://sandbox.bluesnap.com';
const BLUE_SNAP_USER_NAME = process.env.BLUE_SNAP_USER_NAME;
const BLUE_SNAP_PASSWORD = process.env.BLUE_SNAP_PASSWORD;
const BLUE_SNAP_API_TEST_USER = process.env.BLUE_SNAP_API_TEST_USER || 'https://sandbox.bluesnap.com';
const BLUE_SNAP_USER_NAME_TEST_USER = process.env.BLUE_SNAP_USER_NAME_TEST_USER;
const BLUE_SNAP_PASSWORD_TEST_USER = process.env.BLUE_SNAP_PASSWORD_TEST_USER;

function generateTokenRequestHeaders(isTestUser: boolean) {
  return new Headers({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Basic ' + Buffer.from(
      (isTestUser ? BLUE_SNAP_USER_NAME_TEST_USER : BLUE_SNAP_USER_NAME) + ':' +
      (isTestUser ? BLUE_SNAP_PASSWORD_TEST_USER : BLUE_SNAP_PASSWORD)).toString('base64'),
  });
}

function getBluesnapApi(isTestUser: boolean) {
  return isTestUser ? BLUE_SNAP_API_TEST_USER : BLUE_SNAP_API;
}

export default class PaymentController {
  public static async renderPaymentPage(request: IRequestWithAuthentication, response: Response) {
    response.render('v1/PaymentForm.ejs', {
      blueSnapURL: `${getBluesnapApi(request.isTestUser)}/source/web-sdk/bluesnap.js`,
    });
  }

  public static async updateCreditCard(request: IRequestWithAuthentication, response: Response) {
    try {
      const userId = request.user && request.user.id;
      const { pfToken, firstName, lastName } = request.body;
      const requestBody = JSON.stringify({
        paymentSources: {
          creditCardInfo: [{
            pfToken,
          }],
        },
        firstName,
        lastName,
      });
      const addShopperResponse = await fetch(`${BLUE_SNAP_API}/services/2/vaulted-shoppers`, {
        headers: generateTokenRequestHeaders(request.isTestUser),
        method: 'POST',
        body: requestBody,
      });
      if (!addShopperResponse.ok) {
        return response.status(400).json({ message: 'unexpected error occurred, Some payment details might be wrong' });
      }
      const shopperData = await addShopperResponse.json();
      const shopperId = shopperData.vaultedShopperId;
      if (!shopperId) {
        return response.status(400).json({ message: 'unexpected error occurred, Some payment details might be wrong' });
      }
      await RiderDB.updatePaymentDetails(userId, String(shopperId));
      const cardInfo = shopperData.paymentSources.creditCardInfo[0].creditCard;
      response.status(200).json({
        last4: cardInfo.cardLastFourDigits,
        brand: cardInfo.cardType,
      });
    } catch (err) {
      Logger.log(err);
      response.status(500).json({ message: 'unexpected error occurred' });
    }
  }

  public static async removeCreditCard(request: IRequestWithAuthentication, response: Response) {
    try {
      const userId = request.user && request.user.id;
      await RiderDB.updatePaymentDetails(userId, null);
      response.status(200).json({ message: 'ok' });
    } catch (err) {
      Logger.log(err);
      response.status(500).json({ message: 'unexpected error occurred' });
    }
  }

  public static async generateToken(request: IRequestWithAuthentication, response: Response) {
    try {
      const generateTokenResponse = await fetch(`${getBluesnapApi(request.isTestUser)}/services/2/payment-fields-tokens`, {
        headers: generateTokenRequestHeaders(request.isTestUser),
        method: 'POST',
      });
      const responseAddress = generateTokenResponse.headers.get('location');
      if (responseAddress) {
        const tokenStartAt = responseAddress.lastIndexOf('/') + 1;
        const token = responseAddress.substring(tokenStartAt);
        response.status(200).json({ token });
      } else {
        response.status(500).json({ message: 'unexpected error occurred: 56' });
      }
    } catch (err) {
      Logger.log(err);
      response.status(500).json({ message: 'unexpected error occurred: 60' });
    }
  }

  public static async getCardInfo(request: IRequestWithAuthentication, response: Response) {
    try {
      const userId = request.user && request.user.id;
      const user = await RiderDB.findById(userId);
      const shopperId = user.paymentMethodId;
      if (shopperId) {
        const addShopperResponse = await fetch(`${getBluesnapApi(request.isTestUser)}/services/2/vaulted-shoppers/${shopperId}`, {
          headers: generateTokenRequestHeaders(request.isTestUser),
          method: 'GET',
        });
        const shopperData = await addShopperResponse.json();
        const cardInfo = shopperData.paymentSources.creditCardInfo[0].creditCard;
        response.status(200).json({
          last4: cardInfo.cardLastFourDigits,
          brand: cardInfo.cardType,
        });
      } else {
        response.status(404).json({ message: 'no card associated to this user' });
      }
    } catch (err) {
      Logger.log(err);
      response.status(500).json({ message: 'unexpected error occurred' });
    }
  }
}
