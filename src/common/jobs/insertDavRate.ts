import fetch, { Headers } from 'node-fetch';
import { ConversionRates } from '../cassandra/davConversionRates';

const SUPPORTED_CURRENCIES = process.env.SUPPORTED_CURRENCIES;
const CMC_API_KEY = process.env.CMC_API_KEY;
const COINMARKETCAP_API_CALL_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=DAV&convert=';
const supportedCurrencies = SUPPORTED_CURRENCIES.split(',')
  .map(currencyCode => currencyCode.trim())
  .map(currencyCode => currencyCode.toUpperCase());
const headers = new Headers({
  'Content-Type': 'application/json',
  'X-CMC_PRO_API_KEY': CMC_API_KEY,
});

export default class DavRate {

  private static async getConversionRate(currencyCode: string) {
    const response = await fetch(`${COINMARKETCAP_API_CALL_URL}${currencyCode}`, { headers });
    const data = await response.json();
    return data.data.DAV;
  }

  public static async insertDavRate() {
    try {
      const conversionRatesPromise = supportedCurrencies.map(DavRate.getConversionRate);
      const conversionRatesData = await Promise.all(conversionRatesPromise);
      const conversionRates: any = {};
      supportedCurrencies.forEach((currencyCode: string, index: number) =>
        conversionRates[`${currencyCode.toLocaleLowerCase()}Price`] = conversionRatesData[index].quote[currencyCode].price);
      const timeStamp = new Date(conversionRatesData[0].last_updated);
      conversionRates.updateTime = `${timeStamp.getUTCHours()}:${timeStamp.getUTCMinutes()}:${timeStamp.getUTCSeconds()}`;
      await ConversionRates.insertAndExit(conversionRates);
    } catch (err) {
      /* */
    }
  }
}
