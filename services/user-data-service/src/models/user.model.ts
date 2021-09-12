import {Entity, hasOne, model, property} from '@loopback/repository';
import {UserCredentials} from './user-credentials.model';

@model({
  settings: {
    mongodb: {collection: 'UserData'},
   
  }
})
export class User extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true
  })
  id: string;

  @property({
    type: 'string',
    required: true,
  })
  email: string;

  // @property({
  //   type: 'boolean',
  //   default: false,
  // })
  // emailConfirmed?: boolean;

  // @property({
  //   type: 'string',
  //   default: null,
  // })
  // phoneNumber?: string;

  // @property({
  //   type: 'boolean',
  //   default: false,
  // })
  // phoneConfirmed?: boolean;

  // @property({
  //   type: 'boolean',
  //   default: false,
  // })
  // twofactorEnabled?: boolean;

  // @property({
  //   type: 'number',
  //   default: 1,
  // })
  // version?: number;

  @property({
    type: 'date',
    required: true,
  })
  createdOn: string;


  @hasOne(() => UserCredentials)
  userCredentials: UserCredentials;

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
}


export type UserWithRelations = User & UserRelations
