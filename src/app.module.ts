import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RbacModule } from './modules/rbac/rbac.module';
import { InstituteModule } from './modules/institute/institute.module';
import { UserModule } from './modules/user/user.module';
import { InstituteUserModule } from './modules/institute_modules/institute_user/institute_user.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: false, // Recommended to be false in production
    }),
    RbacModule,
    InstituteModule,
    UserModule,
    InstituteUserModule
  ],
})
export class AppModule {}
