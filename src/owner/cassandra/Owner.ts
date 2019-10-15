import Client from '../../common/cassandra/client';
import { IUser, IPersonalDetails as IPersonalDetailsBase } from '../../common/User';

export interface ISupportInfo {
  phone?: string;
  email?: string;
  link?: string;
}

export interface IOwner extends IUser {
  companyName?: string;
  fiatCurrencyCode?: string;
  supportInfo?: ISupportInfo;
}

export interface IPersonalDetails extends IPersonalDetailsBase {
  companyName?: string;
}

export interface IOwnerDailyStats {
  id?: string;
  date?: Date;
  dailyRidesCount: number;
  dailyDAVRevenue: number;
  dailyFiatRevenue: number;
  currencyCode: string;
  totalFiatRevenue: number;
  totalRidesCount: number;
}

export default class Owner {
  public static list(): Promise<IOwner[]> {
    return Client.getClient().execute('', {}, {}).then(r => []);
  }

  public static findById(id: string): Promise<IOwner> {
    return Client.execute(`SELECT * from ${Client.keyspace}.owners WHERE id=?`, [id], { prepare: true }).then((res): IOwner => {
      const first = res.first();
      if (!first) {
        return null;
      }
      return {
        id: first.id.toString(),
        email: first.email,
        phoneNumber: first.phone_number,
        phoneConfirmed: first.phone_confirmed,
        firstName: first.first_name,
        lastName: first.last_name,
        profileImageUrl: first.profile_image_id,
        privateKey: first.private_key,
        davBalance: parseFloat(first.dav_balance_base) || 0,
        paymentMethodCustomer: first.stripe_customer_id,
        companyName: first.company_name,
        fiatCurrencyCode: first.fiat_currency_code,
        supportInfo: {
          phone: first.support_phone_number,
          email: first.support_email,
          link: first.support_link,
        },
      };
    });
  }

  public static getOwnerDavBalanceDelta(id: string) {
    return Client.execute(`SELECT * from ${Client.keyspace}.owner_dav_balance WHERE id=?`, [id], { prepare: true }).then((res): IOwner => {
      const first = res.first();
      if (!first) {
        return {
          id,
          davBalance: 0,
        };
      }
      return {
        id: first.id.toString(),
        davBalance: parseFloat(first.dav_balance_delta) / 100,
      };
    });
  }

  public static findByPhone(phoneNumber: string): Promise<IOwner> {
    return Client.execute(`SELECT * from ${Client.keyspace}.owners_phone WHERE phone_number=?`, [phoneNumber],
     { prepare: true }).then((res): IOwner => {
      const first = res.first();
      if (!first) {
        return null;
      }
      return {
        id: first.id.toString(),
        createdFrom: first.created_from,
        email: first.email,
        phoneNumber: first.phone_number,
        phoneConfirmed: first.phone_confirmed,
        firstName: first.first_name,
        lastName: first.last_name,
        profileImageUrl: first.profile_image_id,
        privateKey: first.private_key,
        paymentMethodCustomer: first.stripe_customer_id,
      };
    });
  }

  public static insert(owner: IOwner): Promise<void> {
    return Client.execute(`INSERT INTO ${Client.keyspace}.owners (id, phone_number, phone_confirmed)
    VALUES (?,?,?);`,
        [owner.id, owner.phoneNumber, owner.phoneConfirmed], { prepare: true })
      .then(res => {/**/ });
  }

  public static updatePersonalDetails(personalDetails: IPersonalDetails): Promise<void> {
    return Client.execute(`UPDATE ${Client.keyspace}.owners SET
        email = ?,
        first_name = ?,
        last_name = ?,
        company_name = ?
      WHERE id = ?;`,
      [
        personalDetails.email,
        personalDetails.firstName,
        personalDetails.lastName,
        personalDetails.companyName,
        personalDetails.id,
      ], { prepare: true })
      .then(res => { /* */ });
  }

  public static getOwnerStats(ownerId: string, date: Date): Promise<IOwnerDailyStats> {
    return Client.execute(`SELECT * from ${Client.keyspace}.owner_stats_daily WHERE owner_id=? AND date=?`, [ownerId, date],
       { prepare: true }).then((res): IOwnerDailyStats => {
        const first = res.first();
        if (!first) {
          return null;
        }
        return {
          id: first.owner_id.toString(),
          date: first.date,
          dailyRidesCount: first.total_rides_count,
          dailyDAVRevenue: first.total_dav_revenue,
          dailyFiatRevenue: first.total_fiat_revenue,
          currencyCode: first.currency_code,
          totalFiatRevenue: first.total_fiat_revenue_accumulate,
          totalRidesCount: first.total_rides_count_accumulate,
        };
      });
  }

  public static addToDavBalanceDelta(userId: string, tokensDelta: number) {
    tokensDelta *= 100;
    return Client.execute(`UPDATE ${Client.keyspace}.owner_dav_balance SET
        dav_balance_delta = dav_balance_delta + ?
      WHERE id = ?;`,
      [
        tokensDelta,
        userId,
      ], { prepare: true })
      .then(res => { /* */ });
  }
}
