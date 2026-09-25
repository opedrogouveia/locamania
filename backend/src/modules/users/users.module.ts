import { Module } from '@nestjs/common';

import { UsersService } from './application/users.service';
import { USERS_REPOSITORY } from './domain/users.ports';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository }],
})
export class UsersModule {}
