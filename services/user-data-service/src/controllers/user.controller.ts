import {Filter, model, property, repository} from '@loopback/repository';
import {JwtRefreshService, PasswordHasher, validateCredentials} from '../services';
import {get, HttpErrors, param, post, requestBody} from '@loopback/rest';
import {User} from '../models';
import {Credentials, UserRepository} from '../repositories';
import {inject, intercept} from '@loopback/core';
import {authenticate, TokenService, UserService} from '@loopback/authentication';
import {authorize} from '@loopback/authorization';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {CredentialsRequestBody, RefreshGrant, RefreshGrantRequestBody, UserProfileSchema} from './specs/user-controller.specs';

import {PasswordHasherBindings, TokenServiceBindings, UserServiceBindings} from '../keys';
import _ from 'lodash';
import {basicAuthorization} from '../middlewares/auth.midd';
import { TokenObject } from '@loopback/authentication-jwt/dist/types';
import { RefreshTokenServiceBindings } from '@loopback/authentication-jwt/dist/keys';

@model()
export class NewUserRequest extends User {
  @property({
    type: 'string',
    required: true,
  })
  password: string;
}

import * as speakeasy from 'speakeasy';

export class UserController {
  constructor(
    @repository(UserRepository) public userRepository: UserRepository,
    @inject(PasswordHasherBindings.PASSWORD_HASHER)
    public passwordHasher: PasswordHasher,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: TokenService,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: UserService<User, Credentials>,
    @inject(RefreshTokenServiceBindings.REFRESH_TOKEN_SERVICE)
    public refreshService: JwtRefreshService,
  ) {
  }


 

  @get('/users/check_valid', {
    responses: {
      '200': {
        description: 'User',
        content: {
          'application/json': {
            schema: {
              'x-ts-type': User,
            },
          },
        },
      },
    },
  })
  async check( @param.filter(User) filter?: Filter<User>,
    ): Promise<User[]> {
      return this.userRepository.find(filter);
    }




  @post('/users/sign-up', {
    responses: {
      '200': {
        description: 'User',
        content: {
          'application/json': {
            schema: {
              'x-ts-type': User,
            },
          },
        },
      },
    },
  })
  async create(
    @requestBody(CredentialsRequestBody)
      newUserRequest: Credentials,
  ): Promise<User> {

    // ensure a valid email value and password value
    validateCredentials(_.pick(newUserRequest, ['email', 'password']));

    // encrypt the password
    const password = await this.passwordHasher.hashPassword(
      newUserRequest.password,
    );

    try {
      
      // create the new user
      const savedUser = await this.userRepository.create(
        _.omit(newUserRequest, 'password'),
      );

      // set the password
      await this.userRepository
        .userCredentials(savedUser.id)
        .create({password});

      return savedUser;
    } catch (error) {
      // MongoError 11000 duplicate key
      if (error.code === 11000 && error.errmsg.includes('index: uniqueEmail')) {
        throw new HttpErrors.Conflict('Email value is already taken');
      } else {
        throw error;
      }
    }
  }

  // @post('/users/sign-up/admin', {
  //   responses: {
  //     '200': {
  //       description: 'User',
  //       content: {
  //         'application/json': {
  //           schema: {
  //             'x-ts-type': User,
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // async createAdmin(
  //   @requestBody(CredentialsRequestBody)
  //     newUserRequest: Credentials,
  // ): Promise<User> {
  //   // All new users have the "customer" role by default
  //   // ensure a valid email value and password value
  //   validateCredentials(_.pick(newUserRequest, ['email', 'password']));

  //   // encrypt the password
  //   const password = await this.passwordHasher.hashPassword(
  //     newUserRequest.password,
  //   );

  //   try {
  //     // create the new user
  //     const savedUser = await this.userRepository.create(
  //       _.omit(newUserRequest, 'password'),
  //     );

  //     // set the password
  //     await this.userRepository
  //       .userCredentials(savedUser.id)
  //       .create({password});

