import Client from '../../common/cassandra/client';

export interface IVehicle {
  id?: string;
  status?: string;
  inTransition?: boolean;
  batteryLevel?: number;
  model?: string;
  modelImageUrl?: string;
  qrCode?: string;
  geoHash?: string;
  operatorName?: string;
  basePrice?: number;
  pricePerMinute?: number;
  ownerId?: string;
  currencyCode?: string;
}

export enum VehicleStatus {
  onmission = 'onmission',
  available = 'available',
  maintenance = 'maintenance',
  notavailable = 'notavailable',
}

export default class Vehicles {

  public static findById(id: string): Promise<IVehicle> {
    return Client.execute(`SELECT * from ${Client.keyspace}.vehicles WHERE id=?`, [id], { prepare: true }).then((res): IVehicle => {
      if (res == null) {
        return null;
      }
      const first = res.first();
      if (!first) {
        return null;
      }
      return {
        id: first.id.toString(),
        status: first.status,
        batteryLevel: first.battery_percentage,
        model: first.model,
        qrCode: first.qr_code,
        geoHash: first.geo_hash,
        operatorName: first.operator_name,
        ownerId: first.owner_id.toString(),
        basePrice: first.base_price,
        pricePerMinute: first.price_per_minute,
        modelImageUrl: first.model_image_url,
      };
    });
  }

  public static findByQrCode(qrCode: string): Promise<IVehicle> {
    return Client.execute(`SELECT * from ${Client.keyspace}.vehicles_qr_code WHERE qr_code=?`,
      [qrCode.toLowerCase()], { prepare: true }).then((res): IVehicle => {
        const first = res.first();
        if (!first) {
          return null;
        }
        return {
          id: first.id.toString(),
          status: first.status,
          batteryLevel: first.battery_percentage,
          model: first.model,
          qrCode: first.qr_code,
          geoHash: first.geo_hash,
          operatorName: first.operator_name,
          ownerId: first.owner_id.toString(),
          basePrice: first.base_price,
          pricePerMinute: first.price_per_minute,
          modelImageUrl: first.model_image_url,
        };
      });
  }

  public static getSearchResultsByLocation(locationGeoHash: string) {
    return Client.execute(`SELECT * from ${Client.keyspace}.vehicle_location_search_results WHERE geo_hash_prefix=?`,
      [locationGeoHash], { prepare: true }).then((res): { jsonString: string } => {
        const first = res.first();
        if (first) {
          return { jsonString: first.search_results };
        }
        return null;
      });
  }

  public static getVehiclesFromSearchResults(searchResults: string): IVehicle[] | null {
    if (searchResults !== null) {
      const searchResultsJson = JSON.parse(searchResults);
      const vehicles = searchResultsJson.map((vehicle: any) => ({
        id: vehicle.id.toString(),
        status: vehicle.status,
        batteryLevel: vehicle.batteryPercentage,
        model: vehicle.model,
        qrCode: vehicle.qrCode,
        geoHash: vehicle.geoHash,
        operatorName: vehicle.operator_name,
        basePrice: vehicle.base_price,
        pricePerMinute: vehicle.price_per_minute,
      }));
      return vehicles;
    } else {
      return null;
    }
  }

  public static createEmptyVehiclesSearchResult(locationGeoHash: string, searchPrefixLength: number) {
    return Client.execute(`INSERT INTO ${Client.keyspace}.vehicle_location_search_results (
      geo_hash_prefix,
      search_prefix_length,
      search_prefix,
      search_results
    )
    VALUES (?,?,?,?) USING TTL 15`,
      [
        locationGeoHash,
        searchPrefixLength,
        locationGeoHash.substring(0, searchPrefixLength),
        null,
      ],
      { prepare: true })
      .then(res => {/**/ });
  }
}
