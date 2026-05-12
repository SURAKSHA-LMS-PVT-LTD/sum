import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstituteUserType } from '../entities/institute-user-type.entity';
import { CreateUserTypeDto, UpdateUserTypeDto } from '../dto/user-type.dto';

@Injectable()
export class UserTypesService {
  constructor(
    @InjectRepository(InstituteUserType)
    private readonly repo: Repository<InstituteUserType>,
  ) {}

  async findAllForInstitute(instituteId: string): Promise<InstituteUserType[]> {
    return this.repo.find({
      where: { instituteId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string, instituteId: string): Promise<InstituteUserType> {
    const ut = await this.repo.findOne({ where: { id, instituteId } });
    if (!ut) throw new NotFoundException(`User type ${id} not found`);
    return ut;
  }

  async create(instituteId: string, dto: CreateUserTypeDto): Promise<InstituteUserType> {
    const existing = await this.repo.findOne({ where: { instituteId, slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" already used in this institute`);

    const ut = this.repo.create({ ...dto, instituteId, isSystem: false });
    return this.repo.save(ut);
  }

  async update(id: string, instituteId: string, dto: UpdateUserTypeDto): Promise<InstituteUserType> {
    const ut = await this.findOne(id, instituteId);
    if (ut.isSystem) {
      const { name, ...safeUpdates } = dto as any;
      Object.assign(ut, safeUpdates);
    } else {
      Object.assign(ut, dto);
    }
    return this.repo.save(ut);
  }

  async softDelete(id: string, instituteId: string): Promise<void> {
    const ut = await this.findOne(id, instituteId);
    if (ut.isSystem) throw new ConflictException('Cannot delete a system user type');
    ut.isActive = false;
    await this.repo.save(ut);
  }
}
