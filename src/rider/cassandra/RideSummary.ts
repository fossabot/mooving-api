import Client from '../../common/cassandra/client';

export interface IRideSummary {
  riderId: string;
  vehicleId: string;
  ownerId?: string;
  startTime: string;
  endTime?: string;
  startGeohash?: string;
  endGeohash?: string;
  parkingImageUrl?: string;
  rating?: number;
  price?: number;
  paymentMethodDav?: boolean;
  currencyCode?: string;
  tags?: string[];
  effectiveDate?: string;
  distance?: number;
  davAwarded?: number;
  davRate?: number;
}

export default class RideSummary {

  public static getRideSummary(riderId: string, vehicleId: string, startTime: Date): Promise<IRideSummary> {
    return Client.execute(`SELECT * from ${Client.keyspace}.rides_summary WHERE rider_id=? AND vehicle_id=? AND start_time=?`,
      [riderId, vehicleId, startTime], { prepare: true }).then((res): IRideSummary => {
        const first = res.first();
        if (!first) {
          return null;
        }
        return {
          riderId: first.rider_id.toString(),
          vehicleId: first.vehicle_id.toString(),
          ownerId: first.owner_id.toString(),
          startTime: first.start_time,
          endTime: first.end_time,
          startGeohash: first.start_geohash,
          endGeohash: first.end_geohash,
          parkingImageUrl: first.parking_image_url,
          rating: first.rating,
          effectiveDate: first.effective_date,
          price: first.price,
          paymentMethodDav: first.payment_method_dav,
          currencyCode: first.currency_code,
          davRate: first.conversion_rate,
          davAwarded: parseFloat(first.dav_awarded),
        };
      });
  }

  public static getRideHistory(riderId: string): Promise<IRideSummary[]> {
    return Client.execute(`SELECT * from ${Client.keyspace}.rider_rides_summary WHERE rider_id=?`,
      [riderId], { prepare: true }).then(res => {
        if (res.rowLength > 0) {
          const rideHistory = res.rows.map((ride: any) => ({
            startTime: ride.start_time,
            endTime: ride.end_time,
            price: parseFloat(ride.price),
            distance: parseFloat(ride.distance),
            currencyCode: ride.currency_code,
            davAwarded: parseFloat(ride.dav_awarded),
          }));
          return rideHistory;
        }
        return [] as any;
      });
  }

  public static setRating(rideSummary: IRideSummary): Promise<void> {
    const updateRideSummaryQuery = {
      query: `UPDATE ${Client.keyspace}.rides_summary SET rating=?, feedback_tags=? WHERE rider_id=? AND vehicle_id=? AND start_time=?`,
      params: [
        rideSummary.rating,
        rideSummary.tags,
        rideSummary.riderId,
        rideSummary.vehicleId,
        rideSummary.startTime,
      ],
    };
    const updateRideSummaryEffectiveDateQuery = {
      query: `UPDATE ${Client.keyspace}.rides_summary_effective_date SET rating=?, feedback_tags=?
        WHERE effective_date=? AND rider_id=? AND vehicle_id=? AND start_time=?`,
      params: [
        rideSummary.rating,
        rideSummary.tags,
        rideSummary.effectiveDate,
        rideSummary.riderId,
        rideSummary.vehicleId,
        rideSummary.startTime,
      ],
    };
    return Client.batch([updateRideSummaryQuery, updateRideSummaryEffectiveDateQuery], { prepare: true })
      .then(res => { /* */ });
  }

  public static setPaymentType(paymentIsDav: boolean, riderId: string, vehicleId: string, startTime: string, effectiveDate: string) {
    let updateRideSummaryQueryString;
    if (paymentIsDav) {
      updateRideSummaryQueryString = `UPDATE ${Client.keyspace}.rides_summary SET payment_method_dav=true,dav_awarded=0
      WHERE rider_id=? AND vehicle_id=? AND start_time=?`;
    } else {
      updateRideSummaryQueryString = `UPDATE ${Client.keyspace}.rides_summary SET payment_method_dav=false
      WHERE rider_id=? AND vehicle_id=? AND start_time=?`;
    }
    const updateRideSummaryQuery = {
      query: updateRideSummaryQueryString,
      params: [
        riderId,
        vehicleId,
        startTime,
      ],
    };
    const updateRideSummaryEffectiveDateQuery = {
      query: `UPDATE ${Client.keyspace}.rides_summary_effective_date SET payment_method_dav=?
      WHERE effective_date=? AND rider_id=? AND vehicle_id=? AND start_time=?`,
      params: [
        paymentIsDav,
        effectiveDate,
        riderId,
        vehicleId,
        startTime,
      ],
    };
    return Client.batch([updateRideSummaryQuery, updateRideSummaryEffectiveDateQuery], { prepare: true })
      .then(res => { /* */ });
  }

}