  //     return savedUser;
  //   } catch (error) {
  //     // MongoError 11000 duplicate key
  //     if (error.code === 11000 && error.errmsg.includes('index: uniqueEmail')) {
  //       throw new HttpErrors.Conflict('Email value is already taken');
  //     } else {
  //       throw error;
  //     }
  //   }
  // }


  @get('/users/{userId}', {
    responses: {
      '200': {
        description: 'User',
        content: {
          'application/json': {
            schema: {
              'x-ts-type': User,
            },
          },
        },
      },
    },
  })
  async findById(@param.path.string('userId') userId: string): Promise<User> {
    return this.userRepository.findById(userId);
  }

  @get('/users/me', {
    responses: {
      '200': {
        description: 'The current user profile',
        content: {
          'application/json': {
            schema: UserProfileSchema,
          },
        },
      },
    },
  })
  @authenticate('jwt')
  async printCurrentUser(
    @inject(SecurityBindings.USER)
      currentUserProfile: UserProfile,
  ): Promise<User> {

    const userId = currentUserProfile[securityId];
    return this.userRepository.findById(userId);
  }

  // @post('/users/login', {
  //   responses: {
  //     '200': {
  //       description: 'Token',
  //       content: {
  //         'application/json': {
  //           schema: {
  //             type: 'object',
  //             properties: {
  //               token: {
  //                 type: 'string',
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // async login(
  //   @requestBody(CredentialsRequestBody) credentials: Credentials,
  // ): Promise<{token: string}> {
  //   // ensure the user exists, and the password is correct
  //   const user = await this.userService.verifyCredentials(credentials);

  //   // convert a User object into a UserProfile object (reduced set of properties)
  //   const userProfile = this.userService.convertToUserProfile(user);

  //   // create a JSON Web Token based on the user profile
  //   const token = await this.jwtService.generateToken(userProfile);

  //   return {token};
  // }

  @post('/users/login', {
    responses: {
      '200': {
        description: 'Token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                },
                refreshToken: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  })
  async refreshLogin(
    @requestBody(CredentialsRequestBody) credentials: Credentials,
  ): Promise<Object> {
    // ensure the user exists, and the password is correct
    const user = await this.userService.verifyCredentials(credentials);
    // convert a User object into a UserProfile object (reduced set of properties)
    const userProfile: UserProfile = this.userService.convertToUserProfile(user);
    const token = await this.jwtService.generateToken(userProfile);

    const token_object = await this.refreshService.generateToken(userProfile,token);

   
    return {userId:user.id, token:token_object};
  }

  @post('/refresh', {
    responses: {
      '200': {
        description: 'Token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'object',
                },
              },
            },
          },
        },
      },
    },
  })
  @authenticate('jwt')
  async refresh(
    @requestBody(RefreshGrantRequestBody) refreshGrant: RefreshGrant,
  ): Promise<TokenObject> {
    return this.refreshService.refreshToken(refreshGrant.refreshToken);
  }





  // async loginWithCode(credentials:any, fn:any) {
  //   var err:Error = new Error('Sorry, but that verification code does not work!');

  
  //   this.userRepository.findOne({ where: { email: credentials.email } }).then(async (user:any) =>{
      
  //     // And don’t forget to match this secret to the one in requestCode()
  //     var code = speakeasy.totp({secret: "some_secauth_secret",key: credentials.email});
  
  //     if (code !== credentials.twofactor) {
  //       return fn(err);
  //     }
  
  //     // Everything looks good, so now we can create the access token, which
  //     // is used for all future API calls to authenticate the user.
     
  //     const userProfile: UserProfile = this.userService.convertToUserProfile(user);
  //     const token = await this.jwtService.generateToken(userProfile);
  
  //     const token_object = await this.refreshService.generateToken(userProfile,token);
  
     
  //     return {userId:user.id, token:token_object};

  //   });

  // };

}
