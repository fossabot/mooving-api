import Client from '../cassandra/client';

export interface IDavConversionRates {
  updateDate?: Date;
  updateTime?: string;
  usdPrice?: number;
  ilsPrice?: number;
  eurPrice?: number;
  gbpPrice?: number;
  phpPrice?: number;
  idrPrice?: number;
  hufPrice?: number;
  plnPrice?: number;
}

export class ConversionRates {
  public static insertAndExit(conversionRates: IDavConversionRates): Promise<void> {
    const client = Client.getClient();
    return Client.execute(`INSERT INTO ${Client.keyspace}.dav_conversion_rates
    (update_date, update_time, updated_timestamp, usd_price, ils_price, eur_price, gbp_price, php_price, idr_price, huf_price, pln_price)
    VALUES (toDate(now()), ?, dateof(now()), ?, ?, ?, ?, ?, ?, ?, ?);`,
        [conversionRates.updateTime, conversionRates.usdPrice || 0, conversionRates.ilsPrice || 0,
         conversionRates.eurPrice || 0, conversionRates.gbpPrice || 0, conversionRates.phpPrice || 0,
         conversionRates.idrPrice || 0, conversionRates.hufPrice || 0, conversionRates.plnPrice || 0], { prepare: true })
      .then(res => {
        client.shutdown();
      });
  }
}
