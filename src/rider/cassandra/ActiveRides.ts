import Client from '../../common/cassandra/client';

export interface IRide {
  riderId?: string;
  vehicleId?: string;
  startTime?: string;
  endTime?: string;
  startGeohash?: string;
  endGeohash?: string;
  startBatteryPercentage?: number;
  lastBatteryPercentage?: number;
  distance?: number;
  durationMS?: number;
}

export interface IRideWithStatusCode {
  statusCode: number;
  ride: IRide;
}

export default class ActiveRides {
  public static getActiveRide(userId: string): Promise<IRide> {
    return Client.execute(`SELECT * from ${Client.keyspace}.rider_active_rides WHERE rider_id=?`, [userId], {prepare: true}).then((res): IRide => {
      const first = res.first();
      if (!first || !first.rider_id || !first.vehicle_id) {
        return null;
      }
      return {
        riderId: first.rider_id.toString(),
        vehicleId: first.vehicle_id.toString(),
        startTime: first.start_time,
        endTime: first.end_time,
        startGeohash: first.start_geohash,
        endGeohash: first.end_geohash,
        startBatteryPercentage: first.start_battery_percentage,
        lastBatteryPercentage: first.last_battery_percentage,
        distance: first.distance,
        durationMS: (new Date()).getTime() - (new Date(first.start_time)).getTime(),
      };
    });
  }

  public static deleteUserRide(riderId: string): Promise<void> {
    return Client.execute(`DELETE FROM ${Client.keyspace}.rider_active_rides WHERE rider_id=?;`, [riderId], {prepare: true}).then(res => {
      /*  */
    });
  }
}
