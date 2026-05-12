import {
  Controller, Get, Post, Patch, Put, Delete,
  Param, Body, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserTypesService } from './services/user-types.service';
import { FeaturePermissionsService } from './services/feature-permissions.service';
import { RbacContextService } from './services/rbac-context.service';
import {
  CreateUserTypeDto, UpdateUserTypeDto, BulkUpdatePermissionsDto,
} from './dto/user-type.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(
    private readonly userTypesService: UserTypesService,
    private readonly permissionsService: FeaturePermissionsService,
    private readonly contextService: RbacContextService,
  ) {}

  @Get('institutes/:id/user-types')
  getUserTypes(@Param('id') id: string) {
    return this.userTypesService.findAllForInstitute(id);
  }

  @Get('institutes/:id/user-types/:typeId')
  getUserType(@Param('id') id: string, @Param('typeId') typeId: string) {
    return this.userTypesService.findOne(typeId, id);
  }

  @Post('institutes/:id/user-types')
  createUserType(@Param('id') id: string, @Body() dto: CreateUserTypeDto) {
    return this.userTypesService.create(id, dto);
  }

  @Patch('institutes/:id/user-types/:typeId')
  updateUserType(
    @Param('id') id: string,
    @Param('typeId') typeId: string,
    @Body() dto: UpdateUserTypeDto,
  ) {
    return this.userTypesService.update(typeId, id, dto);
  }

  @Delete('institutes/:id/user-types/:typeId')
  deleteUserType(@Param('id') id: string, @Param('typeId') typeId: string) {
    return this.userTypesService.softDelete(typeId, id);
  }

  @Get('institutes/:id/user-types/:typeId/permissions')
  async getPermissions(@Param('id') id: string, @Param('typeId') typeId: string) {
    const matrix = await this.permissionsService.getMatrix(id, typeId);
    return { userTypeId: typeId, permissions: matrix };
  }

  @Put('institutes/:id/user-types/:typeId/permissions')
  async updatePermissions(
    @Param('id') id: string,
    @Param('typeId') typeId: string,
    @Body() dto: BulkUpdatePermissionsDto,
  ) {
    await this.permissionsService.bulkUpdate(id, typeId, dto);
    return { success: true };
  }

  @Get('institutes/:id/my-context')
  async getMyContext(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.contextService.getContextForUser(String(userId), id);
  }

  @Patch('institutes/:id/users/:userId/user-type')
  async assignUserType(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { userTypeId: string },
  ) {
    const em = this.userTypesService['repo'].manager;
    await em.query(
      `UPDATE institute_user
       SET primary_user_type_id = ?, updated_at = NOW()
       WHERE institute_id = ? AND user_id = ?`,
      [body.userTypeId, id, userId],
    );
    return { success: true };
  }
}
