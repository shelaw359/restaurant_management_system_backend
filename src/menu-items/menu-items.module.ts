import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItemService } from './menu-items.service'; // CHANGED TO MenuItemService
import { MenuController } from './menu-items.controller'; 
import { MenuItem } from './entities/menu-item.entity'; 

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem])],
  controllers: [MenuController],
  providers: [MenuItemService], // CHANGED TO MenuItemService
  exports: [MenuItemService], // CHANGED TO MenuItemService
})
export class MenuModule {}