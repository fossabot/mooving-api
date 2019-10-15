import Client from '../../common/cassandra/client';

export interface IVehicle {
  id?: string;
  ownerId?: string;
  status?: string;
  batteryLevel?: number;
  model?: string;
  qrCode?: string;
  geoHash?: string;
  name?: string;
  operatorName?: string;
  deviceId?: string;
  vendor?: string;
}

export interface IVehicleStats {
  id?: string;
  dailyUse?: number;
  dailyProfit?: number;
  feedbackRatingCount?: number[];
  lastParkingImageUrl?: string;
  totalProfit?: number;
  totalUse?: number;
}

export interface IFeedback {
  vehicleId: string;
  ownerId: string;
  feedbackTags?: string[];
  rating?: number;
  parkingImageUrl?: string;
  startTime?: string;
  endTime?: string;
}

export default class Vehicles {

  public static findById(id: string): Promise<IVehicle> {
    return Client.execute(`SELECT * from ${Client.keyspace}.vehicles WHERE id=?`, [id], { prepare: true }).then((res): IVehicle => {
      const first = res.first();
      if (!first) {
        return null;
      }
      return {
        id: first.id.toString(),
        ownerId: first.owner_id.toString(),
        status: first.status.toLowerCase(),
        batteryLevel: first.battery_percentage,
        model: first.model,
        qrCode: first.qr_code,
        geoHash: first.geo_hash,
        name: first.vehicle_name,
        deviceId: first.device_id,
        vendor: first.vendor,
      };
    });
  }

  public static findVehiclesByOwner(ownerId: string) {
    return Client.execute(`SELECT * from ${Client.keyspace}.owner_vehicles WHERE owner_id=?`,
      [ownerId], { prepare: true }).then((res): IVehicle[] => {
        if (res.rowLength > 0) {
          const vehicles = res.rows.map((vehicle: any) => ({
            id: vehicle.id.toString(),
            status: vehicle.status.toLowerCase(),
            inTransition: vehicle.in_transition,
            batteryLevel: vehicle.battery_percentage,
            model: vehicle.model,
            qrCode: vehicle.qr_code,
            geoHash: vehicle.geo_hash,
            name: vehicle.vehicle_name,
          }));
          return vehicles;
        }
        return [];
      });
  }

  public static getOwnerVehiclesFeedbacks(vehicleId: string, fromTime: Date): Promise<IFeedback[]> {
    return Client.getClient().execute(`SELECT * from ${Client.keyspace}.vehicle_rides_summary WHERE vehicle_id=? AND start_time<? LIMIT 5`,
      [vehicleId, new Date(fromTime).toISOString()], { prepare: true }).then((res): IFeedback[] => {
        if (res.rowLength > 0) {
          const feedbacks = res.rows.map((rideSummary: any) => ({
            vehicleId: rideSummary.vehicle_id.toString(),
            ownerId: rideSummary.owner_id.toString(),
            feedbackTags: rideSummary.feedback_tags,
            rating: rideSummary.rating,
            parkingImageUrl: rideSummary.parking_image_url,
            startTime: rideSummary.start_time,
            endTime: rideSummary.end_time,
          }));
          return feedbacks.filter(({ rating }) => rating);
        }
        return [];
      });
  }

  public static getOwnerVehiclesStats(ownerId: string, date: Date): Promise<IVehicleStats[]> {
    return Client.execute(`SELECT * from ${Client.keyspace}.vehicle_stats_daily WHERE owner_id=? AND date=?`,
      [ownerId, date], { prepare: true }).then((res): IVehicleStats[] => {
        if (res.rowLength > 0) {
          const vehicles = res.rows.map((vehicle: any) => ({
            id: vehicle.vehicle_id.toString(),
            dailyUse: vehicle.total_rides_count,
            dailyProfit: vehicle.total_fiat_revenue,
            totalProfit: vehicle.total_fiat_revenue_accumulate,
            totalUse: vehicle.total_rides_count_accumulate,
            feedbackRatingCount: [
              vehicle.rating_1_count,
              vehicle.rating_2_count,
              vehicle.rating_3_count,
              vehicle.rating_4_count,
              vehicle.rating_5_count,
            ],
          }));
          return vehicles;
        }
        return [];
      });
  }

  public static getOwnerVehicleStatsByVehicleId(ownerId: string, date: Date, vehicleId: string): Promise<IVehicleStats> {
    return Client.execute(`SELECT * from ${Client.keyspace}.vehicle_stats_daily WHERE owner_id=? AND date=? AND vehicle_id=?`,
      [ownerId, date, vehicleId], { prepare: true }).then((res): IVehicleStats => {
        const first = res.first();
        if (!first) {
          return null;
        }
        return {
          id: first.vehicle_id.toString(),
          dailyUse: first.total_rides_count,
          dailyProfit: first.total_fiat_revenue,
          feedbackRatingCount: [
            first.rating_1_count,
            first.rating_2_count,
            first.rating_3_count,
            first.rating_4_count,
            first.rating_5_count,
          ],
          lastParkingImageUrl: first.last_parking_image_url,
        };
      });
  }

  public static updateAllOwnerVehicles(ownerId: string, vehicle: Partial<IVehicle>) {
    return Client.execute(`SELECT id from ${Client.keyspace}.owner_vehicles WHERE owner_id=?`,
      [ownerId], { prepare: true }).then((res): string[] => {
        if (res.rowLength > 0) {
          return res.rows.map(row => row.id);
        }
        return [];
      }).then((vehicleIds: string[]) => {
        return Client.execute(`UPDATE ${Client.keyspace}.vehicles SET
      operator_name = ?
      WHERE id IN (${vehicleIds.join(', ')})`,
          [
            vehicle.operatorName,
          ], { prepare: true });
      }).then(res => { /* */ });
  }

}
