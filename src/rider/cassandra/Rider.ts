import Client from '../../common/cassandra/client';
import { IUser, IPersonalDetails } from '../../common/User';
import { types } from 'cassandra-driver';
import { IRideWithStatusCode } from './ActiveRides';

// tslint:disable-next-line:no-empty-interface
export interface IRider extends IUser {
  userGotDavReward?: boolean;
}

// tslint:disable-next-line:no-empty-interface
export interface IRiderWithActiveRide extends IRider {
  activeRide?: IRideWithStatusCode;
}

export interface IPaymentMethod {
  paymentMethodId: string;
  paymentMethodCustomer: string;
}

export default class Rider {

  public static list(): Promise<IRider[]> {
    return Client.getClient().execute('', {}, {}).then(r => []);
  }

  public static findById(id: string): Promise<IRider> {
    return Client.execute(`SELECT * from ${Client.keyspace}.riders WHERE id=?`, [id], { prepare: true }).then((res): IRider => {
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
        davId: first.dav_id,
        davBalance: parseFloat(first.dav_balance) || 0,
        privateKey: first.private_key,
        paymentMethodId: first.payment_method_id,
        paymentMethodCustomer: first.payment_method_customer,
      };
    });
  }

  public static findByPhone(phoneNumber: string): Promise<IRider> {
    return Client.execute(`SELECT * from ${Client.keyspace}.riders_phone WHERE phone_number=?`, [phoneNumber],
      { prepare: true }).then((res): IRider => {
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
          davId: first.dav_id,
          privateKey: first.private_key,
          paymentMethodId: first.payment_method_id,
          paymentMethodCustomer: first.payment_method_customer,
        };
      });
  }

  public static insert(rider: IRider): Promise<void> {
    return Client.execute(`INSERT INTO ${Client.keyspace}.riders (id, phone_number, phone_confirmed)
    VALUES (?,?,?);`,
      [rider.id, rider.phoneNumber, rider.phoneConfirmed], { prepare: true })
      .then(res => {/**/ });
  }

  public static updatePersonalDetails(personalDetails: IPersonalDetails): Promise<void> {
    return Client.execute(`UPDATE ${Client.keyspace}.riders SET
        email = ?,
        first_name = ?,
        last_name = ?,
        profile_image_id = ?
      WHERE id = ?;`,
      [
        personalDetails.email,
        personalDetails.firstName,
        personalDetails.lastName,
        personalDetails.profileImageUrl,
        personalDetails.id,
      ], { prepare: true })
      .then(res => { /* */ });
  }

  public static updatePaymentDetails(userId: string, shopperId: string): Promise<void> {
    return Client.execute(`UPDATE ${Client.keyspace}.riders SET
        payment_method_id = ?
      WHERE id = ?;`,
      [
        shopperId,
        userId,
      ], { prepare: true })
      .then(res => { /* */ });
  }

  public static updateDavBalance(userId: string, davBalance: number) {
    return Client.execute(`UPDATE ${Client.keyspace}.riders SET
        dav_balance = ?
      WHERE id = ?;`,
      [
        davBalance,
        userId,
      ], { prepare: true })
      .then(res => { /* */ });
  }
}
