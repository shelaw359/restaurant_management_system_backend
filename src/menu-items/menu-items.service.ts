import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from './entities/menu-item.entity'; 
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuItemService {  // CHANGED FROM MenuService to MenuItemService
  constructor(
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
  ) {}

  async create(createMenuItemDto: CreateMenuItemDto): Promise<MenuItem> {
    const menuItem = this.menuItemRepository.create(createMenuItemDto);
    return await this.menuItemRepository.save(menuItem);
  }

  async findAll(restaurantId: number): Promise<MenuItem[]> {
    return await this.menuItemRepository.find({
      where: { restaurantId, isAvailable: true },
      relations: ['category'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async findByCategory(restaurantId: number, categoryId: number): Promise<MenuItem[]> {
    return await this.menuItemRepository.find({
      where: { 
        restaurantId, 
        categoryId, 
        isAvailable: true 
      },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<MenuItem> {
    const menuItem = await this.menuItemRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!menuItem) {
      throw new NotFoundException(`Menu item #${id} not found`);
    }

    return menuItem;
  }

  async update(
    id: number,
    updateMenuItemDto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    const menuItem = await this.findOne(id);
    Object.assign(menuItem, updateMenuItemDto);
    return await this.menuItemRepository.save(menuItem);
  }

  async toggleAvailability(id: number): Promise<MenuItem> {
    const menuItem = await this.findOne(id);
    menuItem.isAvailable = !menuItem.isAvailable;
    return await this.menuItemRepository.save(menuItem);
  }

  async remove(id: number): Promise<void> {
    const menuItem = await this.findOne(id);
    menuItem.isAvailable = false;
    await this.menuItemRepository.save(menuItem);
  }
}