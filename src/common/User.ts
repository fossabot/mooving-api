export interface IPersonalDetails {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl: string;
  }

export interface IUser {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    phoneNumber?: string;
    phoneConfirmed?: boolean;
    createdFrom?: string;
    privateKey?: Buffer;
    davBalance?: number;
    paymentMethodId?: string;
    paymentMethodCustomer?: string;
    profileImageUrl?: string;
    davId?: string;
    isPaymentValid?: boolean;
  }
